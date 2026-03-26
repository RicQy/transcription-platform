import * as React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AudioStatus } from '@transcribe/shared-types';
import type { TranscriptStatusEvent } from '@transcribe/shared-types';
import {
  useAudioList,
  AUDIO_QUERY_KEY,
  useDeleteAudio,
  useTranscribeAudio,
  type AudioFileDto,
} from '../api/audio';
import { useSocket } from '../hooks/useSocket';

const STATUS_LABELS: Record<string, string> = {
  UPLOADED: 'Uploaded',
  QUEUED: 'Queued',
  PROCESSING: 'Processing',
  COMPLETE: 'Complete',
  ERROR: 'Error',
};

const STATUS_CLASSES: Record<string, string> = {
  UPLOADED: 'bg-gray-100 text-gray-700',
  QUEUED: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETE: 'bg-green-100 text-green-700',
  ERROR: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[status] || 'bg-gray-100 text-gray-700'}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardPage() {
  const { data: audioFiles, isLoading, isError } = useAudioList();
  const deleteAudio = useDeleteAudio();
  const transcribeAudio = useTranscribeAudio();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState<'openai' | 'iflytek'>('openai');

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && audioFiles) {
      setSelectedIds(new Set(audioFiles.map((f) => f.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} files?`)) {
      try {
        await Promise.all(Array.from(selectedIds).map((id) => deleteAudio.mutateAsync(id)));
        setSelectedIds(new Set());
      } catch (e) {
        console.error('Failed to delete some files', e);
      }
    }
  };

  useEffect(() => {
    const handler = (payload: TranscriptStatusEvent) => {
      queryClient.setQueryData<AudioFileDto[]>(
        AUDIO_QUERY_KEY,
        (prev: AudioFileDto[] | undefined) => {
          if (!prev) return prev;
          return prev.map((file: AudioFileDto) =>
            file.id === payload.audioId ? { ...file, status: payload.status } : file,
          );
        },
      );
    };

    if (!socket) return;
    socket.on('transcript:status', handler);
    return () => {
      socket.off('transcript:status', handler);
    };
  }, [socket, queryClient]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex gap-4">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
            >
              Delete Selected ({selectedIds.size})
            </button>
          )}
          <Link
            to="/audio/upload"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Upload Audio
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading audio files…</p>
        </div>
      )}

      {isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">Failed to load audio files. Please refresh.</p>
        </div>
      )}

      {!isLoading && !isError && (!audioFiles || audioFiles.length === 0) && (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-gray-500 mb-2">No audio files yet.</p>
          <Link to="/audio/upload" className="text-blue-600 hover:underline text-sm">
            Upload your first audio file
          </Link>
        </div>
      )}

      {audioFiles && audioFiles.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={
                      !!audioFiles &&
                      audioFiles.length > 0 &&
                      selectedIds.size === audioFiles.length
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {audioFiles.map((file: AudioFileDto) => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleSelectOne(file.id, e.target.checked)
                      }
                      checked={selectedIds.has(file.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {file.filename}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDuration(file.duration)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(file.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={file.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap flex items-center gap-4 text-sm">
                    {file.status === 'COMPLETE' ||
                    file.transcription_status === 'completed' ||
                    file.transcript_id ? (
                      <Link to={`/editor/${file.id}`} className="text-blue-600 hover:underline">
                        Open Editor
                      </Link>
                    ) : file.transcription_status === 'processing' ? (
                      <span className="text-blue-600">Transcribing...</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={provider}
                          onChange={(e) => setProvider(e.target.value as 'openai' | 'iflytek')}
                          className="text-xs border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="openai">OpenAI</option>
                          <option value="iflytek">iFLYTEK</option>
                        </select>
                        <button
                          onClick={() => transcribeAudio.mutate({ audioFileId: file.id, provider })}
                          disabled={transcribeAudio.isPending}
                          className="text-green-600 hover:underline disabled:opacity-50"
                        >
                          {transcribeAudio.isPending &&
                          transcribeAudio.variables?.audioFileId === file.id
                            ? 'Starting...'
                            : 'Transcribe'}
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this file?')) {
                          deleteAudio.mutate(file.id);
                        }
                      }}
                      className="text-red-600 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
