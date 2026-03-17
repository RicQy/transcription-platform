import { create } from 'zustand';
import type { ValidationErrorDto, StyleGuideRuleDto } from '@transcribe/shared-types';

interface EditorState {
  currentTime: number;
  isPlaying: boolean;
  validationErrors: ValidationErrorDto[];
  activeGuideRules: StyleGuideRuleDto[];
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setValidationErrors: (errors: ValidationErrorDto[]) => void;
  setActiveGuideRules: (rules: StyleGuideRuleDto[]) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  currentTime: 0,
  isPlaying: false,
  validationErrors: [],
  activeGuideRules: [],
  setCurrentTime: (currentTime) => set({ currentTime }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setValidationErrors: (validationErrors) => set({ validationErrors }),
  setActiveGuideRules: (activeGuideRules) => set({ activeGuideRules }),
}));
