import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { WordData } from '@transcribe/shared-types'

export const WORD_TIMESTAMP_KEY = new PluginKey('wordTimestamp')

/**
 * Builds a flat array of word decorations from segment word data stored on
 * the document's top-level nodes via a `wordData` attribute.
 */
export const WordTimestampPlugin = Extension.create({
  name: 'wordTimestamp',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: WORD_TIMESTAMP_KEY,
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, _old, _oldState, newState) {
            const decorations: Decoration[] = []

            newState.doc.descendants((node, pos) => {
              if (node.type.name !== 'paragraph') return

              const wordDataAttr = node.attrs?.wordData as WordData[] | undefined
              if (!wordDataAttr?.length) return

              let offset = pos + 1 // +1 for the paragraph open token
              for (const w of wordDataAttr) {
                const from = offset
                const to = from + w.word.length
                decorations.push(
                  Decoration.inline(from, to, {
                    'data-start': String(w.start),
                    'data-end': String(w.end),
                    'data-confidence': String(w.confidence),
                    'data-speaker-id': w.speakerId,
                    class: 'word-token cursor-pointer hover:bg-yellow-50',
                  }),
                )
                offset = to + 1 // +1 for the space between words
              }
            })

            return DecorationSet.create(newState.doc, decorations)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})
