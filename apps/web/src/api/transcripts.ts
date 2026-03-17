import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TranscriptDto, TranscriptSegmentDto } from '@transcribe/shared-types'
import { apiClient } from './auth'

export const TRANSCRIPT_QUERY_KEY = (id: string) => ['transcript', id] as const

export function useTranscript(id: string) {
  return useQuery({
    queryKey: TRANSCRIPT_QUERY_KEY(id),
    queryFn: async () => {
      const res = await apiClient.get<TranscriptDto>(`/transcripts/${id}`)
      return res.data
    },
    enabled: !!id,
  })
}

export function useSaveSegments(transcriptId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (segments: TranscriptSegmentDto[]) => {
      const res = await apiClient.put<TranscriptDto>(
        `/transcripts/${transcriptId}/segments`,
        { segments },
      )
      return res.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(TRANSCRIPT_QUERY_KEY(transcriptId), data)
    },
  })
}
