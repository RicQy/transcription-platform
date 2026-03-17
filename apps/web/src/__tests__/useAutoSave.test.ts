import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutoSave } from '../hooks/useAutoSave'
import type { Editor } from '@tiptap/react'

function createMockEditor() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
  return {
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] ?? []
      listeners[event].push(cb)
    }),
    off: vi.fn(),
    emit: (event: string, ...args: unknown[]) => {
      listeners[event]?.forEach((cb) => cb(...args))
    },
  } as unknown as Editor & { emit: (event: string, ...args: unknown[]) => void }
}

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onSave after 30 seconds of inactivity', () => {
    const onSave = vi.fn()
    const editor = createMockEditor()

    renderHook(() => useAutoSave({ editor, onSave }))

    // Simulate an update event
    ;(editor as ReturnType<typeof createMockEditor>).emit('update')

    // Advance time by 30 seconds
    vi.advanceTimersByTime(30_000)

    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('resets the timer on each update', () => {
    const onSave = vi.fn()
    const editor = createMockEditor()

    renderHook(() => useAutoSave({ editor, onSave }))

    ;(editor as ReturnType<typeof createMockEditor>).emit('update')
    vi.advanceTimersByTime(15_000)

    // Another update resets the 30s timer
    ;(editor as ReturnType<typeof createMockEditor>).emit('update')
    vi.advanceTimersByTime(15_000)

    // Only 15s since last update — should NOT have saved yet
    expect(onSave).not.toHaveBeenCalled()

    vi.advanceTimersByTime(15_000)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('calls onSave immediately on blur', () => {
    const onSave = vi.fn()
    const editor = createMockEditor()

    renderHook(() => useAutoSave({ editor, onSave }))

    ;(editor as ReturnType<typeof createMockEditor>).emit('blur')

    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('does nothing when editor is null', () => {
    const onSave = vi.fn()
    renderHook(() => useAutoSave({ editor: null, onSave }))
    vi.advanceTimersByTime(30_000)
    expect(onSave).not.toHaveBeenCalled()
  })
})
