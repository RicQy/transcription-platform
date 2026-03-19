import os
import logging
from typing import List
from faster_whisper import WhisperModel
from models import WordResult

logger = logging.getLogger(__name__)

# Configuration for Cloud/Production
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
WHISPER_MODEL_DIR = os.getenv("WHISPER_MODEL_DIR", "/app/models") # Volume mount point
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8") # Use float32 on some CPUs if int8 fails

# Global model instance for singleton-like access in a single-process worker
_model = None

def get_model(model_size: str = WHISPER_MODEL_SIZE):
    global _model
    if _model is None:
        logger.info(f"Loading Whisper model: {model_size} (Device: cpu, Compute: {COMPUTE_TYPE})")
        # download_root is where the model is stored. This allows us to cache it on a volume.
        _model = WhisperModel(
            model_size, 
            device="cpu", 
            compute_type=COMPUTE_TYPE,
            download_root=WHISPER_MODEL_DIR
        )
    return _model

def transcribe(audio_path: str, model_size: str = WHISPER_MODEL_SIZE) -> List[WordResult]:
    """
    Transcribes audio using faster-whisper.
    The model is loaded on first call and cached in memory.
    """
    model = get_model(model_size)
    
    # beam_size=5 is a good balance between speed and accuracy
    segments, _ = model.transcribe(
        audio_path, 
        word_timestamps=True,
        beam_size=5
    )

    words: List[WordResult] = []
    for segment in segments:
        if segment.words:
            for word in segment.words:
                words.append(
                    WordResult(
                        word=word.word.strip(),
                        start=word.start,
                        end=word.end,
                        confidence=word.probability,
                    )
                )
    return words
