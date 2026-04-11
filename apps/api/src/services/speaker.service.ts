import { db } from '../db.js';

class SpeakerService {
  async getSpeakers(userId: string) {
    const { data } = await db.from('speakers').select('*').eq('user_id', userId).execute() as any;
    return data;
  }

  async createSpeaker(userId: string, name: string, defaultLabel?: string) {
    const { data } = await db.from('speakers').insert([{
      user_id: userId,
      name,
      default_label: defaultLabel
    }]).select().single() as any;
    return data;
  }

  async getAudioFileSpeakers(audioFileId: string) {
    const { data } = await db.from('audio_file_speakers').select('*').eq('audio_file_id', audioFileId).execute() as any;
    return data;
  }

  async linkSpeakerToAudioFile(audioFileId: string, diarizationLabel: string, speakerId?: string, verifiedName?: string, role?: string) {
    // Check if mapping already exists
    const { data: existing } = await db.from('audio_file_speakers')
      .select('*')
      .eq('audio_file_id', audioFileId)
      .eq('diarization_label', diarizationLabel)
      .single() as any;

    if (existing) {
      const { data } = await db.from('audio_file_speakers').update({
        speaker_id: speakerId || existing.speaker_id,
        verified_name: verifiedName || existing.verified_name,
        role: role || existing.role
      })
      .eq('id', existing.id)
      .execute() as any;
      return data;
    } else {
      const { data } = await db.from('audio_file_speakers').insert([{
        audio_file_id: audioFileId,
        diarization_label: diarizationLabel,
        speaker_id: speakerId,
        verified_name: verifiedName,
        role: role
      }]).select().single() as any;
      return data;
    }
  }

  async deleteSpeaker(id: string, userId: string) {
    return await db.query('DELETE FROM speakers WHERE id = $1 AND user_id = $2', [id, userId]);
  }
}

export const speakerService = new SpeakerService();
