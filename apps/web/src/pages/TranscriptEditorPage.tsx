import * as React from 'react';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { insforge } from '../api/insforge';
import { useAudio } from '../api/audio';

interface TranscriptContent {
  raw: string;
  formatted: string;
  applied_style_guide: string | null;
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

export default function TranscriptEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: audioFile } = useAudio(id || '');
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [editedText, setEditedText] = useState('');
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [isSaving, setIsSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/dashboard" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Transcript Editor</h1>
          <p className="text-gray-600 text-sm mt-1">{audioFile.filename}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {showRaw ? 'Hide Raw' : 'Show Raw'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {transcript.content?.applied_style_guide && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">Style guide applied to this transcript</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('formatted')}
              className={`px-3 py-1.5 text-sm rounded-md ${
                viewMode === 'formatted'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Formatted
            </button>
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

      {showRaw && rawText && (
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Raw Whisper Output</h3>
            <p className="text-xs text-gray-500 mt-1">
              Original transcription before style guide formatting
            </p>
          </div>
          <div className="p-4">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
              {typeof rawText === 'string' ? rawText : JSON.stringify(rawText, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
