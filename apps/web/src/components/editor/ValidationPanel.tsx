import type { ValidationErrorDto } from '@transcribe/shared-types'
import { useEditorStore } from '../../store/editorStore'

interface ValidationPanelProps {
  onErrorClick?: (error: ValidationErrorDto) => void
}

export default function ValidationPanel({ onErrorClick }: ValidationPanelProps) {
  const errors = useEditorStore((s) => s.validationErrors)
  const unresolved = errors.filter((e) => !e.isResolved)

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Validation ({unresolved.length} issue{unresolved.length !== 1 ? 's' : ''})
      </h3>

      {unresolved.length === 0 ? (
        <p className="text-xs text-gray-400">No issues found.</p>
      ) : (
        <ul className="space-y-2">
          {unresolved.map((err) => (
            <li
              key={err.id}
              role="button"
              tabIndex={0}
              onClick={() => onErrorClick?.(err)}
              onKeyDown={(e) => e.key === 'Enter' && onErrorClick?.(err)}
              className="text-xs p-2 rounded border border-red-100 bg-red-50 cursor-pointer hover:bg-red-100"
            >
              <span className="font-medium text-red-700">{err.errorType}</span>
              <span className="text-red-600 ml-1">— {err.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
