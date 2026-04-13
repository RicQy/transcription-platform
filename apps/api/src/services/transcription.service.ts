import { db } from '../db.js';
import { transcriptionQueue } from '../lib/queue.js';
import { getSocket } from '../lib/socket.js';

class TranscriptionService {
  async transcribe(audioFileId: string, provider: string = 'whisperx') {
    const { data: audioFile } = await db.from('audio_files').select('*').eq('id', audioFileId).single() as any;
    if (!audioFile) throw new Error('File not found');

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
    const { data: transcript } = await db.from('transcripts').select('*').eq('audio_file_id', audioFileId).single() as any;
    return transcript;
  }

  async updateTranscript(id: string, body: any) {
    const { data: transcript } = await db.from('transcripts').update(body).eq('id', id) as any;
    return transcript;
  }
}

export const transcriptionService = new TranscriptionService();
