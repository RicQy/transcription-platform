import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { WordData } from '@transcribe/shared-types'

export const LOW_CONFIDENCE_KEY = new PluginKey('lowConfidence')
export const LOW_CONFIDENCE_THRESHOLD = 0.7

/**
 * Highlights words with confidence < 0.7 in yellow.
 * Word data is expected to be stored on paragraph nodes via a `wordData` attribute.
 */
export const LowConfidencePlugin = Extension.create({
  name: 'lowConfidencePlugin',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: LOW_CONFIDENCE_KEY,
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(_tr, _old, _oldState, newState) {
            const decorations: Decoration[] = []

            newState.doc.descendants((node, pos) => {
              if (node.type.name !== 'paragraph') return
              const wordData = node.attrs?.wordData as WordData[] | undefined
              if (!wordData?.length) return

              let offset = pos + 1
              for (const w of wordData) {
                if (w.confidence < LOW_CONFIDENCE_THRESHOLD && !w.verified) {
                  decorations.push(
                    Decoration.inline(offset, offset + w.word.length, {
                      class: 'low-confidence bg-yellow-100 border-b border-yellow-400',
                      title: `Confidence: ${Math.round(w.confidence * 100)}%`,
                    }),
                  )
                }
                offset += w.word.length + 1
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
