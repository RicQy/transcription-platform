import { Node, mergeAttributes } from '@tiptap/core'

export interface TranscriptBlockOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    transcriptBlock: {
      setTranscriptBlock: (attrs: { speaker: string; segmentId: string }) => ReturnType
    }
  }
}

export const TranscriptBlockNode = Node.create<TranscriptBlockOptions>({
  name: 'transcriptBlock',

  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      speaker: {
        default: 'Speaker',
        parseHTML: (el) => el.getAttribute('data-speaker'),
        renderHTML: (attrs) => ({ 'data-speaker': attrs.speaker }),
      },
      segmentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-segment-id'),
        renderHTML: (attrs) => ({ 'data-segment-id': attrs.segmentId }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="transcript-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'transcript-block',
        class: 'transcript-block mb-4 border-l-4 border-blue-200 pl-3',
      }),
      [
        'div',
        {
          class: 'speaker-label text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1 select-none',
          contenteditable: 'false',
        },
        HTMLAttributes['data-speaker'] ?? 'Speaker',
      ],
      ['div', { class: 'transcript-content' }, 0],
    ]
  },

  addCommands() {
    return {
      setTranscriptBlock:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs)
        },
    }
  },
})
