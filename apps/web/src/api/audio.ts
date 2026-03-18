import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AudioFileDto } from '@transcribe/shared-types';
import { apiClient } from './auth';

export const AUDIO_QUERY_KEY = ['audio'] as const;

export function useAudioList() {
  return useQuery({
    queryKey: AUDIO_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<AudioFileDto[]>('/audio');
      return res.data;
    },
    refetchInterval: 5000,
  });
}

export function useAudio(id: string) {
  return useQuery({
    queryKey: [...AUDIO_QUERY_KEY, id],
    queryFn: async () => {
      const res = await apiClient.get<AudioFileDto>(`/audio/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function streamAudioUrl(id: string): string {
  return `/api/audio/${id}/stream`;
}

export interface UploadAudioParams {
  file: File;
  onProgress?: (percent: number) => void;
}

export function useUploadAudio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, onProgress }: UploadAudioParams) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiClient.post<AudioFileDto>('/audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total && onProgress) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      });
      return res.data;
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
      await apiClient.delete(`/audio/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUDIO_QUERY_KEY });
    },
  });
}
