import { Queue, Worker } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface AsrJobData {
  audioId: string;
  audioPath: string;
}

export const redisConnection = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
};

let _asrQueue: Queue | null = null;

export function getAsrQueue(): Queue {
  if (!_asrQueue) {
    _asrQueue = new Queue('asr', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    });
  }
  return _asrQueue;
}

export { Worker as BullWorker };

export async function enqueueAsrJob(data: AsrJobData): Promise<string> {
  const queue = getAsrQueue();
  const job = await queue.add('transcribe', data);
  logger.info('ASR job enqueued', { jobId: job.id, audioId: data.audioId });
  return job.id as string;
}
