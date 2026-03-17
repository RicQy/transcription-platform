import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { StyleGuideDocumentDto, StyleGuideRuleDto } from '@transcribe/shared-types'
import { apiClient } from './auth'

export const GUIDES_KEY = ['style-guides'] as const
export const RULES_KEY = (guideId: string) => ['style-guide-rules', guideId] as const

export function useStyleGuides() {
  return useQuery({
    queryKey: GUIDES_KEY,
    queryFn: async () => {
      const res = await apiClient.get<StyleGuideDocumentDto[]>('/style-guide')
      return res.data
    },
  })
}

export function useStyleGuideRules(guideId: string) {
  return useQuery({
    queryKey: RULES_KEY(guideId),
    queryFn: async () => {
      const res = await apiClient.get<StyleGuideRuleDto[]>(`/style-guide/${guideId}/rules`)
      return res.data
    },
    enabled: !!guideId,
  })
}

export function useActivateGuide() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (guideId: string) => {
      const res = await apiClient.post(`/style-guide/${guideId}/activate`)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GUIDES_KEY }),
  })
}

export function useUploadGuide() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, version, onProgress }: { file: File; version?: string; onProgress?: (p: number) => void }) => {
      const form = new FormData()
      form.append('pdf', file)
      if (version) form.append('version', version)
      const res = await apiClient.post('/style-guide', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      return res.data as { guideId: string; version: string }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GUIDES_KEY }),
  })
}

export function useAddRule(guideId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { ruleType: string; ruleText: string; sourcePage?: number }) => {
      const res = await apiClient.post(`/style-guide/${guideId}/rules`, data)
      return res.data as StyleGuideRuleDto
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY(guideId) }),
  })
}

export function useUpdateRule(guideId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ruleId, ...data }: { ruleId: string; ruleType?: string; ruleText?: string; sourcePage?: number }) => {
      const res = await apiClient.put(`/style-guide/${guideId}/rules/${ruleId}`, data)
      return res.data as StyleGuideRuleDto
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY(guideId) }),
  })
}

export function useDeleteRule(guideId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ruleId: string) => {
      await apiClient.delete(`/style-guide/${guideId}/rules/${ruleId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY(guideId) }),
  })
}
