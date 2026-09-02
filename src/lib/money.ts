export function formatMoney(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return `¥${safe.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function parseNum(s: string): number {
  const v = parseFloat(s.replace(/,/g, ''));
  return Number.isFinite(v) ? v : 0;
}
