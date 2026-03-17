import request from 'supertest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.FILE_STORAGE_PATH = os.tmpdir();
process.env.ASR_WORKER_URL = 'http://localhost:8001';
process.env.WHISPER_MODEL_SIZE = 'medium';

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('hashed'),
}));

const mockAudioFileCreate = jest.fn();
const mockAudioFileFindMany = jest.fn();
const mockAudioFileFindUnique = jest.fn();
const mockAudioFileUpdate = jest.fn();
const mockTranscriptCreate = jest.fn();

jest.mock('../config/prisma', () => ({
  prisma: {
    audioFile: {
      create: (...args: unknown[]) => mockAudioFileCreate(...args),
      findMany: (...args: unknown[]) => mockAudioFileFindMany(...args),
      findUnique: (...args: unknown[]) => mockAudioFileFindUnique(...args),
      update: (...args: unknown[]) => mockAudioFileUpdate(...args),
    },
    transcript: {
      create: (...args: unknown[]) => mockTranscriptCreate(...args),
    },
  },
}));

const mockEnqueueAsrJob = jest.fn();
jest.mock('../services/asrQueue', () => ({
  enqueueAsrJob: (...args: unknown[]) => mockEnqueueAsrJob(...args),
  getRedisConnection: jest.fn(),
  getAsrQueue: jest.fn(),
}));

const mockGetIo = jest.fn(() => ({ emit: jest.fn() }));
jest.mock('../sockets/index', () => ({
  initIo: jest.fn(),
  getIo: () => mockGetIo(),
}));

jest.mock('../services/asrWorker', () => ({
  startAsrWorker: jest.fn(),
}));

import { app } from '../index';

function makeAccessToken(role: 'ADMIN' | 'TRANSCRIPTIONIST' = 'TRANSCRIPTIONIST'): string {
  return jwt.sign({ sub: 'user-id', role }, 'test-access-secret', { expiresIn: '15m' });
}

const AUDIO_FILE_RECORD = {
  id: 'audio-id-1',
  filename: 'test.mp3',
  filePath: '/data/audio/test.mp3',
  duration: null,
  uploadDate: new Date().toISOString(),
  status: 'QUEUED',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEnqueueAsrJob.mockResolvedValue('job-id-1');
  mockGetIo.mockReturnValue({ emit: jest.fn() });
});

describe('POST /api/audio', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/api/audio');
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file is provided', async () => {
    const token = makeAccessToken();
    const res = await request(app)
      .post('/api/audio')
      .set('Cookie', [`accessToken=${token}`]);
    expect(res.status).toBe(400);
  });

  it('returns 400 when wrong mime type is uploaded', async () => {
    const token = makeAccessToken();
    const tmpFile = path.join(os.tmpdir(), 'test.txt');
    fs.writeFileSync(tmpFile, 'not audio');

    const res = await request(app)
      .post('/api/audio')
      .set('Cookie', [`accessToken=${token}`])
      .attach('audio', tmpFile, { filename: 'test.txt', contentType: 'text/plain' });

    fs.unlinkSync(tmpFile);
    expect(res.status).toBe(400);
  });

  it('returns 201 and enqueues job on valid audio upload', async () => {
    mockAudioFileCreate.mockResolvedValue(AUDIO_FILE_RECORD);

    const token = makeAccessToken();
    const tmpFile = path.join(os.tmpdir(), 'test.mp3');
    fs.writeFileSync(tmpFile, Buffer.alloc(100));

    const res = await request(app)
      .post('/api/audio')
      .set('Cookie', [`accessToken=${token}`])
      .attach('audio', tmpFile, { filename: 'test.mp3', contentType: 'audio/mpeg' });

    fs.unlinkSync(tmpFile);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('audio-id-1');
    expect(mockAudioFileCreate).toHaveBeenCalledTimes(1);
    expect(mockEnqueueAsrJob).toHaveBeenCalledWith(
      expect.objectContaining({ audioId: 'audio-id-1' }),
    );
  });
});

