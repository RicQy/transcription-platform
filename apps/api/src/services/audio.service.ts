import { db } from '../db.js';

class AudioService {
  async getFiles() {
    const { data } = await db.from('audio_files').select('*').execute() as any;
    return data;
  }

  async saveFile(fileName: string, storageUrl: string, userId: string) {
    const { data: audioFile } = await db.from('audio_files').insert([{
      filename: fileName,
      storage_url: storageUrl,
      transcription_status: 'pending',
      user_id: userId
    }]).select().single() as any;
    
    return audioFile;
  }
}

export const audioService = new AudioService();
