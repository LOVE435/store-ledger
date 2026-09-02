import request from 'supertest';
import app from '../../src/server';

/**
 * 真实 SQLite（内存库）上的账号全链路：
 * 注册 -> 登录 -> 带 token 访问 /me -> 多账号并存互不干扰。
 */
describe('Auth Integration (real SQLite)', () => {
  test('注册 -> 登录 -> me 完整流程', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ username: '店主甲', password: 'password123' });
    expect(register.status).toBe(201);
    expect(register.body.data.token).toBeTruthy();
    const userA = register.body.data.user;
    expect(userA.username).toBe('店主甲');
    expect(userA.id).toBeGreaterThan(0);
    expect(userA.password_hash).toBeUndefined();

    // 重复注册 -> 409
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ username: '店主甲', password: 'password123' });
    expect(dup.status).toBe(409);

    // 登录成功
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: '店主甲', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body.data.token).toBeTruthy();

    // 密码错误 -> 401
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ username: '店主甲', password: 'wrong-pass' });
    expect(bad.status).toBe(401);

    // 第二个账号独立注册
    const registerB = await request(app)
      .post('/api/auth/register')
      .send({ username: '店主乙', password: 'password456' });
    expect(registerB.status).toBe(201);
    expect(registerB.body.data.user.id).not.toBe(userA.id);

    // /me 需要 token
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.username).toBe('店主甲');
  });

  test('参数校验：用户名过短 / 密码过短', async () => {
    const shortUser = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a', password: 'password123' });
    expect(shortUser.status).toBe(400);

    const shortPass = await request(app)
      .post('/api/auth/register')
      .send({ username: '店主丙', password: '123' });
    expect(shortPass.status).toBe(400);
  });
});
