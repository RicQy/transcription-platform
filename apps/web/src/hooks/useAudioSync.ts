import { useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import type WaveSurfer from 'wavesurfer.js'
import { useEditorStore } from '../store/editorStore'

const HIGHLIGHT_CLASS = 'word-active'

/**
 * Subscribes to editorStore.currentTime, binary-searches the word decorations
 * in the TipTap document, and highlights the current word.
 */
export function useAudioSync(editor: Editor | null, wsRef: React.RefObject<WaveSurfer | null>) {
  const currentTime = useEditorStore((s) => s.currentTime)
  const lastHighlightedRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!editor) return

    // Remove previous highlight
    if (lastHighlightedRef.current) {
      lastHighlightedRef.current.classList.remove(HIGHLIGHT_CLASS)
      lastHighlightedRef.current = null
    }

    // Find the word span whose [data-start, data-end] bracket currentTime
    const editorEl = editor.view.dom as HTMLElement
    const wordSpans = editorEl.querySelectorAll<HTMLElement>('[data-start][data-end]')

    // Binary search for the active word
    let lo = 0
    let hi = wordSpans.length - 1
    let found: HTMLElement | null = null

    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const span = wordSpans[mid]
      const start = parseFloat(span.dataset.start ?? '0')
      const end = parseFloat(span.dataset.end ?? '0')

      if (currentTime >= start && currentTime <= end) {
        found = span
        break
      } else if (currentTime < start) {
        hi = mid - 1
      } else {
        lo = mid + 1
      }
    }

    if (found) {
      found.classList.add(HIGHLIGHT_CLASS)
      lastHighlightedRef.current = found
    }
  }, [currentTime, editor])

  // Click-to-seek: clicking a word span seeks the audio
  useEffect(() => {
    if (!editor) return

    const editorEl = editor.view.dom as HTMLElement

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-start]')
      if (!target || !wsRef.current) return
      const start = parseFloat(target.dataset.start ?? '0')
      const duration = wsRef.current.getDuration()
      if (duration > 0) {
        wsRef.current.seekTo(start / duration)
      }
    }

    editorEl.addEventListener('click', handleClick)
    return () => editorEl.removeEventListener('click', handleClick)
  }, [editor, wsRef])
}
