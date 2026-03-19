import os
from typing import List

class SpeakerSegment:
    def __init__(self, start: float, end: float, speaker: str):
        self.start = start
        self.end = end
        self.speaker = speaker

def diarize(audio_path: str) -> List[SpeakerSegment]:
    token = os.environ.get("PYANNOTE_AUTH_TOKEN")
    if not token:
        # Fallback: assume one speaker for the whole file
        # We don't know the duration yet, but we can return an empty list 
        # and let the merger handle it, or return one big segment.
        # Let's return an empty list and make merger smarter.
        return []

    try:
        from pyannote.audio import Pipeline
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=token,
        )
        diarization = pipeline(audio_path)

        segments: List[SpeakerSegment] = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append(SpeakerSegment(start=turn.start, end=turn.end, speaker=speaker))

        return segments
    except Exception:
        return []
