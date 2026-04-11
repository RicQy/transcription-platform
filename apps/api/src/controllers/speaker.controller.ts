import { Request, Response } from 'express';
import { speakerService } from '../services/speaker.service.js';

class SpeakerController {
  async getMySpeakers(req: any, res: Response) {
    try {
      const speakers = await speakerService.getSpeakers(req.user.id);
      res.json(speakers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async createSpeaker(req: any, res: Response) {
    const { name, defaultLabel } = req.body;
    try {
      const speaker = await speakerService.createSpeaker(req.user.id, name, defaultLabel);
      res.json(speaker);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async indexAudioFileSpeakers(req: Request, res: Response) {
    const { audioFileId } = req.params;
    try {
      const speakers = await speakerService.getAudioFileSpeakers(audioFileId);
      res.json(speakers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async updateAudioFileSpeakerLink(req: Request, res: Response) {
    const { audioFileId } = req.params;
    const { diarizationLabel, speakerId, verifiedName, role } = req.body;
    try {
      const result = await speakerService.linkSpeakerToAudioFile(audioFileId, diarizationLabel, speakerId, verifiedName, role);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const speakerController = new SpeakerController();
