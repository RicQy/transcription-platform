import asyncio
import logging

import httpx
from fastapi import BackgroundTasks, FastAPI

from models import TranscribeCallback, TranscribeRequest

logger = logging.getLogger(__name__)

app = FastAPI(title="ASR Worker", version="1.0.0")


async def run_transcription(request: TranscribeRequest) -> None:
    try:
        from asr import transcribe
        from diarization import diarize
        from merger import merge

        words = await asyncio.to_thread(transcribe, request.audio_path, request.model_size)
        speaker_segments = await asyncio.to_thread(diarize, request.audio_path)
        unified = merge(words, speaker_segments)

        callback = TranscribeCallback(
            audio_id=request.audio_id,
            status="complete",
            words=unified,
        )
    except Exception as exc:
        logger.exception("Transcription failed for audio_id=%s", request.audio_id)
        callback = TranscribeCallback(
            audio_id=request.audio_id,
            status="error",
            error=str(exc),
        )

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            await client.post(request.callback_url, json=callback.model_dump())
        except Exception:
            logger.exception(
                "Failed to send callback to %s for audio_id=%s",
                request.callback_url,
                request.audio_id,
            )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/transcribe", status_code=202)
async def transcribe_endpoint(
    request: TranscribeRequest,
    background_tasks: BackgroundTasks,
):
    background_tasks.add_task(run_transcription, request)
    return {"audio_id": request.audio_id, "status": "accepted"}
