import { db, type Tombstone } from '../db';
import { apiSyncPush, apiSyncPull, apiUploadImage, type SyncPushItem } from './cloud';
import type { Client, Record as LedgerRecord } from '../types';

/** 每实体同步游标 key */
const CURSOR_PREFIX = 'sync:cursor:';

async function getCursor(entity: string): Promise<string | undefined> {
  const row = await db.meta.get(CURSOR_PREFIX + entity);
  return row?.value;
}

async function setCursor(entity: string, iso: string): Promise<void> {
  await db.meta.put({ key: CURSOR_PREFIX + entity, value: iso });
}

function nowIso(): string {
  return new Date().toISOString();
}

/** 服务端返回行（平铺 + _meta）→ 本地 Client */
export function serverRowToClient(g: Record<string, unknown>, fallbackUpdatedAt: string): Client {
  const meta = (g._meta ?? {}) as { updatedAt?: string };
  return {
    id: String(g.id ?? ''),
    name: String(g.name ?? ''),
    location: String(g.location ?? ''),
    wechatId: String(g.wechatId ?? ''),
    phone: String(g.phone ?? ''),
    createdAt: String(g.createdAt ?? fallbackUpdatedAt),
    updatedAt: String(meta.updatedAt ?? g.updatedAt ?? fallbackUpdatedAt),
  };
}

/** 服务端返回行（平铺 + _meta）→ 本地账目 */
export function serverRowToRecord(g: Record<string, unknown>, fallbackUpdatedAt: string): LedgerRecord {
  const meta = (g._meta ?? {}) as { updatedAt?: string };
  return {
    id: String(g.id ?? ''),
    date: String(g.date ?? ''),
    clientName: String(g.clientName ?? ''),
    clientLocation: String(g.clientLocation ?? ''),
    productName: String(g.productName ?? ''),
    quantity: Number(g.quantity ?? 0),
    unit: String(g.unit ?? '件'),
    unitPrice: Number(g.unitPrice ?? 0),
    totalPrice: Number(g.totalPrice ?? 0),
    note: String(g.note ?? ''),
    stockStatus: (g.stockStatus as LedgerRecord['stockStatus']) ?? 'unstocked',
    shipStatus: (g.shipStatus as LedgerRecord['shipStatus']) ?? 'unshipped',
    hasPrint: Boolean(g.hasPrint),
    printNote: String(g.printNote ?? ''),
    noteImages: Array.isArray(g.noteImages) ? (g.noteImages as string[]) : [],
    printImages: Array.isArray(g.printImages) ? (g.printImages as string[]) : [],
    paid: Boolean(g.paid),
    paidAmount: Number(g.paidAmount ?? 0),
    starred: Boolean(g.starred),
    deletedAt: (g.deletedAt as string | null) ?? null,
    createdAt: String(g.createdAt ?? fallbackUpdatedAt),
    updatedAt: String(meta.updatedAt ?? g.updatedAt ?? fallbackUpdatedAt),
  };
}

/** 图片 dataURL -> URL（逐张上传）；失败返回 null 表示整项本次跳过 */
async function uploadImages(list: string[] | undefined): Promise<string[] | null> {
  if (!list || list.length === 0) return list ?? [];
  const out: string[] = [];
  for (const src of list) {
    if (!/^data:image\//.test(src)) {
      out.push(src); // 已是 URL，保留
      continue;
    }
    try {
      const r = await apiUploadImage(src);
      out.push(r.url);
    } catch {
      return null; // 有图传不上：本次跳过该行，下次再试
    }
  }
  return out;
}

export interface PushOutcome {
  pushed: number;
  conflicts: number;
  skippedImages: number;
}

/**
 * 把本地新增/修改/软删/墓碑推送到云端（带每行 updatedAt，服务端 LWW 裁决）。
 * 服务端接受(applied)后，若图片已从 dataURL 换成 URL，写回本地避免下次重复上传。
 */
