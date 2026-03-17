import request from 'supertest';
import { app } from '../index';
import { prisma } from '../config/prisma';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

jest.mock('../config/prisma', () => ({
  prisma: {
    transcript: {
      findUnique: jest.fn(),
    },
    transcriptSegment: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    validationError: {
      findMany: jest.fn(),
      update: jest.fn(),
      createMany: jest.fn(),
    },
    styleGuideDocument: {
      findFirst: jest.fn(),
    },
    styleGuideRule: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../services/exportService', () => ({
  toTxt: jest.fn(() => 'SPEAKER_00:\nHello world'),
  toDocx: jest.fn(() => Buffer.from('docx-content')),
  toJson: jest.fn(() => JSON.stringify({ id: 'tx-1', segments: [] })),
  toTranscribeMe: jest.fn(() => 'SPEAKER_00 [0:00]\nHello world'),
}));

function makeToken(role = 'TRANSCRIPTIONIST') {
  return jwt.sign({ userId: 'user-1', role }, env.JWT_SECRET, { expiresIn: '1h' });
}

const mockTranscript = {
  id: 'tx-1',
  audioFileId: 'audio-1',
  version: 1,
  lastModified: new Date().toISOString(),
  segments: [
    {
      id: 'seg-1',
      transcriptId: 'tx-1',
      speaker: 'SPEAKER_00',
      text: 'Hello world',
      startTime: 0,
      endTime: 5,
      confidence: 0.95,
      wordData: [
        { word: 'Hello', start_time: 0, end_time: 0.5, confidence: 0.95 },
        { word: 'world', start_time: 0.6, end_time: 1.0, confidence: 0.4 },
      ],
    },
  ],
};

describe('Transcript Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/transcripts/:id', () => {
    it('returns transcript with segments', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscript);

      const res = await request(app)
        .get('/api/transcripts/tx-1')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('tx-1');
      expect(res.body.segments).toHaveLength(1);
    });

    it('returns 404 when not found', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/transcripts/missing')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(404);
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/transcripts/tx-1');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/transcripts/:id/segments', () => {
    it('updates segments and returns transcript', async () => {
      (prisma.transcriptSegment.update as jest.Mock).mockResolvedValue({});
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscript);

      const res = await request(app)
        .put('/api/transcripts/tx-1/segments')
        .set('Cookie', `accessToken=${makeToken()}`)
        .send({
          segments: [{ id: 'seg-1', text: 'Updated text', speaker: 'SPEAKER_00', wordData: [] }],
        });

      expect(res.status).toBe(200);
      expect(prisma.transcriptSegment.update).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when segments is not an array', async () => {
      const res = await request(app)
        .put('/api/transcripts/tx-1/segments')
        .set('Cookie', `accessToken=${makeToken()}`)
        .send({ segments: 'not-an-array' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/transcripts/:id/errors', () => {
    it('returns validation errors', async () => {
      (prisma.validationError.findMany as jest.Mock).mockResolvedValue([
        { id: 'err-1', transcriptId: 'tx-1', message: 'Test error', isResolved: false },
      ]);

      const res = await request(app)
        .get('/api/transcripts/tx-1/errors')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });
  });

  describe('PATCH /api/transcripts/:id/errors/:errId', () => {
    it('marks error as resolved', async () => {
      (prisma.validationError.update as jest.Mock).mockResolvedValue({
        id: 'err-1',
        isResolved: true,
      });

      const res = await request(app)
        .patch('/api/transcripts/tx-1/errors/err-1')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.validationError.update).toHaveBeenCalledWith({
        where: { id: 'err-1' },
        data: { isResolved: true },
      });
    });
  });

  describe('POST /api/transcripts/:id/validate', () => {
    it('returns empty errors when no active guide', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscript);
      (prisma.styleGuideDocument.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/transcripts/tx-1/validate')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.errors).toEqual([]);
    });

    it('returns 404 when transcript not found', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/transcripts/missing/validate')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(404);
    });

    it('runs validation logic and returns errors', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscript);
      (prisma.styleGuideDocument.findFirst as jest.Mock).mockResolvedValue({ id: 'guide-1' });
      (prisma.styleGuideRule.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rule-1',
          validationLogic: `function(text) {
            if (text.includes('Hello')) return [{ start: 0, end: 5, message: 'Found Hello', errorType: 'STYLE' }];
            return [];
          }`,
        },
      ]);
      (prisma.validationError.createMany as jest.Mock).mockResolvedValue({ count: 1 });

      const res = await request(app)
        .post('/api/transcripts/tx-1/validate')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.errors).toHaveLength(1);
      expect(res.body.errors[0].message).toBe('Found Hello');
    });
  });

  describe('PATCH /api/transcripts/:id/segments/:segId/words/:wordIdx/verify', () => {
    it('marks word as verified', async () => {
      const wordData = [
        { word: 'Hello', confidence: 0.95 },
        { word: 'world', confidence: 0.4 },
      ];
      (prisma.transcriptSegment.findUnique as jest.Mock).mockResolvedValue({
        id: 'seg-1',
        wordData,
      });
      (prisma.transcriptSegment.update as jest.Mock).mockResolvedValue({
        id: 'seg-1',
        wordData: [wordData[0], { ...wordData[1], verified: true }],
      });

      const res = await request(app)
        .patch('/api/transcripts/tx-1/segments/seg-1/words/1/verify')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(200);
      expect(prisma.transcriptSegment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'seg-1' },
          data: expect.objectContaining({ wordData: expect.any(Array) }),
        }),
      );
    });

    it('returns 404 when segment not found', async () => {
      (prisma.transcriptSegment.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/transcripts/tx-1/segments/missing/words/0/verify')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid word index', async () => {
      (prisma.transcriptSegment.findUnique as jest.Mock).mockResolvedValue({
        id: 'seg-1',
        wordData: [{ word: 'Hello' }],
      });

      const res = await request(app)
        .patch('/api/transcripts/tx-1/segments/seg-1/words/99/verify')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/transcripts/:id/export', () => {
    beforeEach(() => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(mockTranscript);
      (prisma.styleGuideDocument.findFirst as jest.Mock).mockResolvedValue(null);
    });

    it('exports as txt by default', async () => {
      const res = await request(app)
        .get('/api/transcripts/tx-1/export')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.headers['content-disposition']).toMatch(/\.txt/);
    });

    it('exports as json', async () => {
      const res = await request(app)
        .get('/api/transcripts/tx-1/export?format=json')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('exports as docx', async () => {
      const res = await request(app)
        .get('/api/transcripts/tx-1/export?format=docx')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/wordprocessingml/);
    });

    it('exports as transcribeme', async () => {
      const res = await request(app)
        .get('/api/transcripts/tx-1/export?format=transcribeme')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.headers['content-disposition']).toMatch(/transcribeme/);
    });

    it('returns 404 when transcript not found', async () => {
      (prisma.transcript.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/transcripts/missing/export')
        .set('Cookie', `accessToken=${makeToken()}`);

      expect(res.status).toBe(404);
    });
  });
});
