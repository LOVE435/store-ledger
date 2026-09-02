import request from 'supertest';
import app from '../../src/server';

/** 帮助函数：注册并返回 token */
async function registerUser(username: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body.data.token as string;
}

const CLIENT = {
  id: 'client-uuid-1',
  name: '张三',
  location: '上海',
  wechatId: 'wx_zhangsan',
  phone: '13800000000',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const RECORD = {
  id: 'record-uuid-1',
  date: '2026-01-02',
  clientName: '张三',
  clientLocation: '上海',
  productName: '反光背心',
  quantity: 10,
  unit: '件',
  unitPrice: 50,
  totalPrice: 500,
  note: '加急',
  stockStatus: 'unstocked',
  shipStatus: 'unshipped',
  hasPrint: false,
  printNote: '',
  noteImages: [],
  printImages: [],
  paid: false,
  paidAmount: 0,
  starred: false,
  deletedAt: null,
  createdAt: '2026-01-02T00:00:00.000Z',
};

describe('Ledger (业务数据 + 账号隔离) Integration', () => {
  test('同账号多设备共享数据：两个 token(同账号) 都能读写同一份数据', async () => {
    // 同一账号在两个"设备"上登录 -> 两个独立 token
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: '店甲', password: 'password123' });
    expect(reg.status).toBe(201);
    const tokenDeviceA = reg.body.data.token as string;
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: '店甲', password: 'password123' });
    expect(login.status).toBe(200);
    const tokenDeviceB = login.body.data.token as string;

    // 设备 A 写入一笔账
    const putA = await request(app)
      .put('/api/ledger/record/record-uuid-1')
      .set('Authorization', `Bearer ${tokenDeviceA}`)
      .send(RECORD);
    expect(putA.status).toBe(200);
    expect(putA.body.data._meta.entity).toBe('record');

    // 设备 B（同一账号）能看到 A 写入的数据
    const getB = await request(app)
      .get('/api/ledger/record')
      .set('Authorization', `Bearer ${tokenDeviceB}`);
    expect(getB.status).toBe(200);
    expect(getB.body.data.items).toHaveLength(1);
    expect(getB.body.data.items[0].id).toBe('record-uuid-1');
    expect(getB.body.data.items[0].productName).toBe('反光背心');
    // 完整字段无丢失
    expect(getB.body.data.items[0].noteImages).toEqual([]);
    expect(getB.body.data.items[0].quantity).toBe(10);
  });

  test('不同账号完全隔离：店乙看不到店甲的数据', async () => {
    const tokenA = await registerUser('店甲隔离');
    const tokenB = await registerUser('店乙隔离');

    // 店甲写客户
    const put = await request(app)
      .put('/api/ledger/client/client-uuid-1')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(CLIENT);
    expect(put.status).toBe(200);

    // 店甲自己能看到
    const getA = await request(app)
      .get('/api/ledger/client')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(getA.body.data.items).toHaveLength(1);

    // 店乙看不到任何店甲数据
    const getB = await request(app)
      .get('/api/ledger/client')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(getB.status).toBe(200);
    expect(getB.body.data.items).toHaveLength(0);
  });

  test('未登录访问返回 401', async () => {
    const res = await request(app).get('/api/ledger/client');
    expect(res.status).toBe(401);
  });

  test('不合法实体类型返回 400', async () => {
    const token = await registerUser('店甲实体');
    const res = await request(app)
      .get('/api/ledger/unknown-entity')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('软删除产生墓碑：删除后仍可按增量拉取到（供其它设备同步删除）', async () => {
    const token = await registerUser('店甲墓碑');
    await request(app)
      .put('/api/ledger/record/record-uuid-2')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...RECORD, id: 'record-uuid-2' });

    const del = await request(app)
      .delete('/api/ledger/record/record-uuid-2')
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(del.body.data._meta.deletedAt).toBeTruthy();

    // 增量拉取应包含这条墓碑（deletedAt 非空）
    const since = new Date(Date.now() - 60000).toISOString();
    const changes = await request(app)
      .get(`/api/ledger/record?since=${encodeURIComponent(since)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(changes.body.data.items.length).toBeGreaterThanOrEqual(1);
    const tomb = changes.body.data.items.find((i: any) => i.id === 'record-uuid-2');
    expect(tomb).toBeTruthy();
    expect(tomb._meta.deletedAt).toBeTruthy();
  });

  test('增量拉取只返回 since 之后变化的行', async () => {
    const token = await registerUser('店甲增量');
    await request(app)
      .put('/api/ledger/client/client-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...CLIENT, id: 'client-1' });
    await new Promise((r) => setTimeout(r, 10));
    const cut = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 10));
    await request(app)
      .put('/api/ledger/client/client-2')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...CLIENT, id: 'client-2' });

    const changes = await request(app)
      .get(`/api/ledger/client?since=${encodeURIComponent(cut)}`)
      .set('Authorization', `Bearer ${token}`);
    const ids = changes.body.data.items.map((i: any) => i.id);
    expect(ids).toContain('client-2');
    expect(ids).not.toContain('client-1');
  });
});
