import { Worker } from 'bullmq';
import vm from 'vm';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { getIo } from '../sockets/index';
import type { RevalidationJobData } from './revalidationQueue';

export function startRevalidationWorker(): Worker {
  const url = new URL(env.REDIS_URL);
  const connection = {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
  };

  const worker = new Worker<RevalidationJobData>(
    'revalidation',
    async (job) => {
      const { transcriptId, guideId } = job.data;
      logger.info('Starting revalidation', { transcriptId, guideId });

      const io = getIo();
      io?.emit('transcript:revalidating', { transcriptId, guideVersion: guideId });

      const [transcript, rules] = await Promise.all([
        prisma.transcript.findUnique({
          where: { id: transcriptId },
          include: { segments: true },
        }),
        prisma.styleGuideRule.findMany({
          where: { guideId, isActive: true, validationLogic: { not: null } },
        }),
      ]);

      if (!transcript) {
        logger.warn('Transcript not found for revalidation', { transcriptId });
        return;
      }

      // Clear old unresolved errors for this transcript
      await prisma.validationError.deleteMany({
        where: { transcriptId, isResolved: false },
      });

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
                transcriptId,
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
            logger.warn('Validation logic failed', { ruleId: rule.id, error: e });
          }
        }
      }

      if (errors.length > 0) {
        await prisma.validationError.createMany({ data: errors });
      }

      io?.emit('transcript:revalidated', { transcriptId, errorCount: errors.length });
      logger.info('Revalidation complete', { transcriptId, errorCount: errors.length });
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    logger.error('Revalidation job failed', { jobId: job?.id, err });
  });

  return worker;
}
