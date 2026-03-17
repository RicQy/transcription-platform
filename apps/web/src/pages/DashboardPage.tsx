import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AudioStatus } from '@transcribe/shared-types';
import type { AudioFileDto, TranscriptStatusEvent } from '@transcribe/shared-types';
import { useAudioList, AUDIO_QUERY_KEY } from '../api/audio';
import { useSocket } from '../hooks/useSocket';

const STATUS_LABELS: Record<AudioStatus, string> = {
  [AudioStatus.QUEUED]: 'Queued',
  [AudioStatus.PROCESSING]: 'Processing',
  [AudioStatus.COMPLETE]: 'Complete',
  [AudioStatus.ERROR]: 'Error',
};

const STATUS_CLASSES: Record<AudioStatus, string> = {
  [AudioStatus.QUEUED]: 'bg-gray-100 text-gray-700',
  [AudioStatus.PROCESSING]: 'bg-blue-100 text-blue-700',
  [AudioStatus.COMPLETE]: 'bg-green-100 text-green-700',
  [AudioStatus.ERROR]: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: AudioStatus }) {
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
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
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    const handler = (payload: TranscriptStatusEvent) => {
      queryClient.setQueryData<AudioFileDto[]>(AUDIO_QUERY_KEY, (prev) => {
        if (!prev) return prev;
        return prev.map((file) =>
          file.id === payload.audioId ? { ...file, status: payload.status } : file,
        );
      });
    };

    socket.on('transcript:status', handler);
    return () => {
      socket.off('transcript:status', handler);
    };
  }, [socket, queryClient]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/audio/upload"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          Upload Audio
        </Link>
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
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filename
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {audioFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {file.filename}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDuration(file.duration)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(file.uploadDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={file.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {file.status === AudioStatus.COMPLETE ? (
                      <Link
                        to={`/editor/${file.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        Open Editor
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
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
