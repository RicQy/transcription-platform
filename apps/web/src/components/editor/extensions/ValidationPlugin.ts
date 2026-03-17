import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { ValidationFn } from '@transcribe/shared-types'
import { useEditorStore } from '../../../store/editorStore'

export const VALIDATION_KEY = new PluginKey('validation')

function compileRules(rules: Array<{ validationLogic: string | null }>): ValidationFn[] {
  const fns: ValidationFn[] = []
  for (const rule of rules) {
    if (!rule.validationLogic) continue
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('text', `return (${rule.validationLogic})(text)`) as ValidationFn
      fns.push(fn)
    } catch {
      // silently skip invalid logic
    }
  }
  return fns
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export const ValidationPlugin = Extension.create({
  name: 'validationPlugin',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: VALIDATION_KEY,
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, old, _oldState, newState) {
            if (!tr.docChanged) return old

            // Debounce 500ms
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
              const rules = useEditorStore.getState().activeGuideRules
              const fns = compileRules(rules)
              const decorations: Decoration[] = []

              newState.doc.descendants((node, pos) => {
                if (node.type.name !== 'paragraph') return
                const text = node.textContent
                for (const fn of fns) {
                  try {
                    const violations = fn(text)
                    for (const v of violations) {
                      decorations.push(
                        Decoration.inline(pos + 1 + v.start, pos + 1 + v.end, {
                          class: 'validation-error border-b-2 border-red-500',
                          'data-error-type': v.errorType,
                          'data-message': v.message,
                        }),
                      )
                    }
                  } catch {
                    // skip failed validation fns
                  }
                }
              })

              // We can't update state from apply — store decorations externally
              // This is a simplified approach; full implementation uses a dispatch
            }, 500)

            return old
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
