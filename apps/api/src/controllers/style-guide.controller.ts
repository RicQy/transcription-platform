import { Request, Response } from 'express';
import { styleGuideService } from '../services/style-guide.service.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

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
    const { name, jurisdiction } = req.body;
    const userId = req.user.id;

    const fileBuffer = fs.readFileSync(req.file.path);
    const key = `style-guides/${userId}/${Date.now()}-${req.file.originalname}`;

    try {
      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: req.file.mimetype,
      }));

      const storage_url = `${process.env.R2_PUBLIC_URL}/${key}`;

      const guide = await styleGuideService.createGuide(userId, name || req.file.originalname, jurisdiction, storage_url, key);
      
      // Cleanup local file
      fs.unlinkSync(req.file.path);
      
      res.json(guide);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  async ingest(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const result = await styleGuideService.ingestFromSource(id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export const styleGuideController = new StyleGuideController();
