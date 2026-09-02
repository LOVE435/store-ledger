import request from 'supertest';
import app from '../../src/server';

describe('API Gateway - Error Handling', () => {
  test('unknown route should return JSON 404', async () => {
    const response = await request(app).get('/api/unknown-route');
    expect(response.status).toBe(404);
    expect(response.body.status).toBe('error');
    expect(response.body.data).toBeNull();
    expect(response.headers['content-type']).toContain('application/json');
  });

  test('unknown HTTP method on known path should return JSON 404', async () => {
    const response = await request(app).patch('/api/clients/1');
    expect(response.status).toBe(404);
    expect(response.body.status).toBe('error');
  });
});