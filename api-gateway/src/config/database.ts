import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './index';

/** 将 PostgreSQL 的 $1/$2 占位符转换为 SQLite 的 ? 占位符 */
function convertPlaceholders(sql: string): string {
  return sql.replace(/\$(\d+)/g, '?');
}

/** SQLite 绑定参数只支持 null/number/bigint/string/buffer，boolean 需转 0/1 */
function normalizeParam(value: unknown): any {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) return null;
  return value;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 多用户记账业务数据：owner_id 隔离，data 存完整前端对象（JSON）
CREATE TABLE IF NOT EXISTS ledger_items (
  owner_id INTEGER NOT NULL,
  entity TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (owner_id, entity, id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_owner_updated ON ledger_items (owner_id, entity, updated_at);
CREATE INDEX IF NOT EXISTS idx_ledger_owner_entity ON ledger_items (owner_id, entity, deleted_at);
`;

export class Database {
  private db: DatabaseSync;

  constructor() {
    const file = process.env.NODE_ENV === 'test' ? ':memory:' : config.database.file;
    if (file !== ':memory:') {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    this.db = new DatabaseSync(file);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(SCHEMA);
  }

  async query(text: string, params: any[] = []): Promise<{ rows: any[]; changes?: number | bigint }> {
    const sql = convertPlaceholders(text);
    const values = params.map(normalizeParam);
    const start = Date.now();
    const stmt = this.db.prepare(sql);

    const isRead = /^\s*SELECT/i.test(sql) || /RETURNING/i.test(sql);
    if (isRead) {
      const rows = stmt.all(...values) as any[];
      const duration = Date.now() - start;
      console.log('Query executed:', { text: sql, duration, params: values });
      return { rows };
    }

    const info = stmt.run(...values);
    const duration = Date.now() - start;
    console.log('Query executed:', { text: sql, duration, params: values });
    return { rows: [], changes: Number(info.changes) };
  }

  connect(): this {
    return this;
  }

  end(): void {
    this.db.close();
  }
}