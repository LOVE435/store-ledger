import request from 'supertest';
import app from '../../src/server';

describe('API Gateway - Health Check', () => {
  test('GET /health should return OK with timestamp', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
    expect(response.body.timestamp).toBeDefined();
  });
});