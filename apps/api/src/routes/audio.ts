import { Router, IRouter, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { audioUpload, isAcceptedAudioFile } from '../middleware/upload';
import { enqueueAsrJob } from '../services/asrQueue';
import { logger } from '../utils/logger';

const router: IRouter = Router();

router.post(
  '/',
  authenticateToken,
  (req: Request, res: Response, next: NextFunction) => {
    audioUpload(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No audio file provided' });
        return;
      }

      if (!isAcceptedAudioFile(req.file)) {
        fs.unlink(req.file.path, () => {});
        res.status(400).json({ error: `Unsupported file type: ${req.file.mimetype}` });
        return;
      }

      const audioFile = await prisma.audioFile.create({
        data: {
          filename: req.file.originalname,
          filePath: req.file.path,
          status: 'QUEUED',
        },
      });

      await enqueueAsrJob({ audioId: audioFile.id, audioPath: req.file.path });

      logger.info('Audio uploaded and queued', { audioId: audioFile.id });
      res.status(201).json(audioFile);
    } catch (err) {
      next(err);
    }
  },
);

router.get('/', authenticateToken, async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const files = await prisma.audioFile.findMany({
      orderBy: { uploadDate: 'desc' },
    });
    res.json(files);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.audioFile.findUnique({
      where: { id: req.params.id },
      include: { transcripts: { select: { id: true, version: true, lastModified: true } } },
    });

    if (!file) {
      res.status(404).json({ error: 'Audio file not found' });
      return;
    }

    res.json(file);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/stream', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.audioFile.findUnique({ where: { id: req.params.id } });

    if (!file) {
      res.status(404).json({ error: 'Audio file not found' });
      return;
    }

    const filePath = file.filePath;

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Audio file missing from disk' });
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.mp4': 'audio/mp4',
      '.wav': 'audio/wav',
      '.m4a': 'audio/x-m4a',
      '.flac': 'audio/flac',
    };
    const contentType = mimeMap[ext] ?? 'application/octet-stream';

    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });

      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    next(err);
  }
});

export default router;
