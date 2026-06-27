import type { MonthlySnapshot } from '../../types/index.js';

const BOM = '﻿';

function escapeCsvCell(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  let str = String(value);
  // Formula injection prevention: prefix with tab if starts with =, +, -, @
  const needsInjectionPrefix = /^[=+\-@]/.test(str);
  if (needsInjectionPrefix) {
    str = '\t' + str;
  }
  // Wrap in quotes if contains special characters or has a tab prefix
  if (needsInjectionPrefix || str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCsvRow(cells: (string | number | undefined | null)[]): string {
  return cells.map(escapeCsvCell).join(',');
}

export function buildMonthlySummaryCsv(snapshots: MonthlySnapshot[]): string {
  const header = buildCsvRow([
    'snapshotDate',
    'monthKey',
    'totalAssets',
    'cash',
    'investment',
    'crypto',
    'memo',
  ]);
  const rows = [...snapshots]
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((s) =>
      buildCsvRow([
        s.snapshotDate,
        s.monthKey,
        s.totalAssets,
        s.assetClassBreakdown.cash,
        s.assetClassBreakdown.investment,
        s.assetClassBreakdown.crypto,
        s.memo ?? '',
      ]),
    );
  return BOM + [header, ...rows].join('\r\n');
}

export function buildCategoryHistoryCsv(snapshots: MonthlySnapshot[]): string {
  const header = buildCsvRow([
    'snapshotDate',
    'monthKey',
    'categoryName',
    'assetClass',
    'marketValue',
    'percentage',
  ]);
  const rows: string[] = [];
  for (const s of [...snapshots].sort((a, b) => a.monthKey.localeCompare(b.monthKey))) {
    const total = s.totalAssets;
    for (const cat of s.categoryBreakdown) {
      const pct = total > 0 ? Math.round((cat.value / total) * 1000) / 10 : 0;
      rows.push(
        buildCsvRow([s.snapshotDate, s.monthKey, cat.categoryName, cat.assetClass, cat.value, pct]),
      );
    }
  }
  return BOM + [header, ...rows].join('\r\n');
}

export function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
