import { useState, useRef, useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { useEditorStore } from '../../store/editorStore'

const DEFAULT_TAGS = ['[inaudible]', '[crosstalk]', '[noise]', '[laughter]', '[music]']

interface TagPickerProps {
  editor: Editor | null
}

export default function TagPicker({ editor }: TagPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const activeRules = useEditorStore((s) => s.activeGuideRules)

  // Derive tag list from active TagUsage rules, fall back to defaults
  const tagRules = activeRules.filter((r) => r.ruleType === 'TagUsage')
  const tags =
    tagRules.length > 0
      ? tagRules.map((r) => r.ruleText.match(/\[[\w\s]+\]/)?.[0] ?? r.ruleText)
      : DEFAULT_TAGS

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const insertTag = (tag: string) => {
    editor?.chain().focus().insertTag(tag).run()
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
      >
        Insert Tag ▾
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Available tags"
          className="absolute z-10 mt-1 w-40 bg-white border border-gray-200 rounded shadow-lg py-1"
        >
          {tags.map((tag) => (
            <li
              key={tag}
              role="option"
              aria-selected={false}
              onClick={() => insertTag(tag)}
              onKeyDown={(e) => e.key === 'Enter' && insertTag(tag)}
              tabIndex={0}
              className="px-3 py-1.5 text-xs font-mono cursor-pointer hover:bg-gray-50"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
