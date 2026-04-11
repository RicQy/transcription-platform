import { Request, Response } from 'express';
import { audioService } from '../services/audio.service.js';
import { storageService } from '../lib/storage.js';
import { v4 as uuidv4 } from 'uuid';

class AudioController {
  async getFiles(req: Request, res: Response) {
    try {
      const files = await audioService.getFiles();
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async getUploadUrl(req: Request, res: Response) {
    const { filename, contentType } = req.query as { filename: string, contentType: string };
    if (!filename || !contentType) return res.status(400).json({ error: 'Missing filename or contentType' });

    try {
      const key = `audio/${uuidv4()}-${filename}`;
      const uploadUrl = await storageService.getPreSignedUploadUrl(key, contentType);
      res.json({ uploadUrl, key });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async upload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    // Legacy local upload support
    const storage_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    try {
      const audioFile = await audioService.saveFile(req.file.originalname, storage_url, req.user.id);
      res.json(audioFile);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async registerR2File(req: any, res: Response) {
    const { filename, key } = req.body;
    if (!filename || !key) return res.status(400).json({ error: 'Missing filename or key' });

    try {
      const storage_url = storageService.getPublicUrl(key);
      const audioFile = await audioService.saveFile(filename, storage_url, req.user.id, key);
      res.json(audioFile);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const audioController = new AudioController();
