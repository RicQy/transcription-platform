import { useEffect, useRef, useCallback } from 'react'
import type { Editor } from '@tiptap/react'

const AUTOSAVE_DELAY_MS = 30_000

interface UseAutoSaveOptions {
  editor: Editor | null
  onSave: () => Promise<void> | void
}

/**
 * Triggers onSave after 30 s of inactivity and on editor blur.
 */
export function useAutoSave({ editor, onSave }: UseAutoSaveOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const scheduleAutoSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSaveRef.current()
    }, AUTOSAVE_DELAY_MS)
  }, [])

  useEffect(() => {
    if (!editor) return

    // Save on content update (debounced)
    editor.on('update', scheduleAutoSave)

    // Save immediately on blur
    const handleBlur = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      onSaveRef.current()
    }
    editor.on('blur', handleBlur)

    return () => {
      editor.off('update', scheduleAutoSave)
      editor.off('blur', handleBlur)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [editor, scheduleAutoSave])
}
