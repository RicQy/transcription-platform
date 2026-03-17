import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TranscriptEditor from '../components/editor/TranscriptEditor'
import type { TranscriptSegmentDto } from '@transcribe/shared-types'

// WaveSurfer is not needed for editor tests
vi.mock('wavesurfer.js', () => ({ default: { create: vi.fn() } }))

const mockSegments: TranscriptSegmentDto[] = [
  {
    id: 'seg-1',
    transcriptId: 'tx-1',
    speaker: 'Speaker 1',
    text: 'Hello world',
    startTime: 0,
    endTime: 2.5,
    confidence: 0.95,
    wordData: [
      { word: 'Hello', start: 0, end: 0.5, confidence: 0.98, speakerId: 'SPEAKER_00' },
      { word: 'world', start: 0.6, end: 1.1, confidence: 0.92, speakerId: 'SPEAKER_00' },
    ],
  },
  {
    id: 'seg-2',
    transcriptId: 'tx-1',
    speaker: 'Speaker 2',
    text: 'How are you',
    startTime: 3,
    endTime: 5,
    confidence: 0.88,
    wordData: [
      { word: 'How', start: 3, end: 3.3, confidence: 0.9, speakerId: 'SPEAKER_01' },
      { word: 'are', start: 3.4, end: 3.6, confidence: 0.85, speakerId: 'SPEAKER_01' },
      { word: 'you', start: 3.7, end: 4.0, confidence: 0.88, speakerId: 'SPEAKER_01' },
    ],
  },
]

describe('TranscriptEditor', () => {
  it('renders the editor container', () => {
    render(<TranscriptEditor segments={mockSegments} />)
    expect(screen.getByTestId('transcript-editor')).toBeInTheDocument()
  })

  it('renders segment text content', () => {
    render(<TranscriptEditor segments={mockSegments} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText('How are you')).toBeInTheDocument()
  })

  it('calls onEditorReady with the editor instance', async () => {
    const onReady = vi.fn()
    render(<TranscriptEditor segments={mockSegments} onEditorReady={onReady} />)
    // TipTap onCreate fires asynchronously after mount
    await vi.waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(expect.anything())
    })
  })
})
