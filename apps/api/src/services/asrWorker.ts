import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';
import { getRedisConnection, AsrJobData } from './asrQueue';
import { getIo } from '../sockets/index';

export function startAsrWorker(): Worker {
  const worker = new Worker(
    'asr',
    async (job: Job<AsrJobData>) => {
      const { audioId, audioPath } = job.data;

      logger.info('ASR job started', { jobId: job.id, audioId });

      await prisma.audioFile.update({
        where: { id: audioId },
        data: { status: 'PROCESSING' },
      });

      getIo()?.emit('transcript:status', { audioId, status: 'PROCESSING', progress: 0 });

      await axios.post(`${env.ASR_WORKER_URL}/transcribe`, {
        audio_path: audioPath,
        audio_id: audioId,
        model_size: env.WHISPER_MODEL_SIZE,
        callback_url: `http://localhost:${env.PORT}/internal/asr-complete`,
      });

      logger.info('ASR worker HTTP request sent', { audioId });
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const { audioId } = job.data as AsrJobData;
    logger.error('ASR job failed', { jobId: job.id, audioId, err: err.message });

    await prisma.audioFile.update({
      where: { id: audioId },
      data: { status: 'ERROR' },
    }).catch(() => {});

    getIo()?.emit('transcript:status', { audioId, status: 'ERROR', progress: 0 });
  });

  logger.info('ASR worker started');
  return worker;
}
