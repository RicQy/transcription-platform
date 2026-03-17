import request from 'supertest';
import { app } from '../index';
import { prisma } from '../config/prisma';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import * as ruleExtractor from '../services/ruleExtractor';
import * as pdfParser from '../services/pdfParser';
import path from 'path';
import fs from 'fs';

jest.mock('../services/ruleExtractor');
jest.mock('../services/pdfParser');
jest.mock('../config/prisma', () => ({
  prisma: {
    styleGuideDocument: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    styleGuideRule: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createMany: jest.fn(),
    },
  },
}));

function makeAdminToken() {
  return jwt.sign({ userId: 'admin-1', role: 'ADMIN' }, env.JWT_SECRET, { expiresIn: '1h' });
}

function makeUserToken() {
  return jwt.sign({ userId: 'user-1', role: 'TRANSCRIPTIONIST' }, env.JWT_SECRET, { expiresIn: '1h' });
}

const mockGuide = {
  id: 'guide-1',
  version: 'v1',
  pdfFilePath: '/data/guides/test.pdf',
  isActive: false,
  uploadDate: new Date().toISOString(),
  parsedAt: null,
};

const mockRule = {
  id: 'rule-1',
  guideId: 'guide-1',
  ruleType: 'SpeakerFormatting',
  ruleText: 'Speaker labels should be in ALL CAPS',
  sourcePage: 1,
  isActive: true,
  validationLogic: null,
};

describe('Style Guide Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (pdfParser.parsePdf as jest.Mock).mockResolvedValue({
      text: 'Sample style guide text',
      pages: [{ pageNumber: 1, text: 'Sample style guide text' }],
    });
    (ruleExtractor.extractRules as jest.Mock).mockResolvedValue([
      { ruleType: 'SpeakerFormatting', ruleText: 'Speaker labels in ALL CAPS', sourcePage: 1 },
    ]);
    (prisma.styleGuideDocument.create as jest.Mock).mockResolvedValue(mockGuide);
    (prisma.styleGuideDocument.update as jest.Mock).mockResolvedValue({ ...mockGuide, parsedAt: new Date() });
    (prisma.styleGuideDocument.findMany as jest.Mock).mockResolvedValue([mockGuide]);
    (prisma.styleGuideRule.findMany as jest.Mock).mockResolvedValue([mockRule]);
    (prisma.styleGuideRule.create as jest.Mock).mockResolvedValue(mockRule);
    (prisma.styleGuideRule.update as jest.Mock).mockResolvedValue(mockRule);
    (prisma.styleGuideRule.delete as jest.Mock).mockResolvedValue(mockRule);
  });

  describe('GET /api/style-guide', () => {
    it('returns list of guides', async () => {
      const res = await request(app)
        .get('/api/style-guide')
        .set('Cookie', `accessToken=${makeAdminToken()}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('requires authentication', async () => {
      const res = await request(app).get('/api/style-guide');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/style-guide/:id/rules', () => {
    it('returns rules for a guide', async () => {
      const res = await request(app)
        .get('/api/style-guide/guide-1/rules')
        .set('Cookie', `accessToken=${makeAdminToken()}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(prisma.styleGuideRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { guideId: 'guide-1' } }),
      );
    });
  });

  describe('POST /api/style-guide/:id/rules', () => {
    it('creates a rule when admin', async () => {
      const res = await request(app)
        .post('/api/style-guide/guide-1/rules')
        .set('Cookie', `accessToken=${makeAdminToken()}`)
        .send({ ruleType: 'TagUsage', ruleText: 'Use [inaudible] for unclear speech' });

      expect(res.status).toBe(201);
      expect(prisma.styleGuideRule.create).toHaveBeenCalled();
    });

    it('rejects non-admin users', async () => {
      const res = await request(app)
        .post('/api/style-guide/guide-1/rules')
        .set('Cookie', `accessToken=${makeUserToken()}`)
        .send({ ruleType: 'TagUsage', ruleText: 'test' });

      expect(res.status).toBe(403);
    });

    it('returns 400 when ruleText is missing', async () => {
      const res = await request(app)
        .post('/api/style-guide/guide-1/rules')
        .set('Cookie', `accessToken=${makeAdminToken()}`)
        .send({ ruleType: 'TagUsage' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/style-guide/:id/rules/:ruleId', () => {
    it('updates a rule', async () => {
      const res = await request(app)
        .put('/api/style-guide/guide-1/rules/rule-1')
        .set('Cookie', `accessToken=${makeAdminToken()}`)
        .send({ ruleText: 'Updated rule text' });

      expect(res.status).toBe(200);
      expect(prisma.styleGuideRule.update).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/style-guide/:id/rules/:ruleId', () => {
    it('deletes a rule', async () => {
      const res = await request(app)
        .delete('/api/style-guide/guide-1/rules/rule-1')
        .set('Cookie', `accessToken=${makeAdminToken()}`);

      expect(res.status).toBe(204);
      expect(prisma.styleGuideRule.delete).toHaveBeenCalledWith({ where: { id: 'rule-1' } });
    });
  });
});
