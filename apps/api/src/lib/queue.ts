import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Use Redis for BullMQ connection
export const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const transcriptionQueue = new Queue('transcription', { 
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  }
});
