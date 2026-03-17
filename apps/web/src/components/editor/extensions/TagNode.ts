import { Node, mergeAttributes } from '@tiptap/core'

export interface TagNodeOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tag: {
      insertTag: (tagText: string) => ReturnType
    }
  }
}

export const TagNode = Node.create<TagNodeOptions>({
  name: 'tag',

  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      tagText: {
        default: '[inaudible]',
        parseHTML: (el) => el.getAttribute('data-tag-text'),
        renderHTML: (attrs) => ({ 'data-tag-text': attrs.tagText }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="tag"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'tag',
        class:
          'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-gray-200 text-gray-700 mx-0.5 select-none cursor-default',
        contenteditable: 'false',
      }),
      HTMLAttributes['data-tag-text'] ?? '[tag]',
    ]
  },

  addCommands() {
    return {
      insertTag:
        (tagText: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { tagText },
          })
        },
    }
  },
})