describe('GET /api/audio', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/audio');
    expect(res.status).toBe(401);
  });

  it('returns list of audio files', async () => {
    mockAudioFileFindMany.mockResolvedValue([AUDIO_FILE_RECORD]);

    const token = makeAccessToken();
    const res = await request(app)
      .get('/api/audio')
      .set('Cookie', [`accessToken=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('audio-id-1');
  });
});

describe('GET /api/audio/:id', () => {
  it('returns 404 for unknown id', async () => {
    mockAudioFileFindUnique.mockResolvedValue(null);

    const token = makeAccessToken();
    const res = await request(app)
      .get('/api/audio/nonexistent-id')
      .set('Cookie', [`accessToken=${token}`]);

    expect(res.status).toBe(404);
  });

  it('returns audio file metadata', async () => {
    mockAudioFileFindUnique.mockResolvedValue({ ...AUDIO_FILE_RECORD, transcripts: [] });

    const token = makeAccessToken();
    const res = await request(app)
      .get('/api/audio/audio-id-1')
      .set('Cookie', [`accessToken=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('audio-id-1');
    expect(res.body.status).toBe('QUEUED');
  });
});

describe('POST /internal/asr-complete', () => {
  it('returns 400 for invalid payload', async () => {
    const res = await request(app)
      .post('/internal/asr-complete')
      .send({ invalid: true });

    expect(res.status).toBe(400);
  });

  it('updates status to ERROR on error status', async () => {
    mockAudioFileUpdate.mockResolvedValue({ ...AUDIO_FILE_RECORD, status: 'ERROR' });

    const res = await request(app)
      .post('/internal/asr-complete')
      .send({ audio_id: 'audio-id-1', status: 'error', error: 'ASR failed' });

    expect(res.status).toBe(200);
    expect(mockAudioFileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ERROR' } }),
    );
  });

  it('creates transcript and segments on complete status', async () => {
    mockAudioFileFindUnique.mockResolvedValue(AUDIO_FILE_RECORD);
    mockTranscriptCreate.mockResolvedValue({ id: 'transcript-id-1', audioFileId: 'audio-id-1' });
    mockAudioFileUpdate.mockResolvedValue({ ...AUDIO_FILE_RECORD, status: 'COMPLETE' });

    const words = [
      { word: 'Hello', start: 0.0, end: 0.4, confidence: 0.98, speaker_id: 'SPEAKER_00' },
      { word: 'world', start: 0.5, end: 0.9, confidence: 0.95, speaker_id: 'SPEAKER_00' },
    ];

    const res = await request(app)
      .post('/internal/asr-complete')
      .send({ audio_id: 'audio-id-1', status: 'complete', words });

    expect(res.status).toBe(200);
    expect(res.body.transcriptId).toBe('transcript-id-1');
    expect(mockTranscriptCreate).toHaveBeenCalledTimes(1);
    expect(mockAudioFileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'COMPLETE' } }),
    );
  });

  it('returns 400 when words array is empty on complete status', async () => {
    const res = await request(app)
      .post('/internal/asr-complete')
      .send({ audio_id: 'audio-id-1', status: 'complete', words: [] });

    expect(res.status).toBe(400);
  });

  it('emits transcript:ready socket event on completion', async () => {
    mockAudioFileFindUnique.mockResolvedValue(AUDIO_FILE_RECORD);
    mockTranscriptCreate.mockResolvedValue({ id: 'transcript-id-2', audioFileId: 'audio-id-1' });
    mockAudioFileUpdate.mockResolvedValue({ ...AUDIO_FILE_RECORD, status: 'COMPLETE' });

    const mockEmit = jest.fn();
    mockGetIo.mockReturnValue({ emit: mockEmit });

    const words = [
      { word: 'Test', start: 0.0, end: 0.3, confidence: 0.9, speaker_id: 'SPEAKER_00' },
    ];

    await request(app)
      .post('/internal/asr-complete')
      .send({ audio_id: 'audio-id-1', status: 'complete', words });

    expect(mockEmit).toHaveBeenCalledWith('transcript:ready', { transcriptId: 'transcript-id-2' });
    expect(mockEmit).toHaveBeenCalledWith('transcript:status', expect.objectContaining({ status: 'COMPLETE' }));
  });
});
