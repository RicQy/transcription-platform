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

    // Whitelist allowed fields to prevent mass assignment
    const ALLOWED_FIELDS = ['content', 'full_text', 'status'] as const;
    const sanitized: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) {
        sanitized[field] = req.body[field];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided' });
    }

    try {
      const transcript = await transcriptionService.updateTranscript(id, sanitized);
      res.json(transcript);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const transcriptionController = new TranscriptionController();
