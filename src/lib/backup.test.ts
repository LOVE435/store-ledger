import { describe, expect, it } from 'vitest';
import type { Client, Record } from '../types';
import { buildBackupJson, buildCsv, parseBackupJson } from './backup';

function sampleRecords(): Record[] {
  return [
    {
      id: 'r1',
      date: '2026-08-01',
      clientName: '甲',
      clientLocation: '广州',
      productName: '反光背心',
      quantity: 10,
      unit: '件',
      unitPrice: 25,
      totalPrice: 250,
      note: '含逗号, 引号" 和换行\n的内容',
      stockStatus: 'unstocked',
      shipStatus: 'unshipped',
      hasPrint: true,
      printNote: '背后印 XX 公司',
      noteImages: ['data:image/png;base64,AAA'],
      printImages: [],
      paid: true,
      paidAmount: 250,
      starred: true,
      deletedAt: '2026-08-02T00:00:00.000Z',
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ];
}

function sampleClients(): Client[] {
  return [{ id: 'c1', name: '甲', location: '广州', wechatId: 'wx_001', phone: '13800000000', createdAt: '2026-01-01T00:00:00.000Z' }];
}

describe('buildCsv', () => {
  it('escapes commas, quotes and newlines', () => {
    const csv = buildCsv(sampleRecords());
    expect(csv).toContain('"含逗号, 引号"" 和换行\n的内容"');
    expect(csv.startsWith('\ufeff')).toBe(true);
  });

  it('includes the ship progress column', () => {
    const csv = buildCsv(sampleRecords());
    expect(csv).toContain('发货进度');
    expect(csv).toContain('未发货');
    expect(csv).toContain('印字');
    expect(csv).toContain('是');
    expect(csv).toContain('背后印 XX 公司');
    expect(csv).toContain('单位');
    expect(csv).toContain('件');
    expect(csv).toContain('已付款');
    expect(csv).toContain('已付金额');
    expect(csv).toContain('剩余金额');
    expect(csv).toContain('★');
  });
});

describe('backup round trip', () => {
  it('exports and parses back identical data', () => {
    const clients = sampleClients();
    const records = sampleRecords();
    const parsed = parseBackupJson(buildBackupJson(clients, records));
    expect(parsed.clients).toEqual(clients);
    expect(parsed.records).toEqual(records);
  });

  it('rejects malformed files', () => {
    expect(() => parseBackupJson('{"version":2,"clients":[],"records":[]}')).toThrow();
    expect(() => parseBackupJson('not json')).toThrow();
  });

  it('defaults missing new fields on legacy import', () => {
    const rec = sampleRecords()[0];
    const legacy = JSON.parse(JSON.stringify(rec)) as { [k: string]: unknown };
    delete legacy.shipStatus;
    delete legacy.hasPrint;
    delete legacy.printNote;
    delete legacy.noteImages;
    delete legacy.printImages;
    delete legacy.unit;
    delete legacy.paid;
    delete legacy.paidAmount;
    delete legacy.starred;
    delete legacy.deletedAt;
    const text = JSON.stringify({ version: 1, exportedAt: '', clients: sampleClients(), records: [legacy] });
    const parsed = parseBackupJson(text).records[0];
    expect(parsed.shipStatus).toBe('unshipped');
    expect(parsed.hasPrint).toBe(false);
    expect(parsed.printNote).toBe('');
    expect(parsed.noteImages).toEqual([]);
    expect(parsed.printImages).toEqual([]);
    expect(parsed.unit).toBe('件');
    expect(parsed.paid).toBe(false);
    expect(parsed.paidAmount).toBe(0);
    expect(parsed.starred).toBe(false);
    expect(parsed.deletedAt).toBeNull();
  });
});
