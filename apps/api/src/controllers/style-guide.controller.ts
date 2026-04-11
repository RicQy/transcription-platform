import { Request, Response } from 'express';
import { styleGuideService } from '../services/style-guide.service.js';

class StyleGuideController {
  async getGuides(req: Request, res: Response) {
    try {
      const guides = await styleGuideService.getGuides();
      res.json(guides);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async upload(req: any, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { version } = req.body;
    
    const storage_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    try {
      const guide = await styleGuideService.createGuide(version, storage_url);
      res.json(guide);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const styleGuideController = new StyleGuideController();
