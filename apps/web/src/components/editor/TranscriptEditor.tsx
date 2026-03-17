import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { Editor } from '@tiptap/core'
import type { TranscriptSegmentDto } from '@transcribe/shared-types'
import { TranscriptBlockNode } from './extensions/TranscriptBlockNode'
import { SpeakerLabelNode } from './extensions/SpeakerLabelNode'
import { WordTimestampPlugin } from './extensions/WordTimestampPlugin'
import { TagNode } from './extensions/TagNode'
import TagPicker from './TagPicker'
import { useEditorStore } from '../../store/editorStore'

interface TranscriptEditorProps {
  segments: TranscriptSegmentDto[]
  onEditorReady?: (editor: Editor) => void
  onPlayPause?: () => void
  onRewind?: () => void
  onSpeedChange?: (delta: number) => void
}

function buildInitialContent(segments: TranscriptSegmentDto[]) {
  return {
    type: 'doc',
    content: segments.map((seg) => ({
      type: 'transcriptBlock',
      attrs: { speaker: seg.speaker, segmentId: seg.id },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: seg.text }],
        },
      ],
    })),
  }
}

export default function TranscriptEditor({
  segments,
  onEditorReady,
  onPlayPause,
  onRewind,
  onSpeedChange,
}: TranscriptEditorProps) {
  const { isPlaying } = useEditorStore()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: { depth: 50 } }),
      TranscriptBlockNode,
      SpeakerLabelNode,
      WordTimestampPlugin,
      TagNode,
    ],
    content: buildInitialContent(segments),
    onCreate({ editor: e }) {
      onEditorReady?.(e)
    },
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[200px] p-4',
        'data-testid': 'transcript-editor',
      },
      handleKeyDown(_view, event) {
        // Space → play/pause (only when not typing in an input)
        if (event.code === 'Space' && event.target === _view.dom) {
          event.preventDefault()
          onPlayPause?.()
          return true
        }
        // Tab → rewind 5s
        if (event.code === 'Tab') {
          event.preventDefault()
          onRewind?.()
          return true
        }
        // Ctrl+Shift+Up → speed up
        if (event.ctrlKey && event.shiftKey && event.code === 'ArrowUp') {
          event.preventDefault()
          onSpeedChange?.(1)
          return true
        }
        // Ctrl+Shift+Down → speed down
        if (event.ctrlKey && event.shiftKey && event.code === 'ArrowDown') {
          event.preventDefault()
          onSpeedChange?.(-1)
          return true
        }
        return false
      },
    },
  })

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Transcript editor toolbar"
        className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50"
      >
        <TagPicker editor={editor} />
        <span className="text-xs text-gray-400 ml-auto" aria-live="polite">
          {isPlaying ? '▶ Playing' : '⏸ Paused'} · Space=play · Tab=rewind · Ctrl+Shift+↑↓=speed
        </span>
      </div>
      <EditorContent editor={editor} aria-label="Transcript text editor" />
    </div>
  )
}
