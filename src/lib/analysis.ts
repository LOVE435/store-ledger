import type { Client, Record, ShipStatus, StockStatus } from '../types';

export interface TopProduct {
  name: string;
  amount: number;
}

export interface ClientStat {
  name: string;
  location: string;
  orders: number;
  totalAmount: number;
  lastDate: string | null;
  firstDate: string | null;
  avgGapDays: number | null;
  topProducts: TopProduct[];
}

export interface RecordFilter {
  client: string;
  product: string;
  stock: '' | 'unstocked' | 'stocked';
  from: string;
  to: string;
}

export const EMPTY_FILTER: RecordFilter = {
  client: '',
  product: '',
  stock: '',
  from: '',
  to: '',
};

export function computeTotal(qty: number, unitPrice: number): number {
  return Math.round(qty * unitPrice * 100) / 100;
}

export function toggleStock(
  stock: StockStatus,
  ship: ShipStatus,
): { stockStatus: StockStatus; shipStatus: ShipStatus } {
  if (stock === 'unstocked') return { stockStatus: 'stocked', shipStatus: ship };
  return { stockStatus: 'unstocked', shipStatus: 'unshipped' };
}

export function toggleShip(ship: ShipStatus): ShipStatus {
  return ship === 'shipped' ? 'unshipped' : 'shipped';
}

export function statusBatchPatch(
  kind: 'stock' | 'ship' | 'paid',
  applyDone: boolean,
): Partial<Record> {
  if (kind === 'stock') {
    return applyDone ? { stockStatus: 'stocked' } : { stockStatus: 'unstocked', shipStatus: 'unshipped' };
  }
  if (kind === 'ship') {
    return applyDone ? { stockStatus: 'stocked', shipStatus: 'shipped' } : { shipStatus: 'unshipped' };
  }
  return { paid: applyDone };
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function dayDiff(a: string, b: string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  return Math.round(
    (Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) -
      Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) /
      86400000,
  );
}

export function daysSince(dateStr: string): number {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
  return dayDiff(dateStr, todayStr);
}

export function formatDateCN(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

export function formatDateShortCN(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}月${d}日`;
}

function pushMap(map: Map<string, string[]>, key: string, value: string): void {
  const arr = map.get(key) ?? [];
  arr.push(value);
  map.set(key, arr);
}

export function buildClientStats(records: Record[], clients: Client[]): ClientStat[] {
  const map = new Map<string, ClientStat>();
  for (const c of clients) {
    map.set(c.name, {
      name: c.name,
      location: c.location,
      orders: 0,
      totalAmount: 0,
      lastDate: null,
      firstDate: null,
      avgGapDays: null,
      topProducts: [],
    });
  }

  const dates = new Map<string, string[]>();
  const products = new Map<string, Map<string, number>>();

  for (const r of records) {
    const stat = map.get(r.clientName);
    if (!stat) continue;
    stat.orders += 1;
    stat.totalAmount += r.totalPrice;
    if (stat.lastDate === null || r.date > stat.lastDate) stat.lastDate = r.date;
    if (stat.firstDate === null || r.date < stat.firstDate) stat.firstDate = r.date;
    pushMap(dates, r.clientName, r.date);
    const pm = products.get(r.clientName) ?? new Map<string, number>();
    pm.set(r.productName, (pm.get(r.productName) ?? 0) + r.totalPrice);
    products.set(r.clientName, pm);
  }

  for (const stat of map.values()) {
    const ds = (dates.get(stat.name) ?? []).sort();
    if (ds.length >= 2) {
      let gap = 0;
      for (let i = 1; i < ds.length; i += 1) gap += dayDiff(ds[i - 1], ds[i]);
      stat.avgGapDays = Math.round(gap / (ds.length - 1));
    }
    stat.topProducts = [...(products.get(stat.name) ?? new Map()).entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }

  return [...map.values()];
}

export function rankByOrders(stats: ClientStat[]): ClientStat[] {
  return stats
    .filter((s) => s.orders > 0)
    .sort(
      (a, b) => b.orders - a.orders || b.totalAmount - a.totalAmount || a.name.localeCompare(b.name, 'zh-CN'),
    );
}

export function rankByAmount(stats: ClientStat[]): ClientStat[] {
  return stats
    .filter((s) => s.totalAmount > 0)
    .sort(
      (a, b) => b.totalAmount - a.totalAmount || b.orders - a.orders || a.name.localeCompare(b.name, 'zh-CN'),
    );
}

export function rankByRecent(stats: ClientStat[]): ClientStat[] {
  return stats
    .filter((s) => s.lastDate !== null)
    .sort((a, b) => {
      if (a.lastDate === null || b.lastDate === null) return 0;
      return b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name, 'zh-CN');
    });
}

export function groupByLocation(stats: ClientStat[]): { location: string; items: ClientStat[] }[] {
  const map = new Map<string, ClientStat[]>();
  for (const stat of stats) {
    const key = stat.location.trim() === '' ? '未填写' : stat.location;
    const arr = map.get(key) ?? [];
    arr.push(stat);
    map.set(key, arr);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))
    .map(([location, items]) => ({
      location,
      items: [...items].sort((a, b) => b.totalAmount - a.totalAmount),
    }));
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function monthlySeries(records: Record[], clientName: string, months = 12): { month: string; amount: number }[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const sums = new Map(keys.map((k) => [k, 0]));
  for (const r of records) {
    if (r.clientName !== clientName) continue;
    const k = monthKey(r.date);
    if (sums.has(k)) sums.set(k, (sums.get(k) ?? 0) + r.totalPrice);
  }
  return keys.map((month) => ({ month, amount: Math.round((sums.get(month) ?? 0) * 100) / 100 }));
}

export function productBreakdown(records: Record[], clientName: string, topN = 8): TopProduct[] {
  const sums = new Map<string, number>();
  for (const r of records) {
    if (r.clientName !== clientName) continue;
    sums.set(r.productName, (sums.get(r.productName) ?? 0) + r.totalPrice);
  }
  const items = [...sums.entries()]
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
  if (items.length <= topN) return items;
  const top = items.slice(0, topN);
  const rest = items.slice(topN).reduce((acc, x) => acc + x.amount, 0);
  return [...top, { name: '其他', amount: Math.round(rest * 100) / 100 }];
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter((s) => s.trim() !== ''))];
}

export function suggest(items: string[], query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  const matches = items.filter((s) => s.toLowerCase().includes(q));
  return matches.slice(0, limit);
}

export function filterRecords(records: Record[], filter: RecordFilter): Record[] {
  return records.filter((r) => {
    if (filter.client !== '' && r.clientName !== filter.client) return false;
    if (filter.product !== '' && r.productName !== filter.product) return false;
    if (filter.stock !== '' && r.stockStatus !== filter.stock) return false;
    if (filter.from !== '' && r.date < filter.from) return false;
    if (filter.to !== '' && r.date > filter.to) return false;
    return true;
  });
}
