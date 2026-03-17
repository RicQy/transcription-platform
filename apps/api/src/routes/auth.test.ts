import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const mockFindUnique = jest.fn();

jest.mock('../config/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

const mockBcryptCompare = jest.fn();
jest.mock('bcrypt', () => ({
  compare: (...args: unknown[]) => mockBcryptCompare(...args),
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

import { app } from '../index';

const ADMIN_USER = {
  id: 'admin-id',
  email: 'admin@example.com',
  passwordHash: 'hashed-password',
  role: 'ADMIN' as const,
  createdAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/auth/login', () => {
  it('returns 400 when body is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 for unknown email', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'pass' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong password', async () => {
    mockFindUnique.mockResolvedValue(ADMIN_USER);
    mockBcryptCompare.mockResolvedValue(false);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_USER.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and sets httpOnly cookies on valid credentials', async () => {
    mockFindUnique.mockResolvedValue(ADMIN_USER);
    mockBcryptCompare.mockResolvedValue(true);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_USER.email, password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: ADMIN_USER.id, email: ADMIN_USER.email, role: 'ADMIN' });

    const cookies: string[] = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const accessCookie = cookies.find((c: string) => c.startsWith('accessToken='));
    const refreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));
    expect(accessCookie).toBeDefined();
    expect(accessCookie).toContain('HttpOnly');
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 401 when no refresh token cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', ['refreshToken=invalid.token.value; Path=/api/auth/refresh; HttpOnly']);
    expect(res.status).toBe(401);
  });

  it('returns 200 and rotates tokens on valid refresh token', async () => {
    mockFindUnique.mockResolvedValue(ADMIN_USER);

    const refreshToken = jwt.sign({ sub: ADMIN_USER.id }, 'test-refresh-secret', { expiresIn: '7d' });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}; Path=/api/auth/refresh; HttpOnly`]);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: ADMIN_USER.id });

    const cookies: string[] = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const newAccessCookie = cookies.find((c: string) => c.startsWith('accessToken='));
    expect(newAccessCookie).toBeDefined();
    expect(newAccessCookie).toContain('HttpOnly');
    const newRefreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));
    expect(newRefreshCookie).toBeDefined();
    expect(newRefreshCookie).toContain('HttpOnly');
    const newRefreshTokenValue = newRefreshCookie!.split(';')[0].split('=')[1];
    const decoded = jwt.verify(newRefreshTokenValue, 'test-refresh-secret') as jwt.JwtPayload;
    expect(decoded.sub).toBe(ADMIN_USER.id);
  });

  it('returns 401 when user no longer exists', async () => {
    mockFindUnique.mockResolvedValue(null);
    const refreshToken = jwt.sign({ sub: 'deleted-user-id' }, 'test-refresh-secret', { expiresIn: '7d' });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${refreshToken}; Path=/api/auth/refresh; HttpOnly`]);

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears cookies', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');
    const cookies: string[] = res.headers['set-cookie'] as unknown as string[];
    const accessCookie = cookies?.find((c: string) => c.startsWith('accessToken='));
    expect(accessCookie).toContain('Expires=');
  });
});
