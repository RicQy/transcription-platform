import { Router, IRouter, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../config/prisma';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { parsePdf } from '../services/pdfParser';
import { extractRules } from '../services/ruleExtractor';
import { generateValidationLogicForGuide } from '../services/validationCodegen';
import { enqueueRevalidationJob } from '../services/revalidationQueue';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getIo } from '../sockets/index';

const router: IRouter = Router();

// PDF upload storage
const pdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(env.FILE_STORAGE_PATH, 'guides');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const pdfUpload = multer({
  storage: pdfStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
}).single('pdf');

// POST /api/style-guide — upload PDF and extract rules
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN'),
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    pdfUpload(req, res, (err: unknown) => {
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
        res.status(400).json({ error: 'No PDF file provided' });
        return;
      }

      const version = (req.body.version as string) || `v${Date.now()}`;

      const guide = await prisma.styleGuideDocument.create({
        data: {
          pdfFilePath: req.file.path,
          version,
          isActive: false,
        },
      });

      // Extract rules asynchronously (fire and forget for large PDFs)
      extractRules(guide.id, await parsePdf(req.file.path))
        .then((rules) => {
          logger.info('Rules extracted', { guideId: guide.id, count: rules.length });
          return prisma.styleGuideDocument.update({
            where: { id: guide.id },
            data: { parsedAt: new Date() },
          });
        })
        .catch((err) => logger.error('Rule extraction failed', { guideId: guide.id, err }));

      res.status(201).json({ guideId: guide.id, version: guide.version });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/style-guide — list all versions
router.get('/', authenticateToken, async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const guides = await prisma.styleGuideDocument.findMany({
      orderBy: { uploadDate: 'desc' },
      select: { id: true, version: true, uploadDate: true, isActive: true, parsedAt: true },
    });
    res.json(guides);
  } catch (err) {
    next(err);
  }
});

// GET /api/style-guide/:id/rules
router.get('/:id/rules', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rules = await prisma.styleGuideRule.findMany({
      where: { guideId: req.params.id },
      orderBy: { sourcePage: 'asc' },
    });
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

// POST /api/style-guide/:id/rules — add rule manually
router.post('/:id/rules', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { ruleType, ruleText, sourcePage } = req.body as {
      ruleType: string;
      ruleText: string;
      sourcePage?: number;
    };

    if (!ruleType || !ruleText) {
      res.status(400).json({ error: 'ruleType and ruleText are required' });
      return;
    }

    const rule = await prisma.styleGuideRule.create({
      data: { guideId: req.params.id, ruleType, ruleText, sourcePage, isActive: true },
    });
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
});

// PUT /api/style-guide/:id/rules/:ruleId
router.put('/:id/rules/:ruleId', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { ruleType, ruleText, sourcePage } = req.body as {
      ruleType?: string;
      ruleText?: string;
      sourcePage?: number;
    };

    const rule = await prisma.styleGuideRule.update({
      where: { id: req.params.ruleId },
      data: { ruleType, ruleText, sourcePage },
    });
    res.json(rule);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/style-guide/:id/rules/:ruleId
router.delete('/:id/rules/:ruleId', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.styleGuideRule.delete({ where: { id: req.params.ruleId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/style-guide/:id/activate
router.post('/:id/activate', authenticateToken, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Deactivate all guides
    await prisma.styleGuideDocument.updateMany({ data: { isActive: false } });

    // Activate selected guide
    const guide = await prisma.styleGuideDocument.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });

    // Generate validation logic for rules that don't have it yet
    generateValidationLogicForGuide(guide.id).catch((err) =>
      logger.error('Validation codegen failed', { guideId: guide.id, err }),
    );

    // Enqueue re-validation for all transcripts
    const transcripts = await prisma.transcript.findMany({ select: { id: true } });
    const io = getIo();
    for (const tx of transcripts) {
      io?.emit('transcript:revalidating', { transcriptId: tx.id, guideVersion: guide.version });
      await enqueueRevalidationJob({ transcriptId: tx.id, guideId: guide.id });
    }

    logger.info('Guide activated', { guideId: guide.id, transcriptsQueued: transcripts.length });
    res.json({ guideId: guide.id, transcriptsQueued: transcripts.length });
  } catch (err) {
    next(err);
  }
});

export default router;
