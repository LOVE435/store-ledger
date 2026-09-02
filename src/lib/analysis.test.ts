import { describe, expect, it } from 'vitest';
import type { Client, Record } from '../types';
import {
  buildClientStats,
  computeTotal,
  daysSince,
  filterRecords,
  formatDateCN,
  groupByLocation,
  monthlySeries,
  productBreakdown,
  rankByAmount,
  rankByOrders,
  rankByRecent,
  statusBatchPatch,
  suggest,
  toggleShip,
  toggleStock,
  today,
} from './analysis';

function client(name: string, location = ''): Client {
  return { id: name, name, location, wechatId: '', phone: '', createdAt: '2026-01-01T00:00:00.000Z' };
}

function rec(over: Partial<Record>): Record {
  return {
    id: 'r',
    date: '2026-08-01',
    clientName: '甲',
    clientLocation: '广州',
    productName: '反光背心',
    quantity: 10,
    unit: '件',
    unitPrice: 25,
    totalPrice: 250,
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
    createdAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

describe('computeTotal', () => {
  it('multiplies and rounds to 2 decimals', () => {
    expect(computeTotal(3, 2.5)).toBe(7.5);
    expect(computeTotal(0.1, 0.2)).toBe(0.02);
  });
});

describe('status toggles', () => {
  it('stocking keeps ship status, unstocking resets it', () => {
    expect(toggleStock('unstocked', 'unshipped')).toEqual({ stockStatus: 'stocked', shipStatus: 'unshipped' });
    expect(toggleStock('stocked', 'unshipped')).toEqual({ stockStatus: 'unstocked', shipStatus: 'unshipped' });
    expect(toggleStock('stocked', 'shipped')).toEqual({ stockStatus: 'unstocked', shipStatus: 'unshipped' });
  });

  it('toggles ship status both ways', () => {
    expect(toggleShip('unshipped')).toBe('shipped');
    expect(toggleShip('shipped')).toBe('unshipped');
  });
});

describe('statusBatchPatch', () => {
  it('builds whole-client batch patches for stock/ship/paid', () => {
    expect(statusBatchPatch('stock', true)).toEqual({ stockStatus: 'stocked' });
    expect(statusBatchPatch('stock', false)).toEqual({ stockStatus: 'unstocked', shipStatus: 'unshipped' });
    expect(statusBatchPatch('ship', true)).toEqual({ stockStatus: 'stocked', shipStatus: 'shipped' });
    expect(statusBatchPatch('ship', false)).toEqual({ shipStatus: 'unshipped' });
    expect(statusBatchPatch('paid', true)).toEqual({ paid: true });
    expect(statusBatchPatch('paid', false)).toEqual({ paid: false });
  });
});

describe('buildClientStats', () => {
  const clients = [client('甲', '广州'), client('乙', '广州'), client('丙', '')];
  const records = [
    rec({ clientName: '甲', date: '2026-08-01', productName: '背心', totalPrice: 100 }),
    rec({ clientName: '甲', date: '2026-08-20', productName: '手套', totalPrice: 200 }),
    rec({ clientName: '乙', date: '2026-07-05', productName: '背心', totalPrice: 50 }),
  ];
  const stats = buildClientStats(records, clients);

  it('aggregates orders, amounts and dates', () => {
    const a = stats.find((s) => s.name === '甲')!;
    expect(a.orders).toBe(2);
    expect(a.totalAmount).toBe(300);
    expect(a.lastDate).toBe('2026-08-20');
    expect(a.firstDate).toBe('2026-08-01');
    expect(a.avgGapDays).toBe(19);
    expect(a.topProducts[0]).toEqual({ name: '手套', amount: 200 });
  });

  it('keeps zero-order clients with empty stats', () => {
    const c = stats.find((s) => s.name === '丙')!;
    expect(c.orders).toBe(0);
    expect(c.lastDate).toBeNull();
  });
});

describe('rankings', () => {
  const clients = [client('甲'), client('乙'), client('丙')];
  const records = [
    rec({ clientName: '甲', totalPrice: 300 }),
    rec({ clientName: '甲', totalPrice: 100 }),
    rec({ clientName: '乙', totalPrice: 500 }),
  ];
  const stats = buildClientStats(records, clients);

  it('orders by order count then amount', () => {
    expect(rankByOrders(stats).map((s) => s.name)).toEqual(['甲', '乙']);
  });

  it('orders by amount', () => {
    expect(rankByAmount(stats).map((s) => s.name)).toEqual(['乙', '甲']);
  });

  it('recent ranking sorts by last purchase desc', () => {
    expect(rankByRecent(stats).map((s) => s.name)).toEqual(['甲', '乙']);
  });
});

describe('groupByLocation', () => {
  it('groups by location and buckets empty location', () => {
    const clients = [client('甲', '广州'), client('乙', '广州'), client('丙', '')];
    const stats = buildClientStats([], clients);
    const groups = groupByLocation(stats);
    expect(groups.map((g) => g.location)).toEqual(['广州', '未填写']);
    expect(groups[0].items.map((s) => s.name)).toEqual(['甲', '乙']);
  });
});

describe('monthlySeries', () => {
  it('buckets records into the last 12 month keys', () => {
    const records = [rec({ date: today(), totalPrice: 88 })];
    const series = monthlySeries(records, '甲');
    expect(series.length).toBe(12);
    const current = series[series.length - 1];
    expect(current.month).toBe(today().slice(0, 7));
    expect(current.amount).toBe(88);
  });
});

describe('productBreakdown', () => {
  it('keeps top items and aggregates the rest', () => {
    const records = [
      rec({ productName: 'A', totalPrice: 100 }),
      rec({ productName: 'B', totalPrice: 50 }),
      rec({ productName: 'C', totalPrice: 30 }),
      rec({ productName: 'D', totalPrice: 10 }),
    ];
    const result = productBreakdown(records, '甲', 2);
    expect(result.slice(0, 2).map((x) => x.name)).toEqual(['A', 'B']);
    expect(result[2]).toEqual({ name: '其他', amount: 40 });
  });
});

describe('suggest & filter', () => {
  it('filters suggestions by substring', () => {
    expect(suggest(['张三', '李四', '张伟'], '张')).toEqual(['张三', '张伟']);
  });

  it('filters records by client/stock/date range', () => {
    const records = [
      rec({ id: '1', clientName: '甲', stockStatus: 'unstocked', date: '2026-08-01' }),
      rec({ id: '2', clientName: '乙', stockStatus: 'stocked', date: '2026-08-10' }),
    ];
    expect(filterRecords(records, { client: '甲', product: '', stock: '', from: '', to: '' })).toHaveLength(1);
    expect(filterRecords(records, { client: '', product: '', stock: 'stocked', from: '', to: '' })).toHaveLength(1);
    expect(filterRecords(records, { client: '', product: '', stock: '', from: '2026-08-05', to: '' })).toHaveLength(1);
  });
});

describe('date helpers', () => {
  it('formats Chinese dates and computes day gaps', () => {
    expect(formatDateCN('2026-08-05')).toBe('2026年8月5日');
    expect(daysSince(today())).toBe(0);
  });
});
