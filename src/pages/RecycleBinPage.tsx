import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { deleteLocal } from '../lib/sync';
import { formatDateCN } from '../lib/analysis';
import { formatMoney } from '../lib/money';
import type { Record } from '../types';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';

export default function RecycleBinPage() {
  const deleted = useLiveQuery(() => db.records.filter((r) => !!r.deletedAt).toArray(), []) ?? [];
  const list = useMemo(
    () => [...deleted].sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')),
    [deleted],
  );
  const [purgeTarget, setPurgeTarget] = useState<Record | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const restore = async (r: Record) => {
    await db.records.update(r.id, { deletedAt: null });
    setMsg('已恢复');
  };

  const purge = async (r: Record) => {
    await deleteLocal('record', r.id);
    setPurgeTarget(null);
    setMsg('已彻底删除（其它设备同步后也会移除）');
  };

  const emptyAll = async () => {
    for (const r of list) {
      await deleteLocal('record', r.id);
    }
    setEmptyOpen(false);
    setMsg('回收站已清空（其它设备同步后也会移除）');
  };

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <Link to="/settings" className="text-sm text-teal-700">
          ← 返回
        </Link>
        <h1 className="text-lg font-bold">回收站</h1>
        {list.length > 0 ? (
          <button type="button" onClick={() => setEmptyOpen(true)} className="text-sm font-medium text-red-600">
            清空
          </button>
        ) : (
          <span className="w-10" />
        )}
      </header>

      {list.length === 0 && <EmptyState text="回收站是空的" />}
      <div className="space-y-2">
        {list.map((r) => (
          <div key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{r.productName}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {r.clientName}
                  {r.clientLocation && ` · ${r.clientLocation}`} · {formatDateCN(r.date)}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  删除于 {r.deletedAt ? new Date(r.deletedAt).toLocaleString('zh-CN', { hour12: false }) : ''}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-slate-800">{formatMoney(r.totalPrice)}</span>
            </div>
            <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => void restore(r)}
                className="flex-1 rounded-lg bg-teal-700 py-1.5 text-xs font-semibold text-white active:bg-teal-800"
              >
                ↩ 恢复
              </button>
              <button
                type="button"
                onClick={() => setPurgeTarget(r)}
                className="flex-1 rounded-lg border border-red-300 py-1.5 text-xs font-semibold text-red-600"
              >
                🗑 彻底删除
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={purgeTarget !== null}
        title="彻底删除"
        message={`「${purgeTarget?.productName ?? ''}」将从回收站彻底删除，无法恢复。确定吗？`}
        confirmText="彻底删除"
        danger
        onConfirm={() => {
          if (purgeTarget) void purge(purgeTarget);
        }}
        onCancel={() => setPurgeTarget(null)}
      />
      <ConfirmDialog
        open={emptyOpen}
        title="清空回收站"
        message={`将彻底删除回收站中的 ${list.length} 条账目，无法恢复。确定吗？`}
        confirmText="清空"
        danger
        onConfirm={() => void emptyAll()}
        onCancel={() => setEmptyOpen(false)}
      />
      <Toast message={msg} />
    </div>
  );
}
