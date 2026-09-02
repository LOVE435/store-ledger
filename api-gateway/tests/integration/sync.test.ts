import request from 'supertest';
import app from '../../src/server';

async function registerUser(username: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, password: 'password123' });
  expect(res.status).toBe(201);
  return res.body.data.token as string;
}

function record(id: string, updatedAt: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    date: '2026-09-02',
    clientName: '张三',
    clientLocation: '上海',
    productName: '反光背心',
    quantity: 10,
    unit: '件',
    unitPrice: 50,
    totalPrice: 500,
    note: '',
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
    createdAt: updatedAt,
    ...extra,
  };
}

describe('Sync (批量同步 LWW) Integration', () => {
  test('push 新数据成功，pull 能取回（增量游标生效）', async () => {
    const token = await registerUser('同步店A');

    const pushRes = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { entity: 'client', id: 'c-1', updatedAt: '2026-09-02T00:00:01.000Z', data: { id: 'c-1', name: '李四', location: '广州', wechatId: '', phone: '', createdAt: '2026-09-02T00:00:00.000Z' } },
          { entity: 'record', id: 'r-1', updatedAt: '2026-09-02T00:00:02.000Z', data: record('r-1', '2026-09-02T00:00:00.000Z') },
        ],
      });
    expect(pushRes.status).toBe(200);
    const results = pushRes.body.data.results;
    expect(results).toHaveLength(2);
    expect(results.every((r: any) => r.applied)).toBe(true);

    // 全量 pull
    const pull1 = await request(app)
      .post('/api/sync/pull')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(pull1.status).toBe(200);
    expect(pull1.body.data.client.items).toHaveLength(1);
    expect(pull1.body.data.record.items).toHaveLength(1);
    const clientCursor = pull1.body.data.client.maxUpdatedAt;
    expect(clientCursor).toBeTruthy();

    // 增量 pull：since = maxUpdatedAt 之后不再返回
    const pull2 = await request(app)
      .post('/api/sync/pull')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientSince: clientCursor, recordSince: clientCursor });
    expect(pull2.body.data.client.items).toHaveLength(0);
  });

  test('LWW：客户端旧版本被拒，服务端新版本回传', async () => {
    const token = await registerUser('同步店B');
    // 先推入 v1
    await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ entity: 'record', id: 'r-conflict', updatedAt: '2026-09-02T00:00:10.000Z', data: record('r-conflict', '2026-09-02T00:00:00.000Z', { productName: '版本1' }) }],
      });

    // 设备2 推入更新版本 v2
    const pushNew = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ entity: 'record', id: 'r-conflict', updatedAt: '2026-09-02T00:00:20.000Z', data: record('r-conflict', '2026-09-02T00:00:00.000Z', { productName: '版本2' }) }],
      });
    expect(pushNew.body.data.results[0].applied).toBe(true);

    // 设备1 用旧 updatedAt 再推 v1 -> 应被拒 applied=false，回传 server 为 版本2
    const pushOld = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ entity: 'record', id: 'r-conflict', updatedAt: '2026-09-02T00:00:05.000Z', data: record('r-conflict', '2026-09-02T00:00:00.000Z', { productName: '版本1' }) }],
      });
    const r = pushOld.body.data.results[0];
    expect(r.applied).toBe(false);
    expect(r.server.productName).toBe('版本2');
  });

  test('软删除通过 push 同步为墓碑，其它设备 pull 可收到删除', async () => {
    const token = await registerUser('同步店C');
    await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ entity: 'record', id: 'r-del', updatedAt: '2026-09-02T00:00:30.000Z', data: record('r-del', '2026-09-02T00:00:00.000Z') }],
      });

    // 设备1 软删除：deletedAt 非空 且 updatedAt 更新
    const delPush = await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{
          entity: 'record',
          id: 'r-del',
          updatedAt: '2026-09-02T00:01:00.000Z',
          deletedAt: '2026-09-02T00:01:00.000Z',
          data: { ...record('r-del', '2026-09-02T00:00:00.000Z'), deletedAt: '2026-09-02T00:01:00.000Z' },
        }],
      });
    expect(delPush.body.data.results[0].applied).toBe(true);

    // 设备2 增量 pull 收到墓碑
    const pull = await request(app)
      .post('/api/sync/pull')
      .set('Authorization', `Bearer ${token}`)
      .send({ recordSince: '2026-09-02T00:00:40.000Z' });
    const tomb = pull.body.data.record.items.find((i: any) => i.id === 'r-del');
    expect(tomb).toBeTruthy();
    expect(tomb._meta.deletedAt).toBeTruthy();
  });

  test('账号隔离：A push 的数据 B pull 不到', async () => {
    const tokenA = await registerUser('同步店甲');
    const tokenB = await registerUser('同步店乙');
    await request(app)
      .post('/api/sync/push')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ items: [{ entity: 'client', id: 'c-iso', updatedAt: '2026-09-02T00:00:00.000Z', data: { id: 'c-iso', name: '隔离客户', location: '', wechatId: '', phone: '', createdAt: '2026-09-02T00:00:00.000Z' } }] });

    const pullB = await request(app)
      .post('/api/sync/pull')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});
    expect(pullB.body.data.client.items).toHaveLength(0);
  });

  test('push/pull 未登录返回 401', async () => {
    const push = await request(app).post('/api/sync/push').send({ items: [] });
    expect(push.status).toBe(401);
    const pull = await request(app).post('/api/sync/pull').send({});
    expect(pull.status).toBe(401);
  });
});
