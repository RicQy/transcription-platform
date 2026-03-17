import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReviewSuggestionsPanel from '../components/editor/ReviewSuggestionsPanel'
import type { TranscriptSegmentDto } from '@transcribe/shared-types'

const mockSegments: TranscriptSegmentDto[] = [
  {
    id: 'seg-1',
    transcriptId: 'tx-1',
    speaker: 'Speaker 1',
    text: 'Hello world maybe',
    startTime: 0,
    endTime: 3,
    confidence: 0.8,
    wordData: [
      { word: 'Hello', start: 0, end: 0.5, confidence: 0.95, speakerId: 'S1' },
      { word: 'world', start: 0.6, end: 1.1, confidence: 0.55, speakerId: 'S1' }, // low
      { word: 'maybe', start: 1.2, end: 1.8, confidence: 0.62, speakerId: 'S1' }, // low
    ],
  },
]

describe('ReviewSuggestionsPanel', () => {
  it('renders only words below 0.7 confidence', () => {
    render(<ReviewSuggestionsPanel segments={mockSegments} />)
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    expect(screen.getByText('world')).toBeInTheDocument()
    expect(screen.getByText('maybe')).toBeInTheDocument()
  })

  it('sorts by confidence ascending', () => {
    render(<ReviewSuggestionsPanel segments={mockSegments} />)
    const items = screen.getAllByRole('listitem')
    // world (55%) should appear before maybe (62%)
    expect(items[0]).toHaveTextContent('world')
    expect(items[1]).toHaveTextContent('maybe')
  })

  it('calls onSeek with the word start time when Seek is clicked', async () => {
    const user = userEvent.setup()
    const onSeek = vi.fn()
    render(<ReviewSuggestionsPanel segments={mockSegments} onSeek={onSeek} />)

    const seekButtons = screen.getAllByRole('button', { name: /seek/i })
    await user.click(seekButtons[0])

    // First item is 'world' at start=0.6
    expect(onSeek).toHaveBeenCalledWith(0.6)
  })

  it('does not render verified words', () => {
    const segsWithVerified: TranscriptSegmentDto[] = [
      {
        ...mockSegments[0],
        wordData: [
          { word: 'world', start: 0.6, end: 1.1, confidence: 0.55, speakerId: 'S1', verified: true },
        ],
      },
    ]
    render(<ReviewSuggestionsPanel segments={segsWithVerified} />)
    expect(screen.queryByText('world')).not.toBeInTheDocument()
    expect(screen.getByText(/no low-confidence/i)).toBeInTheDocument()
  })
})
