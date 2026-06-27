import { describe, it, expect } from 'vitest';
import type { MonthlySnapshot } from '../../types/index.js';
import { buildMonthlySummaryCsv, buildCategoryHistoryCsv } from './index.js';

function makeSnap(monthKey: string, total: number, memo?: string): MonthlySnapshot {
  return {
    id: monthKey,
    monthKey,
    snapshotDate: `${monthKey}-28`,
    totalAssets: total,
    categoryBreakdown: [
      { categoryId: 'cat-mainstream', categoryName: '王道', assetClass: 'investment', value: total * 0.7 },
      { categoryId: 'cat-cash', categoryName: '現金', assetClass: 'cash', value: total * 0.3 },
    ],
    assetClassBreakdown: { cash: total * 0.3, investment: total * 0.7, crypto: 0 },
    holdingsSnapshot: [],
    memo,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('buildMonthlySummaryCsv', () => {
  it('starts with BOM', () => {
    const csv = buildMonthlySummaryCsv([makeSnap('2026-01', 10000000)]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('has header row', () => {
    const csv = buildMonthlySummaryCsv([makeSnap('2026-01', 10000000)]);
    expect(csv).toContain('snapshotDate');
    expect(csv).toContain('monthKey');
    expect(csv).toContain('totalAssets');
  });

  it('includes data rows', () => {
    const csv = buildMonthlySummaryCsv([makeSnap('2026-01', 10000000)]);
    expect(csv).toContain('2026-01');
    expect(csv).toContain('10000000');
  });

  it('escapes memo with commas', () => {
    const csv = buildMonthlySummaryCsv([makeSnap('2026-01', 10000000, 'memo, with, commas')]);
    expect(csv).toContain('"memo, with, commas"');
  });

  it('escapes memo with quotes', () => {
    const csv = buildMonthlySummaryCsv([makeSnap('2026-01', 10000000, 'say "hello"')]);
    expect(csv).toContain('"say ""hello"""');
  });

  it('prevents formula injection with = prefix (wraps in quotes with tab prefix)', () => {
    const snap = makeSnap('2026-01', 10000000, '=DANGEROUS()');
    const csv = buildMonthlySummaryCsv([snap]);
    // Cell must be quoted and tab-prefixed so Excel does not execute it
    expect(csv).toContain('"\t=DANGEROUS()"');
  });

  it('prevents formula injection with @ prefix', () => {
    const snap = makeSnap('2026-01', 10000000, '@DANGEROUS()');
    const csv = buildMonthlySummaryCsv([snap]);
    // Cell must be quoted and tab-prefixed
    expect(csv).toContain('"\t@DANGEROUS()"');
  });

  it('sorts by monthKey ascending', () => {
    const snaps = [makeSnap('2026-03', 11000000), makeSnap('2026-01', 10000000), makeSnap('2026-02', 10500000)];
    const csv = buildMonthlySummaryCsv(snaps);
    const lines = csv.split('\r\n');
    const months = lines.slice(1).filter((l) => l.trim()).map((l) => l.split(',')[1]);
    expect(months).toEqual(['2026-01', '2026-02', '2026-03']);
  });
});

describe('buildCategoryHistoryCsv', () => {
  it('starts with BOM', () => {
    const csv = buildCategoryHistoryCsv([makeSnap('2026-01', 10000000)]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('has header row', () => {
    const csv = buildCategoryHistoryCsv([makeSnap('2026-01', 10000000)]);
    expect(csv).toContain('categoryName');
    expect(csv).toContain('assetClass');
    expect(csv).toContain('percentage');
  });

  it('expands each category per snapshot', () => {
    const csv = buildCategoryHistoryCsv([makeSnap('2026-01', 10000000)]);
    // Each snapshot has 2 categories
    const dataLines = csv.split('\r\n').slice(1).filter((l) => l.trim());
    expect(dataLines).toHaveLength(2);
  });

  it('prevents formula injection in category names', () => {
    const snap = makeSnap('2026-01', 10000000);
    snap.categoryBreakdown[0].categoryName = '+INJECT()';
    const csv = buildCategoryHistoryCsv([snap]);
    expect(csv).not.toMatch(/^\+INJECT/m);
  });
});
