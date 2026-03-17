import { useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import type WaveSurfer from 'wavesurfer.js'
import type { Editor } from '@tiptap/core'
import { useTranscript, useSaveSegments } from '../api/transcripts'
import { streamAudioUrl } from '../api/audio'
import AudioPlayer from '../components/editor/AudioPlayer'
import TranscriptEditor from '../components/editor/TranscriptEditor'
import ValidationPanel from '../components/editor/ValidationPanel'
import ReviewSuggestionsPanel from '../components/editor/ReviewSuggestionsPanel'
import { useAudioSync } from '../hooks/useAudioSync'
import { useAutoSave } from '../hooks/useAutoSave'
import type { TranscriptSegmentDto } from '@transcribe/shared-types'

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export default function EditorPage() {
  const { audioId } = useParams<{ audioId: string }>()
  const wsRef = useRef<WaveSurfer | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const speedIndexRef = useRef(2) // default 1× (index 2)

  const { data: transcript, isLoading, isError } = useTranscript(audioId ?? '')
  const { mutateAsync: saveSegments } = useSaveSegments(audioId ?? '')

  useAudioSync(editorRef.current, wsRef)

  const handleSave = useCallback(async () => {
    if (!transcript) return
    const segments: TranscriptSegmentDto[] = transcript.segments.map((seg) => ({ ...seg }))
    await saveSegments(segments)
  }, [transcript, saveSegments])

  useAutoSave({ editor: editorRef.current, onSave: handleSave })

  const handlePlayPause = useCallback(() => {
    wsRef.current?.playPause()
  }, [])

  const handleRewind = useCallback(() => {
    const ws = wsRef.current
    if (!ws) return
    const t = ws.getCurrentTime()
    ws.seekTo(Math.max(0, t - 5) / (ws.getDuration() || 1))
  }, [])

  const handleSpeedChange = useCallback((delta: number) => {
    const ws = wsRef.current
    if (!ws) return
    speedIndexRef.current = Math.max(0, Math.min(SPEED_OPTIONS.length - 1, speedIndexRef.current + delta))
    ws.setPlaybackRate(SPEED_OPTIONS[speedIndexRef.current])
  }, [])

  const handleSeek = useCallback((startTime: number) => {
    const ws = wsRef.current
    if (!ws) return
    const duration = ws.getDuration()
    if (duration > 0) ws.seekTo(startTime / duration)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading transcript…</p>
      </div>
    )
  }

  if (isError || !transcript) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-sm text-red-600">Failed to load transcript.</p>
        <Link to="/dashboard" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Transcript Editor</h1>
        <Link to="/dashboard" className="text-sm text-blue-600 hover:underline" aria-label="Back to Dashboard">
          ← Dashboard
        </Link>
      </div>

      <AudioPlayer
        audioUrl={streamAudioUrl(transcript.audioFileId)}
        onReady={(ws) => { wsRef.current = ws }}
      />

      <div className="flex gap-4">
        <main className="flex-1 min-w-0" aria-label="Transcript editor">
          <TranscriptEditor
            segments={transcript.segments}
            onEditorReady={(e) => { editorRef.current = e }}
            onPlayPause={handlePlayPause}
            onRewind={handleRewind}
            onSpeedChange={handleSpeedChange}
          />
        </main>

        <aside className="w-72 flex-shrink-0 flex flex-col gap-4" aria-label="Review panels">
          <ValidationPanel />
          <ReviewSuggestionsPanel
            segments={transcript.segments}
            onSeek={handleSeek}
          />
        </aside>
      </div>
    </div>
  )
}
