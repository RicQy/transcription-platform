import * as React from 'react';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getApiUrl } from '../api/config';
import { useAudio } from '../api/audio';
import { SpeakerLabeler } from '../components/SpeakerLabeler';
import EvaluationViewer from '../components/EvaluationViewer';
import { evaluationApi, EvaluationData } from '../api/evaluations';
import { ExportService } from '../services/export.service';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

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
  const [goldText, setGoldText] = useState('');
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showEvalPanel, setShowEvalPanel] = useState(false);
  const [jurisdiction, setJurisdiction] = useState('LEGAL TRANSCRIPT');

  useEffect(() => {
    if (!transcript?.style_guide_id) return;
    const fetchGuide = async () => {
      const response = await fetch(getApiUrl(`/style-guides`), { headers: getHeaders() });
      if (response.ok) {
        const guides = await response.json();
        const guide = guides.find((g: any) => g.id === transcript.style_guide_id);
        if (guide?.jurisdiction) setJurisdiction(guide.jurisdiction);
      }
    };
    fetchGuide();
  }, [transcript?.style_guide_id]);

  useEffect(() => {
    if (!id) return;

    const fetchTranscript = async () => {
      const response = await fetch(getApiUrl(`/transcripts/${id}`), { headers: getHeaders() });
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setTranscript(data as Transcript);
          const text = (data as Transcript).content?.formatted || (data as Transcript).full_text || '';
          setEditedText(text);
        }
      }
    };

    fetchTranscript();
  }, [id]);

  const handleSave = async () => {
    if (!transcript) return;

    setIsSaving(true);
    try {
      const response = await fetch(getApiUrl(`/transcripts/${transcript.id}`), {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          full_text: editedText,
          content: transcript.content
            ? {
                ...transcript.content,
                formatted: editedText,
              }
            : { raw: '', formatted: editedText },
        }),
      });

      if (response.ok) {
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
          
          <div className="relative inline-block text-left group">
            <button className="px-3 py-1.5 text-sm bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors font-medium">
              Export ▾
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg hidden group-hover:block z-50">
              <div className="py-1">
                <button
                  onClick={() => ExportService.toPDF(editedText, { 
                    filename: `Transcript_${audioFile.filename.split('.')[0]}`,
                    jurisdiction: jurisdiction,
                    title: audioFile.filename,
                    transcriptId: transcript.id
                  })}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Download PDF (Legal)
                </button>
                <button
                  onClick={() => ExportService.toDOCX(editedText, { 
                    filename: `Transcript_${audioFile.filename.split('.')[0]}`,
                    jurisdiction: jurisdiction,
                    title: audioFile.filename,
                    transcriptId: transcript.id
                  })}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Download DOCX (.docx)
                </button>
              </div>
            </div>
          </div>

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

        {/* Sidebars */}
        <div className="w-72 flex-shrink-0 space-y-4">
          <SpeakerLabeler audioFileId={id || ''} />
          {hasCVLData && showCVLPanel && (
            <CVLStatsPanel stats={cvlStats} totalViolations={cvlViolations} />
          )}

          {/* Quality Audit Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Quality Audit</h3>
              <button 
                onClick={() => setShowEvalPanel(!showEvalPanel)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {evaluation ? 'View Stats' : 'Run Evaluation'}
              </button>
            </div>

            {!evaluation && (
              <div className="space-y-3 font-humanist">
                <p className="text-xs text-gray-500">
                  Compare against an official Gold Standard transcript to measure accuracy.
                </p>
                <textarea
                  placeholder="Paste official transcript here..."
                  value={goldText}
                  onChange={(e) => setGoldText(e.target.value)}
                  className="w-full h-32 text-xs border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-all p-2"
                />
                <button
                  disabled={!goldText || isEvaluating}
                  onClick={async () => {
                    if (!transcript) return;
                    setIsEvaluating(true);
                    try {
                      const data = await evaluationApi.runEvaluation(transcript.id, goldText);
                      setEvaluation(data);
                    } catch (e) {
                      console.error('Evaluation failed:', e);
                      alert('Failed to run evaluation');
                    } finally {
                      setIsEvaluating(false);
                    }
                  }}
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                    !goldText || isEvaluating 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 hover:shadow-indigo-200'
                  }`}
                >
                  {isEvaluating ? 'Calculating Metrics...' : 'Calculate Accuracy'}
                </button>
              </div>
            )}

            {evaluation && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs mb-1">
                   <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-gray-600 font-medium">Audit Complete</span>
                   </div>
                   <button 
                    onClick={() => setEvaluation(null)}
                    className="text-gray-400 hover:text-red-500"
                   >
                     Reset
                   </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-indigo-50 rounded-lg py-2">
                    <div className="text-sm font-bold text-indigo-700">{evaluation.wer}%</div>
                    <div className="text-[10px] text-indigo-500 uppercase font-medium">WER</div>
                  </div>
                   <div className="bg-emerald-50 rounded-lg py-2">
                    <div className="text-sm font-bold text-emerald-700">{evaluation.cer}%</div>
                    <div className="text-[10px] text-emerald-500 uppercase font-medium">CER</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {evaluation && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
              <div className="max-w-4xl w-full">
                <div className="mb-4 flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white font-humanist">Deep Quality Audit Analysis</h2>
                  <button 
                    onClick={() => setEvaluation(null)}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-all"
                  >
                    Close Analysis
                  </button>
                </div>
                <EvaluationViewer data={evaluation} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
