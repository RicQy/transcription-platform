import { Queue, Worker } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface AsrJobData {
  audioId: string;
  audioPath: string;
}

export function getRedisConnection() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: url.password || undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
  };
}

let _asrQueue: Queue | null = null;

export function getAsrQueue(): Queue {
  if (!_asrQueue) {
    _asrQueue = new Queue('asr', {
      connection: getRedisConnection(),
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
