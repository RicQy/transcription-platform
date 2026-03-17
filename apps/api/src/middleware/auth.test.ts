import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

import { authenticateToken, requireRole, AuthenticatedRequest } from './auth';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function mockNext(): NextFunction {
  return jest.fn();
}

describe('authenticateToken', () => {
  const JWT_SECRET = 'test-access-secret';

  it('calls next() with valid access token', () => {
    const token = jwt.sign({ sub: 'user-id', role: 'TRANSCRIPTIONIST' }, JWT_SECRET, { expiresIn: '15m' });
    const req = { cookies: { accessToken: token } } as unknown as AuthenticatedRequest;
    const res = mockRes();
    const next = mockNext();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'user-id', role: 'TRANSCRIPTIONIST' });
  });

  it('returns 401 when no cookie present', () => {
    const req = { cookies: {} } as unknown as AuthenticatedRequest;
    const res = mockRes();
    const next = mockNext();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for expired token', () => {
    const token = jwt.sign({ sub: 'user-id', role: 'ADMIN' }, JWT_SECRET, { expiresIn: '-1s' });
    const req = { cookies: { accessToken: token } } as unknown as AuthenticatedRequest;
    const res = mockRes();
    const next = mockNext();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for token signed with wrong secret', () => {
    const token = jwt.sign({ sub: 'user-id', role: 'ADMIN' }, 'wrong-secret', { expiresIn: '15m' });
    const req = { cookies: { accessToken: token } } as unknown as AuthenticatedRequest;
    const res = mockRes();
    const next = mockNext();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('calls next() when user has required role', () => {
    const req = { user: { id: 'u1', role: Role.ADMIN } } as AuthenticatedRequest;
    const res = mockRes();
    const next = mockNext();

    requireRole(Role.ADMIN)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when user has insufficient role', () => {
    const req = { user: { id: 'u1', role: Role.TRANSCRIPTIONIST } } as AuthenticatedRequest;
    const res = mockRes();
    const next = mockNext();

    requireRole(Role.ADMIN)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user is not set', () => {
    const req = { cookies: {} } as AuthenticatedRequest;
    const res = mockRes();
    const next = mockNext();

    requireRole(Role.ADMIN)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows multiple roles', () => {
    const req = { user: { id: 'u1', role: Role.TRANSCRIPTIONIST } } as AuthenticatedRequest;
    const res = mockRes();
    const next = mockNext();

    requireRole(Role.ADMIN, Role.TRANSCRIPTIONIST)(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
