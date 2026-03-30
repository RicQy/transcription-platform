import os
from typing import List

from models import WordResult

OPENAI_MAX_BYTES = 25 * 1024 * 1024  # 25 MB


def transcribe(audio_path: str, model_size: str = "medium") -> List[WordResult]:
    file_size = os.path.getsize(audio_path)
    api_key = os.environ.get("OPENAI_API_KEY", "")

    if api_key and not api_key.startswith("sk-...") and file_size < OPENAI_MAX_BYTES:
        return _transcribe_openai(audio_path, api_key)
    return _transcribe_local(audio_path, model_size)


def _transcribe_openai(audio_path: str, api_key: str) -> List[WordResult]:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)

    with open(audio_path, "rb") as f:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="verbose_json",
            timestamp_granularities=["word"],
        )

    words: List[WordResult] = []
    if hasattr(response, "words") and response.words:
        for w in response.words:
            words.append(WordResult(
                word=w.word.strip(),
                start=w.start,
                end=w.end,
                confidence=1.0,
            ))
    else:
        duration = getattr(response, "duration", 0) or 0
        text = response.text or ""
        token_list = text.split()
        for i, word in enumerate(token_list):
            words.append(WordResult(
                word=word,
                start=round(i * duration / max(len(token_list), 1), 2),
                end=round((i + 1) * duration / max(len(token_list), 1), 2),
                confidence=1.0,
            ))
    return words


def _transcribe_local(audio_path: str, model_size: str) -> List[WordResult]:
    from faster_whisper import WhisperModel

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_path, word_timestamps=True)

    words: List[WordResult] = []
    for segment in segments:
        if segment.words:
            for word in segment.words:
                words.append(WordResult(
                    word=word.word.strip(),
                    start=word.start,
                    end=word.end,
                    confidence=word.probability,
                ))
    return words
