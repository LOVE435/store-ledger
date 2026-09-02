import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../../src/server';
import { UPLOADS_DIR } from '../../src/services/imageService';

describe('Image Upload (图片上传) Integration', () => {
  afterEach(() => {
    // 清理测试产生的上传文件
    if (fs.existsSync(UPLOADS_DIR)) {
      for (const f of fs.readdirSync(UPLOADS_DIR)) {
        fs.unlinkSync(path.join(UPLOADS_DIR, f));
      }
    }
  });

  test('上传 PNG dataURL 返回 /uploads URL，可静态访问', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: '图店A', password: 'password123' });
    const token = reg.body.data.token as string;

    // 1x1 透明 PNG
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const upload = await request(app)
      .post('/api/images')
      .set('Authorization', `Bearer ${token}`)
      .send({ dataUrl: `data:image/png;base64,${pngBase64}` });
    expect(upload.status).toBe(201);
    const url = upload.body.data.url as string;
    expect(url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);

    // 静态访问图片
    const fetchImg = await request(app).get(url);
    expect(fetchImg.status).toBe(200);
    expect(fetchImg.headers['content-type']).toContain('image/png');
  });

  test('未登录上传返回 401', async () => {
    const res = await request(app).post('/api/images').send({ dataUrl: 'data:image/png;base64,abc' });
    expect(res.status).toBe(401);
  });

  test('非法格式返回 400', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: '图店B', password: 'password123' });
    const token = reg.body.data.token as string;
    const res = await request(app)
      .post('/api/images')
      .set('Authorization', `Bearer ${token}`)
      .send({ dataUrl: 'data:text/html;base64,PGh0bWw+' });
    expect(res.status).toBe(400);
  });
});
