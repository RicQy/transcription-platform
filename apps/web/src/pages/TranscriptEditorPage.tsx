import * as React from 'react';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { insforge } from '../api/insforge';
import { useAudio } from '../api/audio';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TranscriptContent {
  raw: string;
  llm_cleaned?: string;
  formatted: string;
  applied_style_guide: string | null;
  cvl_score?: number;
  cvl_violations_count?: number;
  cvl_stats?: Record<string, number>;
}

interface Transcript {
  id: string;
  audio_file_id: string;
  style_guide_id: string | null;
  content: TranscriptContent | null;
  raw_transcription: string | null;
  full_text: string | null;
  status: string;
  created_at: string;
}

// ─── CVL Score Badge ─────────────────────────────────────────────────────────

function CVLScoreBadge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 90) return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', ring: 'ring-emerald-500/20', label: 'Excellent' };
    if (s >= 75) return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', ring: 'ring-blue-500/20', label: 'Good' };
    if (s >= 50) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', ring: 'ring-amber-500/20', label: 'Fair' };
    return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', ring: 'ring-red-500/20', label: 'Needs Review' };
  };

  const colors = getColor(score);

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${colors.bg} ${colors.border}`}>
      <div className="relative">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-gray-200"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className={colors.text}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${score}, 100`}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${colors.text}`}>
          {score}
        </span>
      </div>
      <div>
        <p className={`text-sm font-semibold ${colors.text}`}>CVL Compliance</p>
        <p className="text-xs text-gray-500">{colors.label}</p>
      </div>
    </div>
  );
}

// ─── CVL Stats Panel ─────────────────────────────────────────────────────────

const RULE_LABELS: Record<string, { label: string; icon: string }> = {
  'speaker-labels':      { label: 'Speaker Labels',      icon: '👤' },
  'tags':                { label: 'Tag Handling',         icon: '🏷️' },
  'filler-removal':      { label: 'Filler Removal',      icon: '🔇' },
  'slang-normalization': { label: 'Slang Normalization',  icon: '📝' },
  'false-starts':        { label: 'False Starts',         icon: '↩️' },
  'punctuation':         { label: 'Punctuation',          icon: '✏️' },
  'capitalization':      { label: 'Capitalization',       icon: '🔤' },
};

function CVLStatsPanel({ stats, totalViolations }: { stats: Record<string, number>; totalViolations: number }) {
  const entries = Object.entries(stats).filter(([, count]) => count > 0);

  if (entries.length === 0) {
    return (
      <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
        <p className="text-sm text-emerald-700 font-medium">✅ No corrections needed — transcript is fully CVL compliant</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">CVL Corrections Applied</h3>
        <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
          {totalViolations} total
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {entries.map(([ruleId, count]) => {
          const rule = RULE_LABELS[ruleId] || { label: ruleId, icon: '📋' };
          return (
            <div key={ruleId} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-sm">{rule.icon}</span>
                <span className="text-sm text-gray-700">{rule.label}</span>
              </div>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {count} {count === 1 ? 'fix' : 'fixes'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Transcript Comparison View ──────────────────────────────────────────────

function ComparisonPanel({ label, text, className = '' }: { label: string; text: string; className?: string }) {
  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</h4>
      </div>
      <pre className="p-4 text-sm text-gray-700 font-mono whitespace-pre-wrap overflow-auto max-h-[300px]">
        {text || '(empty)'}
      </pre>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TranscriptEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: audioFile } = useAudio(id || '');
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [editedText, setEditedText] = useState('');
  const [viewMode, setViewMode] = useState<'editor' | 'compare'>('editor');
  const [isSaving, setIsSaving] = useState(false);
  const [showCVLPanel, setShowCVLPanel] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchTranscript = async () => {
      const { data, error } = await insforge.database
        .from('transcripts')
        .select('*')
        .eq('audio_file_id', id)
        .single();

      if (!error && data) {
        setTranscript(data as Transcript);
        const text =
          (data as Transcript).content?.formatted || (data as Transcript).full_text || '';
        setEditedText(text);
      }
    };

    fetchTranscript();
  }, [id]);

  const handleSave = async () => {
    if (!transcript) return;

    setIsSaving(true);
    try {
      const { error } = await insforge.database
        .from('transcripts')
        .update({
          full_text: editedText,
          content: transcript.content
            ? {
                ...transcript.content,
                formatted: editedText,
              }
            : { raw: '', formatted: editedText },
        })
        .eq('id', transcript.id);

      if (!error) {
        setTranscript((prev) => (prev ? { ...prev, full_text: editedText } : null));
        alert('Transcript saved successfully!');
      }
    } catch (e) {
      console.error('Save failed:', e);
      alert('Failed to save transcript');
    } finally {
      setIsSaving(false);
    }
  };

  if (!audioFile || !transcript) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading transcript...</p>
      </div>
    );
  }

  const rawText = transcript.content?.raw || transcript.raw_transcription || '';
  const llmCleanedText = transcript.content?.llm_cleaned || '';
  const cvlScore = transcript.content?.cvl_score;
  const cvlViolations = transcript.content?.cvl_violations_count ?? 0;
  const cvlStats = transcript.content?.cvl_stats || {};
  const hasCVLData = cvlScore !== undefined && cvlScore !== null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/dashboard" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Transcript Editor</h1>
          <p className="text-gray-600 text-sm mt-1">{audioFile.filename}</p>
        </div>
        <div className="flex items-center gap-3">
          {hasCVLData && (
            <button
              onClick={() => setShowCVLPanel(!showCVLPanel)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {showCVLPanel ? 'Hide QA' : 'Show QA'}
            </button>
          )}
          <button
            onClick={() => setViewMode(viewMode === 'editor' ? 'compare' : 'editor')}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            {viewMode === 'editor' ? 'Compare Layers' : 'Editor'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Style Guide + CVL Info Bar */}
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        {transcript.content?.applied_style_guide && (
          <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-medium">✓ Style guide applied</p>
          </div>
        )}
        {hasCVLData && <CVLScoreBadge score={cvlScore!} />}
      </div>

      {/* Main Content Area */}
      <div className="flex gap-6">
        {/* Editor / Compare Panel */}
        <div className="flex-1 min-w-0">
          {viewMode === 'editor' ? (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">CVL-Compliant Output</span>
                  {hasCVLData && (
                    <span className="text-xs text-gray-400">
                      {cvlViolations} correction{cvlViolations !== 1 ? 's' : ''} applied
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">{audioFile.filename}</div>
              </div>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full h-[500px] p-4 border-0 focus:ring-0 resize-none font-mono text-sm"
                placeholder="Transcript will appear here..."
              />
            </div>
          ) : (
            <div className="space-y-4">
              <ComparisonPanel label="Layer 1 — ASR Raw Output" text={rawText} />
              {llmCleanedText && (
                <ComparisonPanel label="Layer 2 — LLM Cleanup" text={llmCleanedText} />
              )}
              <ComparisonPanel
                label="Layer 3 — CVL Enforced Output"
                text={editedText}
                className="ring-2 ring-blue-200"
              />
            </div>
          )}
        </div>

        {/* CVL QA Sidebar */}
        {hasCVLData && showCVLPanel && (
          <div className="w-72 flex-shrink-0 space-y-4">
            <CVLStatsPanel stats={cvlStats} totalViolations={cvlViolations} />
          </div>
        )}
      </div>
    </div>
  );
}
