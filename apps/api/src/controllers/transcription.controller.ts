import { Request, Response } from 'express';
import { transcriptionService } from '../services/transcription.service.js';

class TranscriptionController {
  async transcribe(req: Request, res: Response) {
    const { audioFileId, provider } = req.body;
    if (!audioFileId) return res.status(400).json({ error: 'Missing audioFileId' });

    try {
      const result = await transcriptionService.transcribe(audioFileId, provider);
      res.status(202).json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getTranscript(req: Request, res: Response) {
    const { audioFileId } = req.params;
    try {
      const transcript = await transcriptionService.getTranscript(audioFileId);
      res.json(transcript);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async updateTranscript(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const transcript = await transcriptionService.updateTranscript(id, req.body);
      res.json(transcript);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const transcriptionController = new TranscriptionController();
