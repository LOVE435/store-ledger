import { Database } from '../config/database';
import {
  LedgerItem,
  isValidEntity,
  type LedgerEntity,
  type LedgerItemRow,
  CLIENT_FIELDS,
  RECORD_FIELDS,
} from '../models/LedgerItem';
import { AppError } from '../utils/AppError';

const FIELD_WHITELIST: Record<LedgerEntity, readonly string[]> = {
  client: CLIENT_FIELDS,
  record: RECORD_FIELDS,
};

function pickAllowed(entity: LedgerEntity, data: Record<string, unknown>): Record<string, unknown> {
  const allowed = FIELD_WHITELIST[entity];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in data) out[key] = data[key];
  }
  return out;
}

export interface SyncPushItem {
  entity: string;
  id: string;
  data?: Record<string, unknown>;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface SyncPushResult {
  entity: string;
  id: string;
  applied: boolean; // false = 服务端有更新版本，客户端应合并 server 行
  server: Record<string, unknown> | null;
}

export interface SyncPullParams {
  clientSince?: string;
  recordSince?: string;
}

/**
 * 批量同步服务：多设备对同一账号(owner)的数据增量交换。
 * 冲突策略 LWW：客户端带 updatedAt 上行，若服务端现有行 updated_at 更新则拒绝并回传服务端行。
 */
export class SyncService {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  async push(ownerId: number, items: SyncPushItem[]): Promise<SyncPushResult[]> {
    const results: SyncPushResult[] = [];
    for (const item of items || []) {
      results.push(await this.pushOne(ownerId, item));
    }
    return results;
  }

  private async pushOne(ownerId: number, item: SyncPushItem): Promise<SyncPushResult> {
    const { entity: entityRaw, id } = item;
    if (!isValidEntity(entityRaw)) {
      return { entity: entityRaw, id: String(id), applied: false, server: null };
    }
    const entity = entityRaw as LedgerEntity;
    const obj = (item.data ?? {}) as Record<string, unknown>;
    if (!id || (obj.id && String(obj.id) !== String(id))) {
      throw new AppError('同步项缺少有效 id', 400);
    }
    const clientUpdatedAt = item.updatedAt || obj.updatedAt || obj.createdAt || new Date(0).toISOString();
    const clientDeletedAt = item.deletedAt !== undefined ? item.deletedAt : (obj.deletedAt as string | null) || null;

    // 查服务端现有行，判断 LWW
    const existing = await this.db.query(
      `SELECT * FROM ledger_items WHERE owner_id = $1 AND entity = $2 AND id = $3`,
      [ownerId, entity, String(id)]
    );
    const row = existing.rows[0] as LedgerItemRow | undefined;
    if (row && row.updated_at > clientUpdatedAt) {
      return {
        entity,
        id: String(id),
        applied: false,
        server: new LedgerItem(row).toJSON(),
      };
    }

    // 接受客户端版本（LWW：客户端较新或服务端无此数据）
    const clean = pickAllowed(entity, obj);
    if (obj.id !== undefined && String(obj.id) !== String(id)) clean.id = String(id);
    const createdAt = row ? row.created_at : (obj.createdAt ? String(obj.createdAt) : new Date().toISOString());
    const result = await this.db.query(
      `INSERT INTO ledger_items (owner_id, entity, id, data, created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (owner_id, entity, id) DO UPDATE SET
         data = excluded.data,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at
       RETURNING *`,
      [ownerId, entity, String(id), JSON.stringify(clean), createdAt, clientUpdatedAt, clientDeletedAt]
    );
    return {
      entity,
      id: String(id),
      applied: true,
      server: new LedgerItem(result.rows[0] as LedgerItemRow).toJSON(),
    };
  }

  /** 增量拉取两类实体：带各自游标，返回 items + 各自 maxUpdatedAt */
  async pull(ownerId: number, params: SyncPullParams) {
    const out: Record<string, { items: Record<string, unknown>[]; maxUpdatedAt: string }> = {};
    for (const entity of ['client', 'record'] as const) {
      const since = params[entity === 'client' ? 'clientSince' : 'recordSince'];
      const rows = since
        ? await this.listChangesSince(ownerId, entity, since)
        : await this.listAll(ownerId, entity);
      const maxResult = await this.db.query(
        `SELECT MAX(updated_at) AS m FROM ledger_items WHERE owner_id = $1 AND entity = $2`,
        [ownerId, entity]
      );
      out[entity] = {
        items: rows.map((r) => r.toJSON()),
        maxUpdatedAt: maxResult.rows[0]?.m ? String(maxResult.rows[0].m) : '1970-01-01T00:00:00.000Z',
      };
    }
    return out;
  }

  private async listChangesSince(ownerId: number, entity: LedgerEntity, sinceIso: string): Promise<LedgerItem[]> {
    const result = await this.db.query(
      `SELECT * FROM ledger_items WHERE owner_id = $1 AND entity = $2 AND updated_at > $3 ORDER BY updated_at ASC`,
      [ownerId, entity, sinceIso]
    );
    return (result.rows as LedgerItemRow[]).map((r) => new LedgerItem(r));
  }

  private async listAll(ownerId: number, entity: LedgerEntity): Promise<LedgerItem[]> {
    const result = await this.db.query(
      `SELECT * FROM ledger_items WHERE owner_id = $1 AND entity = $2 ORDER BY updated_at ASC`,
      [ownerId, entity]
    );
    return (result.rows as LedgerItemRow[]).map((r) => new LedgerItem(r));
  }
}

export const syncService = new SyncService();
