import { AudioStatus } from './enums';

export interface TranscriptStatusEvent {
  audioId: string;
  status: AudioStatus;
  progress?: number;
}

export interface TranscriptReadyEvent {
  transcriptId: string;
}

export interface TranscriptRevalidatingEvent {
  transcriptId: string;
  guideVersion: string;
}

export interface TranscriptRevalidatedEvent {
  transcriptId: string;
  errorCount: number;
}

export interface ServerToClientEvents {
  'transcript:status': (payload: TranscriptStatusEvent) => void;
  'transcript:ready': (payload: TranscriptReadyEvent) => void;
  'transcript:revalidating': (payload: TranscriptRevalidatingEvent) => void;
  'transcript:revalidated': (payload: TranscriptRevalidatedEvent) => void;
}

export interface ClientToServerEvents {
  join: (room: string) => void;
  leave: (room: string) => void;
}
