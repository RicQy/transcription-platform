import { useEffect, useRef, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { useEditorStore } from '../../store/editorStore'

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]

interface AudioPlayerProps {
  audioUrl: string
  onReady?: (ws: WaveSurfer) => void
}

export default function AudioPlayer({ audioUrl, onReady }: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)

  const { isPlaying, setIsPlaying, setCurrentTime } = useEditorStore()

  useEffect(() => {
    if (!containerRef.current) return

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#93c5fd',
      progressColor: '#2563eb',
      height: 64,
      normalize: true,
    })

    wsRef.current = ws

    ws.load(audioUrl)

    ws.on('ready', () => {
      onReady?.(ws)
    })

    ws.on('timeupdate', (currentTime: number) => {
      setCurrentTime(currentTime)
    })

    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))

    return () => {
      ws.destroy()
      wsRef.current = null
    }
  }, [audioUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = useCallback(() => {
    wsRef.current?.playPause()
  }, [])

  const rewind = useCallback(() => {
    const ws = wsRef.current
    if (!ws) return
    const current = ws.getCurrentTime()
    ws.seekTo(Math.max(0, current - 5) / (ws.getDuration() || 1))
  }, [])

  const setSpeed = useCallback((rate: number) => {
    wsRef.current?.setPlaybackRate(rate)
  }, [])

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div ref={containerRef} data-testid="waveform" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={rewind}
          aria-label="Rewind 5 seconds"
          className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
        >
          {/* rewind icon */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-1 ml-auto">
          {SPEED_OPTIONS.map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => setSpeed(rate)}
              aria-label={`Set speed to ${rate}x`}
              className="px-2 py-1 text-xs rounded hover:bg-gray-100 text-gray-600"
            >
              {rate}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export { wsRef as audioPlayerRef }
