import Dexie, { type Table } from 'dexie';
import type { Client, Record as LedgerRecord } from './types';

export interface SyncMeta {
  key: string;
  value: string;
}

export interface Tombstone {
  entity: 'client' | 'record';
  id: string;
  updatedAt: string;
}

class LedgerDB extends Dexie {
  clients!: Table<Client, string>;
  records!: Table<LedgerRecord, string>;
  meta!: Table<SyncMeta, string>;
  tombstones!: Table<Tombstone, [string, string]>;

  constructor() {
    super('store-ledger');
    this.version(1).stores({
      clients: 'id, name, location, createdAt',
      records: 'id, date, clientName, productName, stockStatus, createdAt',
    });
    this.version(2)
      .stores({
        clients: 'id, name, location, createdAt',
        records: 'id, date, clientName, productName, stockStatus, shipStatus, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('records')
          .toCollection()
          .modify((r: LedgerRecord) => {
            if (!r.shipStatus) r.shipStatus = 'unshipped';
          });
      });
    this.version(3)
      .stores({
        clients: 'id, name, location, createdAt',
        records: 'id, date, clientName, productName, stockStatus, shipStatus, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('records')
          .toCollection()
          .modify((r: LedgerRecord) => {
            if (r.hasPrint === undefined) r.hasPrint = false;
            if (!r.printNote) r.printNote = '';
            if (!Array.isArray(r.noteImages)) r.noteImages = [];
            if (!Array.isArray(r.printImages)) r.printImages = [];
          });
      });
    this.version(4)
      .stores({
        clients: 'id, name, location, createdAt',
        records: 'id, date, clientName, productName, stockStatus, shipStatus, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('records')
          .toCollection()
          .modify((r: LedgerRecord) => {
            if (r.unit === undefined) r.unit = '';
            if (r.paid === undefined) r.paid = false;
          });
      });
    this.version(5)
      .stores({
        clients: 'id, name, location, createdAt',
        records: 'id, date, clientName, productName, stockStatus, shipStatus, deletedAt, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('records')
          .toCollection()
          .modify((r: LedgerRecord) => {
            if (r.deletedAt === undefined) r.deletedAt = null;
          });
      });
    this.version(6)
      .stores({
        clients: 'id, name, location, createdAt',
        records: 'id, date, clientName, productName, stockStatus, shipStatus, deletedAt, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('records')
          .toCollection()
          .modify((r: LedgerRecord) => {
            if (!r.unit) r.unit = '件';
          });
      });
    this.version(7)
      .stores({
        clients: 'id, name, location, createdAt',
        records: 'id, date, clientName, productName, stockStatus, shipStatus, deletedAt, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('records')
          .toCollection()
          .modify((r: LedgerRecord) => {
            if (r.paidAmount === undefined) r.paidAmount = r.paid ? r.totalPrice : 0;
            if (r.starred === undefined) r.starred = false;
          });
      });
    this.version(8)
      .stores({
        clients: 'id, name, location, createdAt, updatedAt',
        records: 'id, date, clientName, productName, stockStatus, shipStatus, deletedAt, createdAt, updatedAt',
        meta: 'key',
        tombstones: '[entity+id], entity, updatedAt',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();
        await tx
          .table('records')
          .toCollection()
          .modify((r: LedgerRecord) => {
            if (!r.updatedAt) r.updatedAt = r.createdAt || now;
          });
        await tx
          .table('clients')
          .toCollection()
          .modify((c: Client) => {
            if (!c.updatedAt) c.updatedAt = c.createdAt || now;
          });
      });

    // 本地编辑自动打 updatedAt 时间戳（记录/客户）。显式带 updatedAt 的写入（如同步写回）保持不变。
    const stamp = () => new Date().toISOString();
    const withStamp = (o: { updatedAt?: string }) => {
      if (!o.updatedAt) o.updatedAt = stamp();
    };
    this.clients.hook('creating', (primKey, obj) => {
      void primKey;
      withStamp(obj as Client);
    });
    this.records.hook('creating', (primKey, obj) => {
      void primKey;
      withStamp(obj as LedgerRecord);
    });
    this.clients.hook('updating', (mods) => {
      const m = mods as { updatedAt?: string };
      if (!m.updatedAt) m.updatedAt = stamp();
      return mods;
    });
    this.records.hook('updating', (mods) => {
      const m = mods as { updatedAt?: string };
      if (!m.updatedAt) m.updatedAt = stamp();
      return mods;
    });
  }
}

export const activeRecordsQuery = () => db.records.filter((r) => !r.deletedAt).toArray();

export const db = new LedgerDB();

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
