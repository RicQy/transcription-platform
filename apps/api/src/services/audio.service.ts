import { db } from '../db.js';
import { ServiceError } from '../errors/service-error.js';

class AudioService {
  async getFiles() {
    const result = await db.from('audio_files').select('*') as { data?: unknown[]; error?: { message: string } | null };
    if (result.error) {
      throw new ServiceError(500, `Failed to fetch audio files: ${result.error.message}`);
    }
    return result.data;
  }

  async saveFile(fileName: string, storageUrl: string, userId: string, storageKey?: string) {
    if (!fileName || typeof fileName !== 'string') {
      throw new ServiceError(400, 'fileName is required and must be a string');
    }
    if (!storageUrl || typeof storageUrl !== 'string') {
      throw new ServiceError(400, 'storageUrl is required and must be a string');
    }
    if (!userId || typeof userId !== 'string') {
      throw new ServiceError(400, 'userId is required and must be a string');
    }

    const { data: audioFile, error } = await db.from('audio_files').insert([{
      filename: fileName,
      storage_url: storageUrl,
      storage_key: storageKey,
      transcription_status: 'pending',
      user_id: userId
    }]).select().single() as { data?: Record<string, unknown>; error?: { message: string } | null };

    if (error) {
      throw new ServiceError(500, `Failed to save audio file: ${error.message}`);
    }

    return audioFile;
  }
}

export const audioService = new AudioService();
