from typing import List
from diarization import SpeakerSegment
from models import WordResult

def merge(words: List[WordResult], speaker_segments: List[SpeakerSegment]) -> List[WordResult]:
    if not speaker_segments:
        # Default to Speaker 1 for all words
        return [
            WordResult(
                word=word.word,
                start=word.start,
                end=word.end,
                confidence=word.confidence,
                speaker_id="Speaker 1",
            )
            for word in words
        ]

    def find_speaker(start: float, end: float) -> str:
        mid = (start + end) / 2
        best_speaker = "Speaker 1"
        best_overlap = 0.0
        for seg in speaker_segments:
            overlap_start = max(start, seg.start)
            overlap_end = min(end, seg.end)
            overlap = max(0.0, overlap_end - overlap_start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = seg.speaker
        if best_overlap == 0.0:
            for seg in speaker_segments:
                if seg.start <= mid <= seg.end:
                    return seg.speaker
        return best_speaker

    merged: List[WordResult] = []
    for word in words:
        speaker = find_speaker(word.start, word.end)
        merged.append(
            WordResult(
                word=word.word,
                start=word.start,
                end=word.end,
                confidence=word.confidence,
                speaker_id=speaker,
            )
        )
    return merged
