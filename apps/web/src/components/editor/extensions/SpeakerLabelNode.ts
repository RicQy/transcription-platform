import { Node, mergeAttributes } from '@tiptap/core'

export const SpeakerLabelNode = Node.create({
  name: 'speakerLabel',

  group: 'inline',
  inline: true,
  atom: true, // non-editable

  addAttributes() {
    return {
      speaker: {
        default: 'Speaker',
        parseHTML: (el) => el.getAttribute('data-speaker'),
        renderHTML: (attrs) => ({ 'data-speaker': attrs.speaker }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="speaker-label"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'speaker-label',
        class:
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2 select-none cursor-default',
        contenteditable: 'false',
      }),
      HTMLAttributes['data-speaker'] ?? 'Speaker',
    ]
  },
})
