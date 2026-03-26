import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { insforge } from './insforge';

export const AUDIO_QUERY_KEY = ['audio'] as const;

export interface AudioFileDto {
  id: string;
  filename: string;
  storage_key: string;
  storage_url: string;
  duration: number | null;
  status: string;
  transcription_status?: string;
  transcript_id?: string;
  created_at: string;
}

export function useAudioList() {
  return useQuery({
    queryKey: AUDIO_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await insforge.database
        .from('audio_files')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as AudioFileDto[];
    },
    refetchInterval: 5000,
  });
}

export function useAudio(id: string) {
  return useQuery({
    queryKey: [...AUDIO_QUERY_KEY, id],
    queryFn: async () => {
      const { data, error } = await insforge.database
        .from('audio_files')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as AudioFileDto;
    },
    enabled: !!id,
  });
}

export function streamAudioUrl(storageUrl: string): string {
  return storageUrl;
}

export interface UploadAudioParams {
  file: File;
  onProgress?: (percent: number) => void;
}

export function useUploadAudio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, onProgress }: UploadAudioParams) => {
      const key = `audio/${Date.now()}-${file.name}`;

      const { data: uploadData, error: uploadError } = await insforge.storage.from('audio-files').upload(key, file);

      if (uploadError) throw uploadError;

      const url = uploadData?.url || insforge.storage.from('audio-files').getPublicUrl(key);

      const { data: dbData, error: dbError } = await insforge.database
        .from('audio_files')
        .insert([
          {
            filename: file.name,
            storage_key: key,
            storage_url: url,
            status: 'UPLOADED',
          },
        ])
        .select()
        .single();

      if (dbError) throw dbError;
      return dbData as AudioFileDto;
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
      const { data: audio } = await insforge.database
        .from('audio_files')
        .select('storage_key')
        .eq('id', id)
        .single();

      if (audio?.storage_key) {
        await insforge.storage.from('audio-files').remove(audio.storage_key);
      }

      const { error } = await insforge.database.from('audio_files').delete().eq('id', id);

      if (error) throw error;
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
      provider = 'openai',
    }: {
      audioFileId: string;
      provider?: 'openai' | 'iflytek';
    }) => {
      const response = await fetch(
        `${import.meta.env.VITE_INSFORGE_URL}/functions/whisper-transcribe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audioFileId,
            useDiarization: true,
            provider,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUDIO_QUERY_KEY });
    },
  });
}
