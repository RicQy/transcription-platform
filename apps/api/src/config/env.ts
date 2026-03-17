import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
config({ path: '../../.env' });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ASR_WORKER_URL: z.string().url().default('http://asr-worker:8000'),
  FILE_STORAGE_PATH: z.string().default('/data'),
  WHISPER_MODEL_SIZE: z.string().default('medium'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
