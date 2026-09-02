/**
 * 记账业务实体。data 以 JSON 全量保存前端对象（Client / Record 全部字段），
 * 由 owner_id 隔离、updated_at 驱动增量同步、deleted_at 作为软删除墓碑。
 */

export const ENTITY_CLIENT = 'client' as const;
export const ENTITY_RECORD = 'record' as const;

export type LedgerEntity = typeof ENTITY_CLIENT | typeof ENTITY_RECORD;

export const LEDGER_ENTITIES: readonly LedgerEntity[] = [ENTITY_CLIENT, ENTITY_RECORD];

/** 前端 Client 字段（与 store-ledger/src/types.ts 对齐） */
export const CLIENT_FIELDS = ['id', 'name', 'location', 'wechatId', 'phone', 'createdAt'] as const;

/** 前端 Record 字段（与 store-ledger/src/types.ts 对齐，含图片数组等全部字段） */
export const RECORD_FIELDS = [
  'id',
  'date',
  'clientName',
  'clientLocation',
  'productName',
  'quantity',
  'unit',
  'unitPrice',
  'totalPrice',
  'note',
  'stockStatus',
  'shipStatus',
  'hasPrint',
  'printNote',
  'noteImages',
  'printImages',
  'paid',
  'paidAmount',
  'starred',
  'deletedAt',
  'createdAt',
] as const;

export interface LedgerItemRow {
  owner_id: number;
  entity: LedgerEntity;
  id: string;
  data: string; // JSON 文本
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export class LedgerItem {
  ownerId: number;
  entity: LedgerEntity;
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  constructor(row: LedgerItemRow) {
    this.ownerId = Number(row.owner_id);
    this.entity = row.entity;
    this.id = row.id;
    this.data = parseJson(row.data);
    this.createdAt = row.created_at;
    this.updatedAt = row.updated_at;
    this.deletedAt = row.deleted_at;
  }

  toJSON() {
    return {
      id: this.id,
      ...this.data,
      _meta: {
        ownerId: this.ownerId,
        entity: this.entity,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        deletedAt: this.deletedAt,
      },
    };
  }
}

function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function isValidEntity(value: string): value is LedgerEntity {
  return LEDGER_ENTITIES.includes(value as LedgerEntity);
}
