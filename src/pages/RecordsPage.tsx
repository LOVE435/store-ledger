import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { activeRecordsQuery, db } from '../db';
import {
  EMPTY_FILTER,
  filterRecords,
  formatDateShortCN,
  statusBatchPatch,
  today,
  toggleShip,
  toggleStock,
  uniqueStrings,
  type RecordFilter,
} from '../lib/analysis';
import { formatMoney, parseNum } from '../lib/money';
import { SHIP_LABELS, STOCK_LABELS, type Record } from '../types';
import EmptyState from '../components/EmptyState';
import ThumbStrip from '../components/ThumbStrip';
import PaidBadge from '../components/PaidBadge';
import ConfirmDialog from '../components/ConfirmDialog';

type View = 'today' | 'all';
type ShipFilter = '' | 'unshipped' | 'shipped';

function CheckToggle({
  checked,
  label,
  tone,
  onChange,
}: {
  checked: boolean;
  label: string;
  tone: 'red' | 'green' | 'amber' | 'blue';
  onChange: () => void;
}) {
  const box =
    checked
      ? tone === 'green'
        ? 'border-emerald-500 bg-emerald-500 text-white'
        : tone === 'blue'
          ? 'border-blue-500 bg-blue-500 text-white'
          : 'border-red-500 bg-red-500 text-white'
      : tone === 'red'
        ? 'border-red-400 text-transparent'
        : tone === 'amber'
          ? 'border-amber-400 text-transparent'
          : 'border-slate-300 text-transparent';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onChange();
      }}
      className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 active:opacity-70"
    >
      <span className={`flex h-5 w-5 items-center justify-center rounded border-2 text-xs font-bold ${box}`}>✓</span>
      {label}
    </button>
  );
}

function BatchBtn({ label, done, onClick }: { label: string; done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      className={`rounded-lg border py-1.5 text-xs font-bold ${
        done ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-300 bg-white text-slate-500'
      }`}
    >
      {done ? `✓ 全部${label}` : `全部${label}`}
    </button>
  );
}

function StarButton({ starred, onToggle }: { starred: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onToggle();
      }}
      className="text-xl leading-none"
      aria-label="重点标注"
    >
      <span className={starred ? 'text-amber-400' : 'text-slate-300'}>{starred ? '★' : '☆'}</span>
    </button>
  );
}

function PaymentEditor({ record }: { record: Record }) {
  const [val, setVal] = useState(String(record.paidAmount));
  useEffect(() => setVal(String(record.paidAmount)), [record.paidAmount]);
  const remaining = Math.max(0, Math.round((record.totalPrice - record.paidAmount) * 100) / 100);
  const paid = remaining <= 0;
  const save = async (amount: number) => {
    const clamped = Math.max(0, Math.round(amount * 100) / 100);
    await db.records.update(record.id, { paidAmount: clamped, paid: clamped >= record.totalPrice });
  };
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-2"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          void save(paid ? 0 : record.totalPrice);
        }}
        className={`flex items-center gap-1.5 text-xs font-semibold ${paid ? 'text-emerald-700' : 'text-slate-600'}`}
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded border-2 text-xs font-bold ${
            paid ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent'
          }`}
        >
          ✓
        </span>
        {paid ? '已付清' : '付清'}
      </button>
      <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
        已付 ¥
        <input
          type="number"
          inputMode="decimal"
          min="0"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => void save(parseNum(val))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm font-bold"
        />
      </label>
      <span className={`text-xs font-bold ${remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
        {remaining > 0 ? `剩余 ${formatMoney(remaining)}` : '已付清'}
      </span>
    </div>
  );
}

