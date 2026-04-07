import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from './config';

export const AUDIO_QUERY_KEY = ['audio'] as const;

export interface AudioFileDto {
  id: string;
  filename: string;
  storage_url: string;
  transcription_status?: string;
  transcript_id?: string;
  created_at: string;
}

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
  };
};

export function useAudioList() {
  return useQuery({
    queryKey: AUDIO_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch(getApiUrl('/audio-files'), { headers: getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch audio list');
      return response.json() as Promise<AudioFileDto[]>;
    },
    refetchInterval: 5000,
  });
}

export function useAudio(id: string) {
  return useQuery({
    queryKey: [...AUDIO_QUERY_KEY, id],
    queryFn: async () => {
      const response = await fetch(getApiUrl(`/audio-files/${id}`), { headers: getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch audio file');
      return response.json() as Promise<AudioFileDto>;
    },
    enabled: !!id,
  });
}

export interface UploadAudioParams {
  file: File;
}

export function useUploadAudio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file }: UploadAudioParams) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(getApiUrl('/upload'), {
        method: 'POST',
        headers: getHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json() as Promise<AudioFileDto>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUDIO_QUERY_KEY });
    },
  });
}

export function useDeleteAudio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(getApiUrl(`/audio-files/${id}`), {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!response.ok) throw new Error('Delete failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUDIO_QUERY_KEY });
    },
  });
}

export function useTranscribeAudio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      audioFileId,
      provider = 'whisperx',
    }: {
      audioFileId: string;
      provider?: 'openai' | 'iflytek' | 'whisperx';
    }) => {
      const response = await fetch(getApiUrl('/transcribe'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({
          audioFileId,
          provider,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }

      return response.json() as Promise<{ status: string; audioFileId: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUDIO_QUERY_KEY });
    },
  });
}

