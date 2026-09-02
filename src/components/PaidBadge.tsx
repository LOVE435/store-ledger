import { formatMoney } from '../lib/money';

export default function PaidBadge({
  totalPrice,
  paidAmount,
  size = 'sm',
}: {
  totalPrice: number;
  paidAmount: number;
  size?: 'sm' | 'md';
}) {
  const remaining = Math.max(0, Math.round((totalPrice - paidAmount) * 100) / 100);
  const paid = remaining <= 0;
  const color = paid
    ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
    : 'border-rose-300 bg-rose-100 text-rose-600';
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border font-semibold ${color} ${pad}`}>
      {paid ? '已付清' : `剩余 ${formatMoney(remaining)}`}
    </span>
  );
}
