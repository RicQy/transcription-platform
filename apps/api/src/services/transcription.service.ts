import { db } from '../db.js';
import { transcriptionQueue } from '../lib/queue.js';
import { getSocket } from '../lib/socket.js';
import { ServiceError } from '../errors/service-error.js';

const VALID_PROVIDERS = ['whisperx', 'deepgram', 'assemblyai'] as const;

class TranscriptionService {
  async transcribe(audioFileId: string, provider: string = 'whisperx') {
    if (!audioFileId || typeof audioFileId !== 'string') {
      throw new ServiceError(400, 'audioFileId is required and must be a string');
    }
    if (!VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
      throw new ServiceError(400, `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}`);
    }

    const { data: audioFile } = await db.from('audio_files').select('*').eq('id', audioFileId).single() as { data?: Record<string, unknown>; error?: { message: string } | null };
    if (!audioFile) throw new ServiceError(404, 'Audio file not found');

    const io = getSocket();
    io.emit(`audio:${audioFileId}:status`, { status: 'TRANSCRIPTION_QUEUED' });
    await db.from('audio_files').update({ transcription_status: 'processing' }).eq('id', audioFileId);

    // Add to BullMQ
    await transcriptionQueue.add(`transcribe-${audioFileId}`, {
      audioFileId,
      storageUrl: audioFile.storage_url,
      provider
    });

    return { status: 'queued', audioFileId };
  }

  async getTranscript(audioFileId: string) {
    if (!audioFileId || typeof audioFileId !== 'string') {
      throw new ServiceError(400, 'audioFileId is required and must be a string');
    }

    const { data: transcript } = await db.from('transcripts').select('*').eq('audio_file_id', audioFileId).single() as { data?: Record<string, unknown>; error?: { message: string } | null };
    if (!transcript) {
      throw new ServiceError(404, 'Transcript not found for this audio file');
    }
    return transcript;
  }

  async updateTranscript(id: string, body: Record<string, unknown>) {
    if (!id || typeof id !== 'string') {
      throw new ServiceError(400, 'Transcript id is required and must be a string');
    }
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      throw new ServiceError(400, 'Request body must be a non-empty object');
    }

    // Verify transcript exists before updating
    const { data: existing } = await db.from('transcripts').select('id').eq('id', id).single() as { data?: Record<string, unknown>; error?: { message: string } | null };
    if (!existing) {
      throw new ServiceError(404, 'Transcript not found');
    }

    const { data: transcript, error } = await db.from('transcripts').update(body).eq('id', id) as { data?: unknown; error?: { message: string } | null };
    if (error) {
      throw new ServiceError(500, `Failed to update transcript: ${error.message}`);
    }
    return transcript;
  }
}

export const transcriptionService = new TranscriptionService();
