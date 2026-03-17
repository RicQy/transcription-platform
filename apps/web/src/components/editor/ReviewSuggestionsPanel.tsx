import type { TranscriptSegmentDto, WordData } from '@transcribe/shared-types'

const LOW_CONFIDENCE_THRESHOLD = 0.7

interface WordEntry {
  word: WordData
  segmentId: string
  wordIdx: number
}

interface ReviewSuggestionsPanelProps {
  segments: TranscriptSegmentDto[]
  onSeek?: (startTime: number) => void
}

export default function ReviewSuggestionsPanel({ segments, onSeek }: ReviewSuggestionsPanelProps) {
  const lowConfidenceWords: WordEntry[] = segments
    .flatMap((seg) =>
      seg.wordData
        .map((w, idx) => ({ word: w, segmentId: seg.id, wordIdx: idx }))
        .filter((e) => e.word.confidence < LOW_CONFIDENCE_THRESHOLD && !e.word.verified),
    )
    .sort((a, b) => a.word.confidence - b.word.confidence)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Review Suggestions ({lowConfidenceWords.length})
      </h3>

      {lowConfidenceWords.length === 0 ? (
        <p className="text-xs text-gray-400">No low-confidence words.</p>
      ) : (
        <ul className="space-y-2">
          {lowConfidenceWords.map(({ word, segmentId, wordIdx }) => (
            <li
              key={`${segmentId}-${wordIdx}`}
              className="flex items-center justify-between text-xs p-2 rounded border border-yellow-100 bg-yellow-50"
            >
              <div>
                <span className="font-medium text-gray-800">{word.word}</span>
                <span className="text-yellow-700 ml-2">
                  {Math.round(word.confidence * 100)}% confidence
                </span>
                <span className="text-gray-400 ml-2">@ {word.start.toFixed(1)}s</span>
              </div>
              <button
                type="button"
                onClick={() => onSeek?.(word.start)}
                aria-label={`Seek to ${word.word} at ${word.start.toFixed(1)} seconds`}
                className="ml-2 px-2 py-1 text-xs bg-yellow-200 hover:bg-yellow-300 rounded"
              >
                Seek
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
