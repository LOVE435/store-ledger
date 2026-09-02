import request from 'supertest';
import app from '../../src/server';
import { authService } from '../../src/services/authService';

jest.mock('../../src/services/authService', () => {
  const actual = jest.requireActual('../../src/services/authService');
  return {
    authService: {
      register: jest.fn(),
      login: jest.fn(),
      getUserById: jest.fn(),
      signToken: actual.authService.signToken,
      verifyToken: actual.authService.verifyToken,
    },
  };
});

const mockedService = authService as jest.Mocked<typeof authService>;

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/auth/register 返回 201 + token + 用户', async () => {
    mockedService.register.mockResolvedValue({
      token: 'jwt-token',
      user: { id: 1, username: '店主A', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: '店主A', password: 'secret123' });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('success');
    expect(response.body.data.token).toBe('jwt-token');
    expect(response.body.data.user.username).toBe('店主A');
  });

  test('POST /api/auth/register 用户名重复返回 409', async () => {
    mockedService.register.mockRejectedValue(Object.assign(new Error('用户名已被注册'), { statusCode: 409, isOperational: true }));
    const response = await request(app)
      .post('/api/auth/register')
      .send({ username: '店主A', password: 'secret123' });
    expect(response.status).toBe(409);
  });

  test('POST /api/auth/login 返回 token', async () => {
    mockedService.login.mockResolvedValue({
      token: 'jwt-token',
      user: { id: 1, username: '店主A', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: '店主A', password: 'secret123' });
    expect(response.status).toBe(200);
    expect(response.body.data.token).toBe('jwt-token');
  });

  test('POST /api/auth/login 密码错误返回 401', async () => {
    mockedService.login.mockRejectedValue(Object.assign(new Error('用户名或密码错误'), { statusCode: 401, isOperational: true }));
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: '店主A', password: 'wrong' });
    expect(response.status).toBe(401);
  });

  test('GET /api/auth/me 无 token 返回 401', async () => {
    const response = await request(app).get('/api/auth/me');
    expect(response.status).toBe(401);
  });

  test('GET /api/auth/me 带 token 返回用户', async () => {
    mockedService.getUserById.mockResolvedValue({ id: 1, username: '店主A', createdAt: '2026-01-01T00:00:00.000Z' });
    const token = authService.signToken(1, '店主A');
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.user.username).toBe('店主A');
  });

  test('GET /api/auth/me 伪造 token 返回 401', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer fake.token.here');
    expect(response.status).toBe(401);
  });
});
