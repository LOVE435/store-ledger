import { describe, it, expect } from 'vitest';
import { serverRowToClient, serverRowToRecord } from './sync';

describe('sync 服务端行 -> 本地模型（字段对齐 + LWW 元数据）', () => {
  it('client 行完整映射，含 _meta.updatedAt', () => {
    const row = {
      id: 'c1',
      name: '张三',
      location: '上海',
      wechatId: 'wx_zs',
      phone: '13800000000',
      createdAt: '2026-09-01T00:00:00.000Z',
      _meta: { updatedAt: '2026-09-02T00:00:00.000Z', deletedAt: null },
    };
    const client = serverRowToClient(row, '2026-09-02T00:00:00.000Z');
    expect(client.id).toBe('c1');
    expect(client.name).toBe('张三');
    expect(client.wechatId).toBe('wx_zs');
    expect(client.updatedAt).toBe('2026-09-02T00:00:00.000Z');
    expect(client.createdAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('record 行 21 个字段全部保留（含图片数组），不丢字段', () => {
    const row = {
      id: 'r1',
      date: '2026-09-02',
      clientName: '张三',
      clientLocation: '上海',
      productName: '反光背心',
      quantity: 10,
      unit: '件',
      unitPrice: 50,
      totalPrice: 500,
      note: '急单',
      stockStatus: 'stocked',
      shipStatus: 'shipped',
      hasPrint: true,
      printNote: '印 XX',
      noteImages: ['/uploads/a.jpg'],
      printImages: ['/uploads/b.jpg'],
      paid: true,
      paidAmount: 500,
      starred: true,
      deletedAt: null,
      createdAt: '2026-09-02T08:00:00.000Z',
      _meta: { updatedAt: '2026-09-02T09:00:00.000Z', deletedAt: null },
    };
    const rec = serverRowToRecord(row, '2026-09-02T09:00:00.000Z');
    expect(rec.productName).toBe('反光背心');
    expect(rec.noteImages).toEqual(['/uploads/a.jpg']);
    expect(rec.printImages).toEqual(['/uploads/b.jpg']);
    expect(rec.hasPrint).toBe(true);
    expect(rec.paidAmount).toBe(500);
    expect(rec.stockStatus).toBe('stocked');
    expect(rec.updatedAt).toBe('2026-09-02T09:00:00.000Z');
    // 字段数量对齐前端 Record 定义
    expect(Object.keys(rec).sort()).toEqual(
      [
        'id','date','clientName','clientLocation','productName','quantity','unit','unitPrice',
        'totalPrice','note','stockStatus','shipStatus','hasPrint','printNote','noteImages',
        'printImages','paid','paidAmount','starred','deletedAt','createdAt','updatedAt',
      ].sort()
    );
  });

  it('record 缺省字段兜底（老数据兼容）', () => {
    const rec = serverRowToRecord({ id: 'r2', name: 'x' }, '2026-01-01T00:00:00.000Z');
    expect(rec.unit).toBe('件');
    expect(rec.quantity).toBe(0);
    expect(rec.noteImages).toEqual([]);
    expect(rec.deletedAt).toBeNull();
  });
});
