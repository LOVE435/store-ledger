import { SHIP_LABELS, type ShipStatus } from '../types';

export default function ShipBadge({ status, size = 'sm' }: { status: ShipStatus; size?: 'sm' | 'md' }) {
  const color =
    status === 'shipped' ? 'border-blue-300 bg-blue-100 text-blue-700' : 'border-amber-300 bg-amber-100 text-amber-700';
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border font-semibold ${color} ${pad}`}>
      {SHIP_LABELS[status]}
    </span>
  );
}
