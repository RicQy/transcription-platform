import { Router, IRouter, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import { toTxt, toDocx, toJson, toTranscribeMe } from '../services/exportService';

const router: IRouter = Router();

// GET /api/transcripts/:id
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const transcript = await prisma.transcript.findUnique({
      where: { id: req.params.id },
      include: { segments: { orderBy: { startTime: 'asc' } } },
    });

    if (!transcript) {
      res.status(404).json({ error: 'Transcript not found' });
      return;
    }

    res.json(transcript);
  } catch (err) {
    next(err);
  }
});

// PUT /api/transcripts/:id/segments
router.put('/:id/segments', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { segments } = req.body as { segments: Array<{ id: string; text: string; speaker: string; wordData: unknown }> };

    if (!Array.isArray(segments)) {
      res.status(400).json({ error: 'segments must be an array' });
      return;
    }

    await Promise.all(
      segments.map((seg) =>
        prisma.transcriptSegment.update({
          where: { id: seg.id },
          data: { text: seg.text, speaker: seg.speaker, wordData: seg.wordData as Prisma.InputJsonValue },
        }),
      ),
    );

    const updated = await prisma.transcript.findUnique({
      where: { id: req.params.id },
      include: { segments: { orderBy: { startTime: 'asc' } } },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/transcripts/:id/errors
router.get('/:id/errors', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const errors = await prisma.validationError.findMany({
      where: { transcriptId: req.params.id },
      orderBy: { positionStart: 'asc' },
    });
    res.json(errors);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/transcripts/:id/errors/:errId
router.patch('/:id/errors/:errId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const error = await prisma.validationError.update({
      where: { id: req.params.errId },
      data: { isResolved: true },
    });
    res.json(error);
  } catch (err) {
    next(err);
  }
});

// POST /api/transcripts/:id/validate — server-side validation
router.post('/:id/validate', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const transcript = await prisma.transcript.findUnique({
      where: { id: req.params.id },
      include: { segments: true },
    });

    if (!transcript) {
      res.status(404).json({ error: 'Transcript not found' });
      return;
    }

    const activeGuide = await prisma.styleGuideDocument.findFirst({ where: { isActive: true } });
    if (!activeGuide) {
      res.json({ errors: [] });
      return;
    }

    const rules = await prisma.styleGuideRule.findMany({
      where: { guideId: activeGuide.id, isActive: true, validationLogic: { not: null } },
    });

    const vm = await import('vm');
    const errors: Array<{
      transcriptId: string;
      segmentId: string;
      ruleId: string;
      errorType: string;
      positionStart: number;
      positionEnd: number;
      message: string;
      isResolved: boolean;
    }> = [];

    for (const seg of transcript.segments) {
      for (const rule of rules) {
        if (!rule.validationLogic) continue;
        try {
          const fn = vm.runInNewContext(`(${rule.validationLogic})`, {});
          const violations = fn(seg.text) as Array<{ start: number; end: number; message: string; errorType: string }>;
          for (const v of violations) {
            errors.push({
              transcriptId: transcript.id,
              segmentId: seg.id,
              ruleId: rule.id,
              errorType: v.errorType ?? 'RULE_VIOLATION',
              positionStart: v.start,
              positionEnd: v.end,
              message: v.message,
              isResolved: false,
            });
          }
        } catch (e) {
          logger.warn('Validation logic execution failed', { ruleId: rule.id, error: e });
        }
      }
    }

    if (errors.length > 0) {
      await prisma.validationError.createMany({ data: errors });
    }

    res.json({ errors });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/transcripts/:id/segments/:segId/words/:wordIdx/verify
router.patch('/:id/segments/:segId/words/:wordIdx/verify', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const wordIdx = parseInt(req.params.wordIdx, 10);
    const seg = await prisma.transcriptSegment.findUnique({ where: { id: req.params.segId } });

    if (!seg) {
      res.status(404).json({ error: 'Segment not found' });
      return;
    }

    const wordData = seg.wordData as Array<Record<string, unknown>>;
    if (!Array.isArray(wordData) || wordIdx < 0 || wordIdx >= wordData.length) {
      res.status(400).json({ error: 'Invalid word index' });
      return;
    }

    wordData[wordIdx] = { ...wordData[wordIdx], verified: true };

    const updated = await prisma.transcriptSegment.update({
      where: { id: seg.id },
      data: { wordData: wordData as Prisma.InputJsonValue },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/transcripts/:id/export?format=txt|docx|json|transcribeme
router.get('/:id/export', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) ?? 'txt';

    const transcript = await prisma.transcript.findUnique({
      where: { id: req.params.id },
      include: { segments: { orderBy: { startTime: 'asc' } } },
    });

    if (!transcript) {
      res.status(404).json({ error: 'Transcript not found' });
      return;
    }

    const activeGuide = await prisma.styleGuideDocument.findFirst({ where: { isActive: true } });
    const activeRules = activeGuide
      ? await prisma.styleGuideRule.findMany({ where: { guideId: activeGuide.id, isActive: true } })
      : [];

    const filename = `transcript-${transcript.id}`;

    switch (format) {
      case 'docx': {
        const buf = await toDocx(transcript, activeRules);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.docx"`);
        res.send(buf);
        break;
      }
      case 'json': {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.send(toJson(transcript));
        break;
      }
      case 'transcribeme': {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}-transcribeme.txt"`);
        res.send(toTranscribeMe(transcript, activeRules));
        break;
      }
      default: {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`);
        res.send(toTxt(transcript, activeRules));
      }
    }
  } catch (err) {
    next(err);
  }
});

export default router;
