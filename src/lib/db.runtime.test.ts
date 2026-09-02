import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, uid } from '../db';
import { putTombstone, deleteLocal } from './sync';
import { serverRowToRecord } from './sync';

async function clearAll(): Promise<void> {
  await db.clients.clear();
  await db.records.clear();
  await db.meta.clear();
  await db.tombstones.clear();
}

describe('Dexie 本地库运行时（fake-indexeddb）', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('新增记录自动打 updatedAt，字段完整', async () => {
    const now0 = new Date('2026-09-01T00:00:00.000Z').toISOString();
    const id = uid();
    await db.records.put({
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
      createdAt: now0,
    });
    const row = await db.records.get(id);
    expect(row).toBeTruthy();
    expect(row!.updatedAt).toBeTruthy(); // hook 自动打点
    expect(row!.updatedAt! >= now0).toBe(true);
  });

  it('update 部分字段也自动打 updatedAt', async () => {
    const id = uid();
    await db.records.put({
      id,
      date: '2026-09-02',
      clientName: '李四',
      clientLocation: '广州',
      productName: '手套',
      quantity: 5,
      unit: '双',
      unitPrice: 10,
      totalPrice: 50,
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
      createdAt: '2026-09-02T00:00:00.000Z',
    });
    await db.records.update(id, { paid: true, paidAmount: 50 });
    const row = await db.records.get(id);
    expect(row!.paid).toBe(true);
    expect(row!.updatedAt).toBeTruthy();
  });

  it('显式带 updatedAt 的同步写回不会被 hook 覆盖（防循环上传）', async () => {
    const id = uid();
    const serverUpdatedAt = '2026-09-02T10:00:00.000Z';
    await db.records.put({
      id,
      date: '2026-09-02',
      clientName: '王五',
      clientLocation: '杭州',
      productName: '雨衣',
      quantity: 3,
      unit: '件',
      unitPrice: 30,
      totalPrice: 90,
      note: '',
      stockStatus: 'stocked',
      shipStatus: 'shipped',
      hasPrint: false,
      printNote: '',
      noteImages: [],
      printImages: [],
      paid: false,
      paidAmount: 0,
      starred: false,
      deletedAt: null,
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: serverUpdatedAt,
    });
    const row = await db.records.get(id);
    expect(row!.updatedAt).toBe(serverUpdatedAt); // hook 尊重显式值
  });

  it('墓碑表：复合主键 [entity+id] 幂等', async () => {
    await putTombstone('record', 'r1', '2026-09-02T00:00:00.000Z');
    await putTombstone('record', 'r1', '2026-09-02T00:00:01.000Z');
    await putTombstone('record', 'r1', '2026-09-02T00:00:00.500Z'); // 旧的忽略
    const all = await db.tombstones.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].updatedAt).toBe('2026-09-02T00:00:01.000Z');
  });

  it('deleteLocal：记录物理删除 + 墓碑记录', async () => {
    const id = uid();
    await db.records.put({
      id,
      date: '2026-09-02',
      clientName: '赵六',
      clientLocation: '北京',
      productName: '头盔',
      quantity: 1,
      unit: '顶',
      unitPrice: 100,
      totalPrice: 100,
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
      createdAt: '2026-09-02T00:00:00.000Z',
    });
    await deleteLocal('record', id);
    expect(await db.records.get(id)).toBeUndefined();
    const tombs = await db.tombstones.toArray();
    expect(tombs.some((t) => t.entity === 'record' && t.id === id)).toBe(true);
  });

  it('client 表迁移后 updatedAt 字段可用', async () => {
    await db.clients.put({ id: 'c1', name: '客户甲', location: '上海', wechatId: '', phone: '', createdAt: '2026-01-01T00:00:00.000Z' });
    const c = await db.clients.get('c1');
    expect(c!.updatedAt).toBeTruthy();
    expect(c!.name).toBe('客户甲');
  });

  it('activeRecordsQuery 排除软删行', async () => {
    const live = uid();
    const dead = uid();
    const base = (id: string) => ({
      id,
      date: '2026-09-02',
      clientName: '张三',
      clientLocation: '上海',
      productName: 'X',
      quantity: 1,
      unit: '件',
      unitPrice: 1,
      totalPrice: 1,
      note: '',
      stockStatus: 'unstocked' as const,
      shipStatus: 'unshipped' as const,
      hasPrint: false,
      printNote: '',
      noteImages: [] as string[],
      printImages: [] as string[],
      paid: false,
      paidAmount: 0,
      starred: false,
      deletedAt: null as string | null,
      createdAt: '2026-09-02T00:00:00.000Z',
    });
    await db.records.put(base(live));
    await db.records.put({ ...base(dead), deletedAt: '2026-09-03T00:00:00.000Z' });
    const active = await (await import('../db')).activeRecordsQuery();
    const ids = active.map((r) => r.id);
    expect(ids).toContain(live);
    expect(ids).not.toContain(dead);
  });

  it('serverRowToRecord 兼容数量/金额数值与 _meta', () => {
    const rec = serverRowToRecord(
      {
        id: 'r9',
        quantity: '7',
        unitPrice: '12.5',
        totalPrice: 87.5,
        createdAt: '2026-09-01T00:00:00.000Z',
        _meta: { updatedAt: '2026-09-02T00:00:00.000Z' },
      },
      '2026-09-02T00:00:00.000Z'
    );
    expect(rec.quantity).toBe(7);
    expect(rec.unitPrice).toBe(12.5);
    expect(rec.totalPrice).toBe(87.5);
  });
});
