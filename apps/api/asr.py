from typing import List

from faster_whisper import WhisperModel

from models import WordResult


def transcribe(audio_path: str, model_size: str = "medium") -> List[WordResult]:
    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_path, word_timestamps=True)

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