export async function pushLocal(): Promise<PushOutcome> {
  const [clients, records, tombstones] = await Promise.all([
    db.clients.toArray(),
    db.records.toArray(),
    db.tombstones.toArray(),
  ]);

  const items: SyncPushItem[] = [];
  let skippedImages = 0;
  const recordRefs: { row: LedgerRecord; noteImages: string[]; printImages: string[] }[] = [];

  const pushRow = async (entity: 'client' | 'record', row: Client | LedgerRecord, isTombstone = false) => {
    const updatedAt = row.updatedAt ?? row.createdAt ?? nowIso();
    let data: Record<string, unknown> = row as unknown as Record<string, unknown>;
    if (entity === 'record' && !isTombstone) {
      const r = row as LedgerRecord;
      const noteImages = await uploadImages(r.noteImages);
      const printImages = await uploadImages(r.printImages);
      if (noteImages === null || printImages === null) {
        skippedImages++;
        return;
      }
      recordRefs.push({ row: r, noteImages, printImages });
      data = { ...(r as unknown as Record<string, unknown>), noteImages, printImages };
    }
    items.push({
      entity,
      id: row.id,
      data,
      updatedAt,
      deletedAt: isTombstone ? updatedAt : ((row as LedgerRecord).deletedAt ?? null),
    });
  };

  for (const c of clients) await pushRow('client', c);
  for (const r of records) await pushRow('record', r);
  for (const t of tombstones) {
    items.push({ entity: t.entity, id: t.id, data: { id: t.id }, updatedAt: t.updatedAt, deletedAt: t.updatedAt });
  }

  if (items.length === 0) return { pushed: 0, conflicts: 0, skippedImages };

  const { results } = await apiSyncPush(items);
  const pushed = results.filter((r) => r.applied).length;
  const conflicts = results.filter((r) => !r.applied).length;
  const ok = results.every((r) => r.applied);
  if (ok && tombstones.length > 0) {
    await db.tombstones.clear();
  }

  // 图片已换 URL 的行：写回本地（显式带 updatedAt，Dexie hook 不会改它，避免循环上传）
  for (const ref of recordRefs) {
    const orig = ref.row;
    const hadDataUrl =
      orig.noteImages.some((s) => /^data:image\//.test(s)) ||
      orig.printImages.some((s) => /^data:image\//.test(s));
    if (hadDataUrl && orig.noteImages.length === ref.noteImages.length && orig.printImages.length === ref.printImages.length) {
      await db.records.put({ ...orig, noteImages: ref.noteImages, printImages: ref.printImages });
    }
  }

  return { pushed, conflicts, skippedImages };
}

export interface PullOutcome {
  pulled: number;
  applied: number;
  clientCursor: string;
  recordCursor: string;
}

/**
 * 增量下拉（服务端游标）。把云端新行合并进本地：
 * - 服务端行比本地新（updatedAt 更大）→ 覆盖/新增；墓碑(meta.deletedAt) → 本地删/软删
 * - 本地比服务端新 → 保留本地（下次 push 会上行）
 */
export async function pullRemote(): Promise<PullOutcome> {
  const [clientSince, recordSince] = await Promise.all([getCursor('client'), getCursor('record')]);
  const data = await apiSyncPull({ clientSince, recordSince });

  let applied = 0;

  for (const g of data.client.items) {
    const meta = (g._meta ?? {}) as { updatedAt: string; deletedAt: string | null };
    const serverUpdatedAt = meta.updatedAt ?? nowIso();
    const existing = await db.clients.get(g.id as string);
    if (meta.deletedAt) {
      // 云端已删：本地也删（若有），并记墓碑避免复活
      if (existing) {
        await db.clients.delete(g.id as string);
        await putTombstone('client', g.id as string, serverUpdatedAt);
      }
      applied++;
      continue;
    }
    const localUpdatedAt = existing?.updatedAt ?? existing?.createdAt ?? '';
    if (!existing || serverUpdatedAt > localUpdatedAt) {
      await db.clients.put(serverRowToClient(g, serverUpdatedAt));
      applied++;
    }
  }

  for (const g of data.record.items) {
    const meta = (g._meta ?? {}) as { updatedAt: string; deletedAt: string | null };
    const serverUpdatedAt = meta.updatedAt ?? nowIso();
    const existing = await db.records.get(g.id as string);
    if (meta.deletedAt) {
      // 云端墓碑 → 本地若为活跃行则软删进回收站（墓碑行本身不必落地）
      if (existing && !existing.deletedAt) {
        await db.records.update(g.id as string, { deletedAt: meta.deletedAt });
      }
      applied++;
      continue;
    }
    const localUpdatedAt = existing?.updatedAt ?? existing?.createdAt ?? '';
    if (!existing || serverUpdatedAt > localUpdatedAt) {
      await db.records.put(serverRowToRecord(g, serverUpdatedAt));
      applied++;
    }
  }

  await Promise.all([
    setCursor('client', data.client.maxUpdatedAt),
    setCursor('record', data.record.maxUpdatedAt),
  ]);

  return {
    pulled: data.client.items.length + data.record.items.length,
    applied,
    clientCursor: data.client.maxUpdatedAt,
    recordCursor: data.record.maxUpdatedAt,
  };
}

export async function putTombstone(entity: 'client' | 'record', id: string, updatedAt?: string): Promise<void> {
  const existing = await db.tombstones.get([entity, id]);
  if (existing && existing.updatedAt >= (updatedAt ?? existing.updatedAt)) return;
  await db.tombstones.put({ entity, id, updatedAt: updatedAt ?? nowIso() } satisfies Tombstone);
}

/** 物理删除某行：本地删 + 墓碑（云端其它设备会收到删除） */
export async function deleteLocal(entity: 'client' | 'record', id: string): Promise<void> {
  await putTombstone(entity, id);
  if (entity === 'client') await db.clients.delete(id);
  else await db.records.delete(id);
}

/** 一次性全量同步：先 push 本地，再 pull 云端（供登录后/手动触发） */
export async function syncAll(): Promise<{ push: PushOutcome; pull: PullOutcome }> {
  const push = await pushLocal();
  const pull = await pullRemote();
  return { push, pull };
}

/** 登录成功后拉一次（服务端游标为空 => 全量） */
export async function firstSyncAfterLogin(): Promise<PullOutcome> {
  return pullRemote();
}
