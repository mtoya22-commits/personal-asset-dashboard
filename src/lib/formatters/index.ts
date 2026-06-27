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

export function formatDate(dateStr: string): string {
  // YYYY-MM-DD: parse directly to avoid UTC midnight offset
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (ymd) return `${ymd[1]}/${ymd[2]}/${ymd[3]}`;
  // ISO datetime: convert to JST before formatting
  const utcDate = new Date(dateStr);
  const jstStr = utcDate.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
  const jstDate = new Date(jstStr);
  const y = jstDate.getFullYear();
  const m = String(jstDate.getMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

export function getJstMonthFromIso(isoString: string): string {
  const utcDate = new Date(isoString);
  const jstStr = utcDate.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' });
  const jstDate = new Date(jstStr);
  const y = jstDate.getFullYear();
  const m = String(jstDate.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
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
