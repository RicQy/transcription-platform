import { create } from 'zustand'
import type { StyleGuideRuleDto } from '@transcribe/shared-types'

interface StyleGuideState {
  activeRules: StyleGuideRuleDto[]
  setActiveRules: (rules: StyleGuideRuleDto[]) => void
}

export const useStyleGuideStore = create<StyleGuideState>((set) => ({
  activeRules: [],
  setActiveRules: (activeRules) => set({ activeRules }),
}))
