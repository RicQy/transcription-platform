from typing import List, Optional

from pydantic import BaseModel


class TranscribeRequest(BaseModel):
    audio_path: str
    audio_id: str
    model_size: str = "medium"
    callback_url: str


class WordResult(BaseModel):
    word: str
    start: float
    end: float
    confidence: float
    speaker_id: str = "SPEAKER_00"


class TranscribeCallback(BaseModel):
    audio_id: str
    status: str
    words: List[WordResult] = []
    error: Optional[str] = None
