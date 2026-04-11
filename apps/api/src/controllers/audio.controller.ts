import { Request, Response } from 'express';
import { audioService } from '../services/audio.service.js';

class AudioController {
  async getFiles(req: Request, res: Response) {
    try {
      const files = await audioService.getFiles();
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async upload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const storage_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    try {
      const audioFile = await audioService.saveFile(req.file.originalname, storage_url, req.user.id);
      res.json(audioFile);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const audioController = new AudioController();
