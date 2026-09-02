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

/** 每种实体允许保存的字段白名单（防止用户写入 ownerId/_meta 等元数据污染） */
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

/**
 * 业务数据服务：一账号(owner)一店一账本。
 * data 以 JSON 存整行前端对象；updated_at 驱动增量同步；deleted_at 为墓碑。
 */
export class LedgerService {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  /** upsert 单行（同 owner + entity + id 覆盖），返回服务端当前行 */
  async upsert(ownerId: number, entityRaw: string, id: string, data: unknown): Promise<LedgerItem> {
    if (!isValidEntity(entityRaw)) {
      throw new AppError(`不支持的实体类型: ${entityRaw}`, 400);
    }
    const entity = entityRaw as LedgerEntity;
    const obj = (data ?? {}) as Record<string, unknown>;
    if (!obj.id || String(obj.id) !== id) {
      throw new AppError('数据 id 与路径不一致', 400);
    }
    const clean = pickAllowed(entity, obj);
    const now = new Date().toISOString();
    const createdAt = obj.createdAt ? String(obj.createdAt) : now;
    const updatedAt = obj.updatedAt ? String(obj.updatedAt) : now;
    const deletedAt = obj.deletedAt ? String(obj.deletedAt) : null;

    const result = await this.db.query(
      `INSERT INTO ledger_items (owner_id, entity, id, data, created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (owner_id, entity, id) DO UPDATE SET
         data = excluded.data,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at
       RETURNING *`,
      [ownerId, entity, id, JSON.stringify(clean), createdAt, updatedAt, deletedAt]
    );
    return new LedgerItem(result.rows[0] as LedgerItemRow);
  }

  /** 按 owner + entity 拉取全部行（含墓碑行，由调用方决定过滤） */
  async listByOwner(ownerId: number, entityRaw: string): Promise<LedgerItem[]> {
    if (!isValidEntity(entityRaw)) {
      throw new AppError(`不支持的实体类型: ${entityRaw}`, 400);
    }
    const result = await this.db.query(
      `SELECT * FROM ledger_items WHERE owner_id = $1 AND entity = $2 ORDER BY updated_at ASC`,
      [ownerId, entityRaw]
    );
    return (result.rows as LedgerItemRow[]).map((r) => new LedgerItem(r));
  }

  /** 按 owner + entity 拉取自某时间之后变化的行（增量同步用，updated_at 严格大于 since） */
  async listChangesSince(ownerId: number, entityRaw: string, sinceIso: string): Promise<LedgerItem[]> {
    if (!isValidEntity(entityRaw)) {
      throw new AppError(`不支持的实体类型: ${entityRaw}`, 400);
    }
    const result = await this.db.query(
      `SELECT * FROM ledger_items WHERE owner_id = $1 AND entity = $2 AND updated_at > $3 ORDER BY updated_at ASC`,
      [ownerId, entityRaw, sinceIso]
    );
    return (result.rows as LedgerItemRow[]).map((r) => new LedgerItem(r));
  }

  /** 软删除：写 deleted_at 墓碑（同步可传播删除） */
  async softDelete(ownerId: number, entityRaw: string, id: string): Promise<LedgerItem | null> {
    if (!isValidEntity(entityRaw)) {
      throw new AppError(`不支持的实体类型: ${entityRaw}`, 400);
    }
    const now = new Date().toISOString();
    const result = await this.db.query(
      `UPDATE ledger_items
       SET deleted_at = $1, updated_at = $2
       WHERE owner_id = $3 AND entity = $4 AND id = $5
       RETURNING *`,
      [now, now, ownerId, entityRaw, id]
    );
    if (result.rows.length === 0) return null;
    return new LedgerItem(result.rows[0] as LedgerItemRow);
  }

  /** 取该 owner 某实体最新一条 updated_at（用于初始化同步游标），无数据返回 epoch */
  async maxUpdatedAt(ownerId: number, entityRaw: string): Promise<string> {
    if (!isValidEntity(entityRaw)) {
      throw new AppError(`不支持的实体类型: ${entityRaw}`, 400);
    }
    const result = await this.db.query(
      `SELECT MAX(updated_at) AS m FROM ledger_items WHERE owner_id = $1 AND entity = $2`,
      [ownerId, entityRaw]
    );
    const m = result.rows[0]?.m;
    return m ? String(m) : '1970-01-01T00:00:00.000Z';
  }
}

export const ledgerService = new LedgerService();
