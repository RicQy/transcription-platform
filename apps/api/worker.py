import os
from celery import Celery
from database import SessionLocal
import models
import logging

# Ensure audio functions exists
try:
    from asr import transcribe
    from diarization import diarize
    from merger import merge
except ImportError:
    transcribe = diarize = merge = None

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "asr_worker",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

@celery_app.task(name="asr_worker.transcribe")
def transcribe_audio_task(audio_id: str, audio_path: str):
    logger.info(f"Starting ASR for {audio_id}")
    db = SessionLocal()
    audio = db.query(models.AudioFile).filter(models.AudioFile.id == audio_id).first()
    if not audio:
        db.close()
        return "Audio not found"
        
    audio.status = models.AudioStatusEnum.PROCESSING
    db.commit()
    
    try:
        if transcribe and diarize and merge:
            words = transcribe(audio_path, os.getenv("WHISPER_MODEL_SIZE", "base"))
            speaker_segments = diarize(audio_path)
            unified = merge(words, speaker_segments)
            
            # create Transcript and Segments
            transcript = models.Transcript(
                audioFileId=audio.id,
            )
            db.add(transcript)
            db.commit()
            db.refresh(transcript)
            
            # Simplified mock merging loop for the unified format
            for seg in unified:
                segment_db = models.TranscriptSegment(
                    transcriptId=transcript.id,
                    speaker=seg.get("speaker", "Unknown"),
                    text=seg.get("text", ""),
                    startTime=seg.get("start", 0.0),
                    endTime=seg.get("end", 0.0),
                    confidence=0.9,
                    wordData=seg.get("words", [])
                )
                db.add(segment_db)
            
            audio.status = models.AudioStatusEnum.COMPLETE
            db.commit()
            logger.info(f"Completed processing '{audio_path}'")
        else:
            raise Exception("ASR modules not imported correctly.")
            
    except Exception as e:
        logger.error(f"Error processing {audio_id}: {e}")
        audio.status = models.AudioStatusEnum.ERROR
        db.commit()
    finally:
        db.close()
