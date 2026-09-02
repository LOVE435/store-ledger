import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { activeRecordsQuery, db } from '../db';
import {
  buildClientStats,
  daysSince,
  formatDateShortCN,
  rankByAmount,
  rankByOrders,
  rankByRecent,
} from '../lib/analysis';
import { formatMoney } from '../lib/money';

type Tab = 'orders' | 'recent';

export default function RankingsPage() {
  const [tab, setTab] = useState<Tab>('orders');
  const [metric, setMetric] = useState<'orders' | 'amount'>('orders');
  const navigate = useNavigate();
  const records = useLiveQuery(() => activeRecordsQuery(), []) ?? [];
  const clients = useLiveQuery(() => db.clients.toArray(), []) ?? [];
  const stats = useMemo(() => buildClientStats(records, clients), [records, clients]);

  const orderList = useMemo(
    () => (metric === 'orders' ? rankByOrders(stats) : rankByAmount(stats)),
    [stats, metric],
  );
  const recentList = useMemo(() => rankByRecent(stats), [stats]);

  const goClient = (name: string) => {
    const c = clients.find((x) => x.name === name);
    if (c) navigate(`/clients/${c.id}`);
  };

  const rankStyle = (i: number) =>
    i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-500';

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold">排行</h1>
      <div className="mb-3 flex rounded-xl bg-white p-1 shadow-sm">
        {(
          [
            ['orders', '订单排行'],
            ['recent', '近期采购'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${tab === k ? 'bg-teal-700 text-white' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <>
          <div className="mb-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMetric('orders')}
              className={`rounded-full px-3 py-1 text-xs font-medium ${metric === 'orders' ? 'bg-teal-700 text-white' : 'bg-white text-slate-500'}`}
            >
              按订单数
            </button>
            <button
              type="button"
              onClick={() => setMetric('amount')}
              className={`rounded-full px-3 py-1 text-xs font-medium ${metric === 'amount' ? 'bg-teal-700 text-white' : 'bg-white text-slate-500'}`}
            >
              按总金额
            </button>
          </div>
          <div className="space-y-2">
            {orderList.length === 0 && <p className="py-10 text-center text-sm text-slate-400">还没有订单数据</p>}
            {orderList.map((s, i) => (
              <button
                key={s.name}
                type="button"
                onClick={() => goClient(s.name)}
                className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm active:bg-slate-50"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankStyle(i)}`}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.name}</span>
                  <span className="block text-xs text-slate-400">
                    {metric === 'orders' ? `${s.orders} 笔` : formatMoney(s.totalAmount)}
                    {s.lastDate ? ` · 最近 ${formatDateShortCN(s.lastDate)}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold text-slate-800">
                  {metric === 'orders' ? formatMoney(s.totalAmount) : `${s.orders} 笔`}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'recent' && (
        <div className="space-y-2">
          {recentList.length === 0 && <p className="py-10 text-center text-sm text-slate-400">还没有订单数据</p>}
          {recentList.map((s, i) => {
            const gap = s.lastDate ? daysSince(s.lastDate) : null;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => goClient(s.name)}
                className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm active:bg-slate-50"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankStyle(i)}`}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.name}</span>
                  <span className="block text-xs text-slate-400">
                    {s.lastDate ? `最近采购 ${formatDateShortCN(s.lastDate)}` : ''}
                  </span>
                </span>
                <span className={`shrink-0 text-xs font-bold ${gap !== null && gap >= 30 ? 'text-red-600' : 'text-slate-500'}`}>
                  {gap === 0 ? '今天' : gap === 1 ? '昨天' : gap !== null ? `${gap} 天前` : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
