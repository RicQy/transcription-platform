import { AudioStatus, ErrorType, Role, RuleType } from './enums';

export interface UserDto {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface AudioFileDto {
  id: string;
  filename: string;
  duration: number | null;
  uploadDate: string;
  status: AudioStatus;
}

export interface WordData {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speakerId: string;
  verified?: boolean;
}

export interface TranscriptSegmentDto {
  id: string;
  transcriptId: string;
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number | null;
  wordData: WordData[];
}

export interface TranscriptDto {
  id: string;
  audioFileId: string;
  version: number;
  lastModified: string;
  segments: TranscriptSegmentDto[];
}

export interface StyleGuideRuleDto {
  id: string;
  guideId: string;
  ruleType: RuleType;
  ruleText: string;
  validationLogic: string | null;
  sourcePage: number | null;
  isActive: boolean;
}

export interface StyleGuideDocumentDto {
  id: string;
  version: string;
  uploadDate: string;
  isActive: boolean;
  parsedAt: string | null;
  rules?: StyleGuideRuleDto[];
}

export interface ValidationErrorDto {
  id: string;
  transcriptId: string;
  segmentId: string;
  ruleId: string | null;
  errorType: ErrorType;
  positionStart: number;
  positionEnd: number;
  message: string;
  isResolved: boolean;
}

export type ValidationFn = (text: string) => Array<{
  start: number;
  end: number;
  message: string;
  errorType: ErrorType;
}>;
