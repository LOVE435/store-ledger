import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { activeRecordsQuery, db } from '../db';
import { buildClientStats, formatDateShortCN, groupByLocation } from '../lib/analysis';
import { formatMoney } from '../lib/money';
import WechatButton from '../components/WechatButton';
import EmptyState from '../components/EmptyState';

export default function ClientsPage() {
  const clients = useLiveQuery(() => db.clients.orderBy('createdAt').toArray(), []) ?? [];
  const records = useLiveQuery(() => activeRecordsQuery(), []) ?? [];
  const stats = useMemo(() => buildClientStats(records, clients), [records, clients]);
  const groups = useMemo(() => groupByLocation(stats), [stats]);
  const totalAmount = useMemo(() => stats.reduce((acc, s) => acc + s.totalAmount, 0), [stats]);

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">客户</h1>
          <p className="text-xs text-slate-500">
            共 {clients.length} 位客户 · 累计 {formatMoney(totalAmount)}
          </p>
        </div>
        <Link
          to="/clients/new"
          className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white active:bg-teal-800"
        >
          + 新增客户
        </Link>
      </header>

      {clients.length === 0 && <EmptyState text="还没有客户，先新增一位，或记账时自动创建" />}

      {groups.map((g) => (
        <section key={g.location} className="mb-4">
          <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-slate-500">
            <span>📍 {g.location}</span>
            <span className="text-xs font-normal">{g.items.length} 位</span>
          </h2>
          <div className="space-y-2">
            {g.items.map((s) => {
              const client = clients.find((c) => c.name === s.name);
              return (
                <div key={s.name} className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm">
                  <Link to={client ? `/clients/${client.id}` : '/clients'} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {s.orders} 笔 · {formatMoney(s.totalAmount)}
                      {s.lastDate ? ` · 最近 ${formatDateShortCN(s.lastDate)}` : ' · 暂无订单'}
                    </p>
                  </Link>
                  {client && <WechatButton client={client} />}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
