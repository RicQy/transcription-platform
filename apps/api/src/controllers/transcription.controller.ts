import { Request, Response } from 'express';
import { transcriptionService } from '../services/transcription.service.js';
import { ServiceError } from '../errors/service-error.js';

class TranscriptionController {
  async transcribe(req: Request, res: Response) {
    const { audioFileId, provider } = req.body;
    if (!audioFileId) return res.status(400).json({ error: 'Missing audioFileId' });

    try {
      const result = await transcriptionService.transcribe(audioFileId, provider);
      res.status(202).json(result);
    } catch (err: unknown) {
      const status = err instanceof ServiceError ? err.statusCode : 500;
      const message = err instanceof Error ? err.message : 'Internal server error';
      res.status(status).json({ error: message });
    }
  }

  async getTranscript(req: Request, res: Response) {
    const { audioFileId } = req.params;
    try {
      const transcript = await transcriptionService.getTranscript(audioFileId);
      res.json(transcript);
    } catch (err: unknown) {
      const status = err instanceof ServiceError ? err.statusCode : 500;
      const message = err instanceof Error ? err.message : 'Internal server error';
      res.status(status).json({ error: message });
    }
  }

  async updateTranscript(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const transcript = await transcriptionService.updateTranscript(id, req.body);
      res.json(transcript);
    } catch (err: unknown) {
      const status = err instanceof ServiceError ? err.statusCode : 500;
      const message = err instanceof Error ? err.message : 'Internal server error';
      res.status(status).json({ error: message });
    }
  }
}

export const transcriptionController = new TranscriptionController();
