export enum AudioStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
  TRANSCRIPTIONIST = 'TRANSCRIPTIONIST',
}

export enum ErrorType {
  FORMATTING = 'FORMATTING',
  TAG_MISUSE = 'TAG_MISUSE',
  PUNCTUATION = 'PUNCTUATION',
  SPEAKER_LABEL = 'SPEAKER_LABEL',
  RULE_VIOLATION = 'RULE_VIOLATION',
}

export type RuleType =
  | 'SpeakerFormatting'
  | 'TagUsage'
  | 'FillerWordHandling'
  | 'PunctuationConvention'
  | 'CapitalizationRule'
  | 'TimestampRequirement'
  | 'FormattingExample'
  | 'Other';
