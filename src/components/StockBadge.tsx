import { STOCK_LABELS, type StockStatus } from '../types';

export default function StockBadge({ status, size = 'md' }: { status: StockStatus; size?: 'sm' | 'md' }) {
  const color =
    status === 'stocked'
      ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
      : 'border-red-300 bg-red-100 text-red-700';
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border font-semibold ${color} ${pad}`}>
      {STOCK_LABELS[status]}
    </span>
  );
}
