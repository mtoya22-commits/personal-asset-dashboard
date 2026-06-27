const JPY_FORMATTER = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('ja-JP');

export function formatCurrency(value: number, masked = false): string {
  if (masked) return '¥•••,•••,•••';
  return JPY_FORMATTER.format(Math.round(value));
}

export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

export function formatPercent(value: number, digits = 1): string {
  if (!isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

export function formatDateFromMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return `${y}/${m}`;
}

export function formatDiff(diff: number, masked = false): string {
  if (masked) return '±•••,•••,•••';
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${JPY_FORMATTER.format(Math.round(diff))}`;
}

export function formatDiffPercent(pct: number): string {
  if (!isFinite(pct)) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export function formatQuantity(value: number): string {
  if (value === Math.floor(value)) {
    return NUMBER_FORMATTER.format(value);
  }
  return value.toLocaleString('ja-JP', { maximumFractionDigits: 6 });
}

export function getTodayJST(): Date {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return jst;
}

export function getMonthKeyJST(): string {
  const jst = getTodayJST();
  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getSnapshotDateJST(): string {
  const jst = getTodayJST();
  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, '0');
  const d = String(jst.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getISONow(): string {
  return new Date().toISOString();
}

export function getFileDateSuffix(): string {
  return getSnapshotDateJST();
}