export default function RecordsPage() {
  const records =
    useLiveQuery(() => activeRecordsQuery().then((rs) => rs.sort((a, b) => b.date.localeCompare(a.date))), []) ?? [];
  const clients = useLiveQuery(() => db.clients.toArray(), []) ?? [];
  const [view, setView] = useState<View>('today');
  const [editMode, setEditMode] = useState(false);
  const [filter, setFilter] = useState<RecordFilter>(EMPTY_FILTER);
  const [shipFilter, setShipFilter] = useState<ShipFilter>('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [starredOnly, setStarredOnly] = useState(false);
  const [multiMode, setMultiMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clearOpen, setClearOpen] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('ledger-records-state');
    if (!raw) return;
    try {
      const s = JSON.parse(raw) as {
        view?: View;
        editMode?: boolean;
        filter?: RecordFilter;
        shipFilter?: ShipFilter;
        starredOnly?: boolean;
        collapsed?: string[];
        scrollY?: number;
      };
      if (s.view === 'today' || s.view === 'all') setView(s.view);
      if (typeof s.editMode === 'boolean') setEditMode(s.editMode);
      if (s.filter) setFilter(s.filter);
      if (s.shipFilter) setShipFilter(s.shipFilter);
      if (typeof s.starredOnly === 'boolean') setStarredOnly(s.starredOnly);
      if (Array.isArray(s.collapsed)) setCollapsed(new Set(s.collapsed));
      sessionStorage.removeItem('ledger-records-state');
      if (typeof s.scrollY === 'number' && s.scrollY > 0) {
        const y = s.scrollY;
        window.setTimeout(() => window.scrollTo(0, y), 120);
      }
    } catch {
      /* ignore malformed saved state */
    }
  }, []);

  useEffect(() => {
    return () => {
      sessionStorage.setItem(
        'ledger-records-state',
        JSON.stringify({
          view,
          editMode,
          filter,
          shipFilter,
          starredOnly,
          collapsed: [...collapsed],
          scrollY: window.scrollY,
        }),
      );
    };
  }, [view, editMode, filter, shipFilter, starredOnly, collapsed]);

  const clientNames = useMemo(
    () => clients.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [clients],
  );
  const products = useMemo(
    () => uniqueStrings(records.map((r) => r.productName)).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [records],
  );
  const viewRecords = useMemo(
    () => (view === 'today' ? records.filter((r) => r.date === today()) : records),
    [view, records],
  );
  const filtered = useMemo(
    () =>
      filterRecords(viewRecords, filter)
        .filter((r) => shipFilter === '' || r.shipStatus === shipFilter)
        .filter((r) => !starredOnly || r.starred),
    [viewRecords, filter, shipFilter, starredOnly],
  );
  const total = useMemo(() => filtered.reduce((acc, r) => acc + r.totalPrice, 0), [filtered]);
  const unstocked = useMemo(() => filtered.filter((r) => r.stockStatus === 'unstocked').length, [filtered]);
  const unshipped = useMemo(() => filtered.filter((r) => r.shipStatus === 'unshipped').length, [filtered]);
  const unpaidTotal = useMemo(
    () =>
      filtered.reduce((acc, r) => acc + Math.max(0, Math.round((r.totalPrice - r.paidAmount) * 100) / 100), 0),
    [filtered],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, Record[]>();
    for (const r of filtered) {
      const arr = map.get(r.clientName) ?? [];
      arr.push(r);
      map.set(r.clientName, arr);
    }
    return [...map.entries()]
      .map(([name, items]) => ({
        name,
        items: [...items].sort((a, b) => b.date.localeCompare(a.date)),
        total: items.reduce((acc, x) => acc + x.totalPrice, 0),
        unstocked: items.filter((x) => x.stockStatus === 'unstocked').length,
        unshipped: items.filter((x) => x.shipStatus === 'unshipped').length,
        unpaidAmount: items.reduce(
          (acc, x) => acc + Math.max(0, Math.round((x.totalPrice - x.paidAmount) * 100) / 100),
          0,
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [filtered]);

  const set = (patch: Partial<RecordFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const hasFilter =
    filter.client !== '' ||
    filter.product !== '' ||
    filter.stock !== '' ||
    filter.from !== '' ||
    filter.to !== '' ||
    shipFilter !== '' ||
    starredOnly;

  const switchView = (v: View) => {
    setView(v);
    setEditMode(false);
    setMultiMode(false);
    setSelected(new Set());
  };

  const toggleStockFor = async (r: Record) => {
    await db.records.update(r.id, toggleStock(r.stockStatus, r.shipStatus));
  };
  const toggleShipFor = async (r: Record) => {
    await db.records.update(r.id, { shipStatus: toggleShip(r.shipStatus) });
  };
  const toggleStarFor = async (r: Record) => {
    await db.records.update(r.id, { starred: !r.starred });
  };
  const batchUpdate = async (name: string, kind: 'stock' | 'ship', applyDone: boolean) => {
    const items = grouped.find((g) => g.name === name)?.items ?? [];
    const patch = statusBatchPatch(kind, applyDone);
    await Promise.all(items.map((r) => db.records.update(r.id, patch)));
  };
  const batchPayAll = async (name: string) => {
    const items = grouped.find((g) => g.name === name)?.items ?? [];
    await Promise.all(items.map((r) => db.records.update(r.id, { paid: true, paidAmount: r.totalPrice })));
  };
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const paidFull = (r: Record) => Math.round((r.totalPrice - r.paidAmount) * 100) / 100 <= 0;
  const selectableFiltered = filtered.filter(paidFull);
  const allSelected = selectableFiltered.length > 0 && selectableFiltered.every((r) => selected.has(r.id));
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectableFiltered.map((r) => r.id)));
  };
  const toggleSelectGroup = (name: string) => {
    const items = grouped.find((g) => g.name === name)?.items ?? [];
    const ids = items.filter(paidFull).map((r) => r.id);
    if (ids.length === 0) return;
    const allSel = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSel) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
    setMultiMode(true);
    setEditMode(false);
  };
  const exitMulti = () => {
    setMultiMode(false);
    setSelected(new Set());
  };
  const handleClearSelected = async () => {
    const now = new Date().toISOString();
    await Promise.all([...selected].map((id) => db.records.update(id, { deletedAt: now })));
    setSelected(new Set());
    setMultiMode(false);
    setClearOpen(false);
  };
  const toggleGroup = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const showQuick = view === 'today' || editMode;

  const rowInner = (r: Record) => (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900">{r.productName}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {formatDateShortCN(r.date)}
            {r.clientLocation && <span className="ml-1">· {r.clientLocation}</span>}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-1.5 py-0.5 text-sm font-bold text-teal-800">
              数量 {r.quantity} {r.unit && <span className="text-teal-700">{r.unit}</span>}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-sm font-bold text-indigo-800">
              单价 {formatMoney(r.unitPrice)}
            </span>
          </p>
          {r.note && <p className="mt-0.5 truncate text-xs text-slate-400">备注：{r.note}</p>}
          {r.hasPrint && (
            <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
              <span className="truncate">🖨 印字：{r.printNote || '（未填）'}</span>
            </p>
          )}
          {(r.noteImages.length > 0 || r.printImages.length > 0) && (
            <div className="mt-2 space-y-1.5">
              {r.noteImages.length > 0 && (
                <div>
                  <p className="mb-0.5 text-[10px] text-slate-400">备注图</p>
                  <ThumbStrip images={r.noteImages} />
                </div>
              )}
              {r.printImages.length > 0 && (
                <div>
                  <p className="mb-0.5 text-[10px] font-bold text-amber-600">印字图</p>
                  <ThumbStrip images={r.printImages} />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {!showQuick && <PaidBadge totalPrice={r.totalPrice} paidAmount={r.paidAmount} size="sm" />}
          <span className="text-sm font-bold text-slate-800">{formatMoney(r.totalPrice)}</span>
        </div>
      </div>
      {showQuick && view === 'today' && (
        <div className="mt-2 flex items-center gap-5 border-t border-slate-100 pt-2">
          <CheckToggle
            checked={r.stockStatus === 'stocked'}
            label={r.stockStatus === 'stocked' ? STOCK_LABELS.stocked : STOCK_LABELS.unstocked}
            tone={r.stockStatus === 'stocked' ? 'green' : 'red'}
            onChange={() => void toggleStockFor(r)}
          />
          {r.stockStatus === 'stocked' && (
            <CheckToggle
              checked={r.shipStatus === 'shipped'}
              label={r.shipStatus === 'shipped' ? SHIP_LABELS.shipped : SHIP_LABELS.unshipped}
              tone={r.shipStatus === 'shipped' ? 'blue' : 'amber'}
              onChange={() => void toggleShipFor(r)}
            />
          )}
        </div>
      )}
      {showQuick && view === 'all' && <PaymentEditor record={r} />}
      <div className="mt-1 flex justify-end">
        <StarButton starred={r.starred} onToggle={() => void toggleStarFor(r)} />
      </div>
    </>
  );

  const clickable = view === 'today' || editMode;

  return (
    <div className="p-4">
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">账目</h1>
          <div className="flex items-center gap-2">
            {view === 'all' && (
              <button
                type="button"
                onClick={() => setStarredOnly((v) => !v)}
                className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm ${
                  starredOnly ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-500'
                }`}
              >
                ★ 只看重点
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMultiMode((v) => !v);
                setEditMode(false);
                setSelected(new Set());
              }}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm ${
                multiMode ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500'
              }`}
            >
              ☑ 多选清空
            </button>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-white p-3 shadow-sm">
          <div>
            <p className="text-xs text-slate-500">
              {view === 'today' ? '今日' : '总账目'}共 {filtered.length} 笔
            </p>
            <p className="text-sm font-bold">总金额</p>
          </div>
          <div className="flex items-center justify-end">
            <p className="text-lg font-bold text-teal-700">{formatMoney(total)}</p>
          </div>
          {view === 'today' ? (
            <div className="col-span-2 flex items-center gap-4 border-t border-slate-100 pt-2">
              <span className="text-xs text-slate-500">
                未备货 <span className="text-sm font-bold text-red-600">{unstocked}</span>
              </span>
              <span className="text-xs text-slate-500">
                未发货 <span className="text-sm font-bold text-amber-600">{unshipped}</span>
              </span>
            </div>
          ) : (
            <div className="col-span-2 flex items-center gap-2 border-t border-slate-100 pt-2">
              <span className="text-xs text-slate-500">
                未收 <span className="text-sm font-bold text-red-600">{formatMoney(unpaidTotal)}</span>
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="mb-3 flex rounded-xl bg-white p-1 shadow-sm">
        {(
          [
            ['today', '今日'],
            ['all', '总账目'],
          ] as [View, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => switchView(k)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${view === k ? 'bg-teal-700 text-white' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="rounded-xl bg-white p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <select
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            value={filter.client}
            onChange={(e) => set({ client: e.target.value })}
          >
            <option value="">全部客户</option>
            {clientNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            value={filter.product}
            onChange={(e) => set({ product: e.target.value })}
          >
            <option value="">全部产品</option>
            {products.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {view === 'today' ? (
            <>
              <select
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={filter.stock}
                onChange={(e) => set({ stock: e.target.value as RecordFilter['stock'] })}
              >
                <option value="">全部备货</option>
                <option value="unstocked">未备货</option>
                <option value="stocked">已备货</option>
              </select>
              <select
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={shipFilter}
                onChange={(e) => setShipFilter(e.target.value as ShipFilter)}
              >
                <option value="">全部发货</option>
                <option value="unshipped">未发货</option>
                <option value="shipped">已发货</option>
              </select>
            </>
          ) : (
            <>
              <input
                type="date"
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={filter.from}
                onChange={(e) => set({ from: e.target.value })}
              />
              <input
                type="date"
                className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                value={filter.to}
                onChange={(e) => set({ to: e.target.value })}
              />
            </>
          )}
        </div>
        {hasFilter && (
          <button
            type="button"
            className="mt-2 text-xs text-teal-700"
            onClick={() => {
              setFilter(EMPTY_FILTER);
              setShipFilter('');
              setStarredOnly(false);
            }}
          >
            清除筛选
          </button>
        )}
      </section>

      <section className="mt-4 space-y-3">
        {filtered.length === 0 && (
          <EmptyState text={view === 'today' ? '今天还没有账目，点右下角「+」记一笔' : '还没有任何账目'} />
        )}
        {grouped.map((g) => {
          const isOpen = !collapsed.has(g.name);
          const allDoneStock = g.unstocked === 0 && g.unshipped === 0;
          const allDonePay = g.unpaidAmount <= 0;
          return (
            <div key={g.name}>
              <div
                onClick={() => toggleGroup(g.name)}
                className="sticky top-0 z-20 flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl bg-teal-700 px-4 py-3 text-left shadow-md active:bg-teal-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-white">👤 {g.name}</p>
                  <p className="mt-0.5 text-xs text-teal-50/90">
                    {g.items.length} 笔 · {formatMoney(g.total)}
                  </p>
                  {view === 'today' ? (
                    allDoneStock ? (
                      <p className="mt-1 text-xs font-bold text-emerald-200">✅ 均完成</p>
                    ) : (
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-bold">
                        <span className="text-red-200">未备货 {g.unstocked}</span>
                        <span className="text-amber-200">未发货 {g.unshipped}</span>
                      </p>
                    )
                  ) : allDonePay ? (
                    <p className="mt-1 text-xs font-bold text-emerald-200">✅ 均完成</p>
                  ) : (
                    <p className="mt-1 text-xs font-bold text-rose-200">未收 {formatMoney(g.unpaidAmount)}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {multiMode && (() => {
                    const groupSelectable = g.items.filter(paidFull);
                    const groupAllSel =
                      groupSelectable.length > 0 && groupSelectable.every((x) => selected.has(x.id));
                    return (
                      <button
                        type="button"
                        disabled={groupSelectable.length === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleSelectGroup(g.name);
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          groupSelectable.length === 0
                            ? 'cursor-not-allowed bg-white/10 text-white/40'
                            : groupAllSel
                              ? 'bg-white text-teal-700'
                              : 'bg-white/20 text-white'
                        }`}
                      >
                        {groupSelectable.length === 0 ? '无可选' : groupAllSel ? '✓ 已选' : '☑ 选择'}
                      </button>
                    );
                  })()}
                  <span className="text-lg font-bold text-white">{isOpen ? '▾' : '▸'}</span>
                </div>
              </div>
              {isOpen && (
                <div className="mt-1.5">
                  {showQuick && (
                    <div className={`mb-1.5 grid gap-1.5 ${view === 'all' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {view === 'today' ? (
                        <>
                          <BatchBtn
                            label="备货"
                            done={g.unstocked === 0}
                            onClick={() => void batchUpdate(g.name, 'stock', g.unstocked > 0)}
                          />
                          <BatchBtn
                            label="发货"
                            done={g.unshipped === 0}
                            onClick={() => void batchUpdate(g.name, 'ship', g.unshipped > 0)}
                          />
                        </>
                      ) : (
                        <BatchBtn label="付款" done={allDonePay} onClick={() => void batchPayAll(g.name)} />
                      )}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {g.items.map((r) => {
                      if (multiMode) {
                        const isSel = selected.has(r.id);
                        const canSel = paidFull(r);
                        return (
                          <div
                            key={r.id}
                            onClick={canSel ? () => toggleSelect(r.id) : undefined}
                            className={`rounded-xl bg-white p-3 shadow-sm ${
                              isSel ? 'ring-2 ring-indigo-500' : ''
                            }`}
                          >
                            <div className="mb-2 flex items-center gap-2">
                              {canSel ? (
                                <>
                                  <span
                                    className={`flex h-5 w-5 items-center justify-center rounded border-2 text-xs font-bold ${
                                      isSel
                                        ? 'border-indigo-500 bg-indigo-500 text-white'
                                        : 'border-slate-300 text-transparent'
                                    }`}
                                  >
                                    ✓
                                  </span>
                                  <span className={`text-xs font-semibold ${isSel ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    {isSel ? '已选择' : '点击选择'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="flex h-5 w-5 items-center justify-center rounded border-2 border-slate-200 bg-slate-100 text-[10px] text-slate-400">
                                    🔒
                                  </span>
                                  <span className="text-xs font-semibold text-slate-400">未付清·不可选</span>
                                </>
                              )}
                            </div>
                            {rowInner(r)}
                          </div>
                        );
                      }
                      return clickable ? (
                        <Link
                          key={r.id}
                          to={`/records/${r.id}`}
                          className="block rounded-xl bg-white p-3 shadow-sm active:bg-slate-50"
                        >
                          {rowInner(r)}
                        </Link>
                      ) : (
                        <div key={r.id} className="rounded-xl bg-white p-3 shadow-sm">
                          {rowInner(r)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {multiMode && (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-full max-w-md px-4">
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl">
            <span className="text-sm font-bold">已选 {selected.size} 条</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold"
              >
                {allSelected ? '取消全选' : '全选'}
              </button>
              <button
                type="button"
                onClick={() => setClearOpen(true)}
                disabled={selected.size === 0}
                className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
              >
                清空
              </button>
              <button
                type="button"
                onClick={exitMulti}
                className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {!multiMode && view === 'today' ? (
        <Link
          to="/records/new"
          className="fixed bottom-20 right-[max(1rem,calc(50%-13rem))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-3xl text-white shadow-lg active:bg-teal-800"
          aria-label="新建账目"
        >
          +
        </Link>
      ) : !multiMode ? (
        <button
          type="button"
          onClick={() => {
            setEditMode((v) => !v);
            setMultiMode(false);
            setSelected(new Set());
          }}
          className="fixed bottom-20 right-[max(1rem,calc(50%-13rem))] z-30 rounded-full bg-slate-800 px-4 py-3 text-sm font-bold text-white shadow-lg active:bg-slate-700"
        >
          {editMode ? '✓ 完成' : '✎ 修改'}
        </button>
      ) : null}

      <ConfirmDialog
        open={clearOpen}
        title="清空所选账目"
        message={`将把选中的 ${selected.size} 条账目移入回收站，可在 设置 → 回收站 恢复。确定吗？`}
        confirmText="清空"
        onConfirm={() => void handleClearSelected()}
        onCancel={() => setClearOpen(false)}
      />
    </div>
  );
}
