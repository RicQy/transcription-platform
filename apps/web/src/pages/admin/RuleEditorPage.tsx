import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStyleGuideRules, useAddRule, useUpdateRule, useDeleteRule } from '../../api/styleGuide'
import type { StyleGuideRuleDto } from '@transcribe/shared-types'

export default function RuleEditorPage() {
  const { guideId = '' } = useParams<{ guideId: string }>()
  const { data: rules, isLoading } = useStyleGuideRules(guideId)
  const { mutate: addRule, isPending: isAdding } = useAddRule(guideId)
  const { mutate: updateRule } = useUpdateRule(guideId)
  const { mutate: deleteRule } = useDeleteRule(guideId)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<StyleGuideRuleDto>>({})
  const [newRule, setNewRule] = useState({ ruleType: 'Other', ruleText: '' })

  const startEdit = (rule: StyleGuideRuleDto) => {
    setEditingId(rule.id)
    setEditValues({ ruleType: rule.ruleType, ruleText: rule.ruleText, sourcePage: rule.sourcePage ?? undefined })
  }

  const saveEdit = (ruleId: string) => {
    updateRule({ ruleId, ...editValues })
    setEditingId(null)
  }

  const handleAdd = () => {
    if (!newRule.ruleText.trim()) return
    addRule(newRule, { onSuccess: () => setNewRule({ ruleType: 'Other', ruleText: '' }) })
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Rules</h1>

      {isLoading && <p className="text-gray-500">Loading rules…</p>}

      {rules && (
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Page</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rules.map((rule) => (
                <tr key={rule.id}>
                  {editingId === rule.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          value={editValues.ruleType ?? ''}
                          onChange={(e) => setEditValues((v) => ({ ...v, ruleType: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          data-testid={`edit-type-${rule.id}`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={editValues.ruleText ?? ''}
                          onChange={(e) => setEditValues((v) => ({ ...v, ruleText: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          data-testid={`edit-text-${rule.id}`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editValues.sourcePage ?? ''}
                          onChange={(e) => setEditValues((v) => ({ ...v, sourcePage: parseInt(e.target.value) || undefined }))}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2 flex gap-2">
                        <button type="button" onClick={() => saveEdit(rule.id)} className="text-xs text-green-600 hover:underline" data-testid={`save-${rule.id}`}>Save</button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm text-gray-700">{rule.ruleType}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{rule.ruleText}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{rule.sourcePage ?? '—'}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <button type="button" onClick={() => startEdit(rule)} className="text-xs text-blue-600 hover:underline" data-testid={`edit-${rule.id}`}>Edit</button>
                        <button type="button" onClick={() => deleteRule(rule.id)} className="text-xs text-red-600 hover:underline" data-testid={`delete-${rule.id}`}>Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add new rule */}
      <div className="bg-white shadow rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Rule</h2>
        <div className="flex gap-3">
          <select
            value={newRule.ruleType}
            onChange={(e) => setNewRule((v) => ({ ...v, ruleType: e.target.value }))}
            aria-label="Rule type"
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            {['SpeakerFormatting','TagUsage','FillerWordHandling','PunctuationConvention','CapitalizationRule','TimestampRequirement','FormattingExample','Other'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="text"
            value={newRule.ruleText}
            onChange={(e) => setNewRule((v) => ({ ...v, ruleText: e.target.value }))}
            placeholder="Rule description…"
            className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
            data-testid="new-rule-text"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={isAdding || !newRule.ruleText.trim()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            data-testid="add-rule-btn"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
