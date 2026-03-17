import { Queue } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface RevalidationJobData {
  transcriptId: string;
  guideId: string;
}

let revalidationQueue: Queue | null = null;

function getQueue(): Queue {
  if (!revalidationQueue) {
    // Use connection string to avoid ioredis version conflicts between bullmq and app
    const url = new URL(env.REDIS_URL);
    revalidationQueue = new Queue('revalidation', {
      connection: {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: url.password || undefined,
        maxRetriesPerRequest: null,
      },
    });
  }
  return revalidationQueue;
}

export async function enqueueRevalidationJob(data: RevalidationJobData): Promise<void> {
  try {
    await getQueue().add('revalidate', data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
    logger.info('Revalidation job enqueued', data);
  } catch (err) {
    logger.error('Failed to enqueue revalidation job', { err });
  }
}
