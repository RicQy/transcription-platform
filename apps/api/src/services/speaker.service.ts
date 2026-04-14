import { db } from '../db.js';
import { ServiceError } from '../errors/service-error.js';

class SpeakerService {
  async getSpeakers(userId: string) {
    if (!userId || typeof userId !== 'string') {
      throw new ServiceError(400, 'userId is required and must be a string');
    }

    const result = await db.from('speakers').select('*').eq('user_id', userId) as { data?: unknown[]; error?: { message: string } | null };
    if (result.error) {
      throw new ServiceError(500, `Failed to fetch speakers: ${result.error.message}`);
    }
    return result.data;
  }

  async createSpeaker(userId: string, name: string, defaultLabel?: string) {
    if (!userId || typeof userId !== 'string') {
      throw new ServiceError(400, 'userId is required and must be a string');
    }
    if (!name || typeof name !== 'string') {
      throw new ServiceError(400, 'Speaker name is required and must be a string');
    }

    const { data, error } = await db.from('speakers').insert([{
      user_id: userId,
      name,
      default_label: defaultLabel
    }]).select().single() as { data?: Record<string, unknown>; error?: { message: string } | null };

    if (error) {
      throw new ServiceError(500, `Failed to create speaker: ${error.message}`);
    }
    return data;
  }

  async getAudioFileSpeakers(audioFileId: string) {
    if (!audioFileId || typeof audioFileId !== 'string') {
      throw new ServiceError(400, 'audioFileId is required and must be a string');
    }

    const result = await db.from('audio_file_speakers').select('*').eq('audio_file_id', audioFileId) as { data?: unknown[]; error?: { message: string } | null };
    if (result.error) {
      throw new ServiceError(500, `Failed to fetch audio file speakers: ${result.error.message}`);
    }
    return result.data;
  }

  async linkSpeakerToAudioFile(audioFileId: string, diarizationLabel: string, speakerId?: string, verifiedName?: string, role?: string) {
    if (!audioFileId || typeof audioFileId !== 'string') {
      throw new ServiceError(400, 'audioFileId is required and must be a string');
    }
    if (!diarizationLabel || typeof diarizationLabel !== 'string') {
      throw new ServiceError(400, 'diarizationLabel is required and must be a string');
    }

    // Check if mapping already exists
    const { data: existing } = await db.from('audio_file_speakers')
      .select('*')
      .eq('audio_file_id', audioFileId)
      .eq('diarization_label', diarizationLabel)
      .single() as { data?: Record<string, unknown>; error?: { message: string } | null };

    if (existing) {
      const { data, error } = await db.from('audio_file_speakers').update({
        speaker_id: speakerId || existing.speaker_id,
        verified_name: verifiedName || existing.verified_name,
        role: role || existing.role
      })
      .eq('id', existing.id as string) as { data?: unknown; error?: { message: string } | null };

      if (error) {
        throw new ServiceError(500, `Failed to update speaker link: ${error.message}`);
      }
      return data;
    } else {
      const { data, error } = await db.from('audio_file_speakers').insert([{
        audio_file_id: audioFileId,
        diarization_label: diarizationLabel,
        speaker_id: speakerId,
        verified_name: verifiedName,
        role: role
      }]).select().single() as { data?: Record<string, unknown>; error?: { message: string } | null };

      if (error) {
        throw new ServiceError(500, `Failed to create speaker link: ${error.message}`);
      }
      return data;
    }
  }

  async deleteSpeaker(id: string, userId: string) {
    if (!id || typeof id !== 'string') {
      throw new ServiceError(400, 'Speaker id is required and must be a string');
    }
    if (!userId || typeof userId !== 'string') {
      throw new ServiceError(400, 'userId is required and must be a string');
    }

    const result = await db.query('DELETE FROM speakers WHERE id = $1 AND user_id = $2', [id, userId]);
    if (result.rowCount === 0) {
      throw new ServiceError(404, 'Speaker not found or does not belong to user');
    }
    return result;
  }
}

export const speakerService = new SpeakerService();
