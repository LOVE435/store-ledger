import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { activeRecordsQuery, db } from '../db';
import {
  buildClientStats,
  daysSince,
  filterRecords,
  formatDateCN,
  formatDateShortCN,
  monthlySeries,
  productBreakdown,
  today,
} from '../lib/analysis';
import { formatMoney } from '../lib/money';
import type { EChartsCoreOption } from 'echarts/core';
import ChartCard from '../components/ChartCard';
import StockBadge from '../components/StockBadge';
import ShipBadge from '../components/ShipBadge';
import PaidBadge from '../components/PaidBadge';
import WechatButton from '../components/WechatButton';
import EmptyState from '../components/EmptyState';
import ThumbStrip from '../components/ThumbStrip';

export default function ClientDetailPage() {
  const { id } = useParams();
  const client = useLiveQuery(() => (id ? db.clients.get(id) : undefined), [id]);
  const records = useLiveQuery(() => activeRecordsQuery(), []) ?? [];
  const allClients = useLiveQuery(() => db.clients.toArray(), []) ?? [];
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const clientRecords = useMemo(
    () => records.filter((r) => r.clientName === client?.name),
    [records, client],
  );
  const stats = useMemo(() => buildClientStats(records, allClients), [records, allClients]);
  const stat = useMemo(() => stats.find((s) => s.name === client?.name), [stats, client]);
  const filtered = useMemo(
    () => filterRecords(clientRecords, { client: '', product: '', stock: '', from, to }),
    [clientRecords, from, to],
  );

  const barOption = useMemo<EChartsCoreOption>(() => {
    const series = monthlySeries(clientRecords, client?.name ?? '');
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => formatMoney(Number(v)) },
      grid: { left: 56, right: 12, top: 24, bottom: 28 },
      xAxis: { type: 'category', data: series.map((s) => `${Number(s.month.slice(5))}月`), axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } }, axisLabel: { fontSize: 11 } },
      series: [
        {
          type: 'bar',
          data: series.map((s) => s.amount),
          itemStyle: { color: '#0d9488', borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 22,
        },
      ],
    };
  }, [clientRecords, client]);

  const pieOption = useMemo<EChartsCoreOption>(() => {
    const breakdown = productBreakdown(clientRecords, client?.name ?? '');
    return {
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c}' },
      legend: { bottom: 0, type: 'scroll', fontSize: 11 },
      series: [
        {
          type: 'pie',
          radius: ['38%', '62%'],
          center: ['50%', '44%'],
          data: breakdown.map((b) => ({ name: b.name, value: b.amount })),
          label: { fontSize: 11, formatter: '{b}: {d}%' },
        },
      ],
    };
  }, [clientRecords, client]);

  if (!client) return <div className="p-4 text-sm text-slate-500">客户不存在</div>;

  const gap = stat?.lastDate ? daysSince(stat.lastDate) : null;

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <Link to="/clients" className="text-sm text-teal-700">
          ← 返回
        </Link>
        <h1 className="text-lg font-bold">客户分析</h1>
        <Link to={`/clients/${client.id}/edit`} className="text-sm text-teal-700">
          编辑
        </Link>
      </header>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{client.name}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {client.location || '未填写所在地'}
              {client.phone && <span className="ml-2">☎ {client.phone}</span>}
            </p>
            {client.wechatId && <p className="mt-0.5 text-xs text-slate-400">微信号：{client.wechatId}</p>}
          </div>
          <WechatButton client={client} onEdit={() => undefined} />
        </div>

        <div className="mt-4 space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm">
          <p>
            累计订单 <b className="text-slate-900">{stat?.orders ?? 0}</b> 笔 · 累计金额{' '}
            <b className="text-slate-900">{formatMoney(stat?.totalAmount ?? 0)}</b>
          </p>
          <p>
            最近采购：
            {stat?.lastDate ? (
              <>
                <b className="text-teal-700">{formatDateShortCN(stat.lastDate)}</b>
                <span className="text-slate-500">
                  {gap === 0 ? '（今天）' : gap === 1 ? '（昨天）' : gap !== null ? `（${gap} 天前）` : ''}
                </span>
              </>
            ) : (
              '暂无'
            )}
          </p>
          <p>
            常购产品：
            {stat && stat.topProducts.length > 0 ? (
              stat.topProducts.map((p) => p.name).join('、')
            ) : (
              <span className="text-slate-400">暂无</span>
            )}
          </p>
          <p>
            采购频率：
            {stat && stat.orders >= 2 && stat.avgGapDays !== null
              ? `平均每 ${stat.avgGapDays} 天采购一次`
              : stat && stat.orders === 1
                ? '只记了 1 笔，多记几笔后自动分析'
                : '暂无'}
          </p>
        </div>
      </section>

      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-bold text-slate-700">近 12 个月采购金额趋势</h3>
        <ChartCard option={barOption} height={220} />
      </section>

      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-bold text-slate-700">产品金额占比</h3>
        <ChartCard option={pieOption} height={240} />
      </section>

      <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-700">采购记录（按时间查看）</h3>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <input
            type="date"
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
            value={to}
            min={from || undefined}
            max={today()}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {(from || to) && (
          <button
            type="button"
            className="mb-3 text-xs text-teal-700"
            onClick={() => {
              setFrom('');
              setTo('');
            }}
          >
            清除时间筛选
          </button>
        )}
        <div className="space-y-2">
          {filtered.length === 0 && <EmptyState text="该时间段没有采购记录" />}
          {filtered.map((r) => (
            <Link
              key={r.id}
              to={`/records/${r.id}`}
              className="block rounded-lg border border-slate-100 p-2.5 active:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.productName}</p>
                <p className="text-xs text-slate-400">{formatDateCN(r.date)}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-1.5 py-0.5 text-sm font-bold text-teal-800">
                    数量 {r.quantity}{' '}
                    {r.unit && <span className="text-teal-700">{r.unit}</span>}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-sm font-bold text-indigo-800">
                    单价 {formatMoney(r.unitPrice)}
                  </span>
                </p>
                {r.note && <p className="mt-0.5 truncate text-xs text-slate-400">{r.note}</p>}
                {r.hasPrint && (
                  <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                    <span className="truncate">🖨 印字：{r.printNote || '（未填）'}</span>
                  </p>
                )}
                {(r.noteImages.length > 0 || r.printImages.length > 0) && (
                  <div className="mt-1.5 space-y-1.5">
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
                  <div className="flex gap-1">
                    <StockBadge status={r.stockStatus} size="sm" />
                    {r.stockStatus === 'stocked' && <ShipBadge status={r.shipStatus} size="sm" />}
                    <PaidBadge totalPrice={r.totalPrice} paidAmount={r.paidAmount} size="sm" />
                  </div>
                  <span className="text-sm font-bold">{formatMoney(r.totalPrice)}</span>
                </div>
              </div>
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    await db.records.update(r.id, { starred: !r.starred });
                  }}
                  className="text-lg leading-none"
                  aria-label="重点标注"
                >
                  <span className={r.starred ? 'text-amber-400' : 'text-slate-300'}>{r.starred ? '★' : '☆'}</span>
                </button>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
