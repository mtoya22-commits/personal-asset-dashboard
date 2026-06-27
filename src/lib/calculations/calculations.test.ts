import { describe, it, expect } from 'vitest';
import type { Holding, AssetCategory, MonthlySnapshot, AppSettings } from '../../types/index.js';
import {
  calcTotalAssets,
  calcCategoryBreakdown,
  calcAssetClassBreakdown,
  calcCategoryRatios,
  calcAccountTypeBreakdown,
  calcPrevSnapshotComparison,
  calcYearComparison,
  calcFireProgress,
  calcUnrealizedGains,
  buildSnapshot,
  hasHoldingsChangedSinceSnapshot,
} from './index.js';

const makeCategory = (id: string, assetClass: 'cash' | 'investment' | 'crypto' = 'investment'): AssetCategory => ({
  id,
  name: id,
  color: '#000',
  assetClass,
  sortOrder: 0,
  isDefault: true,
});

const makeHolding = (id: string, categoryId: string, value: number, costBasis?: number): Holding => ({
  id,
  categoryId,
  name: `Holding ${id}`,
  accountType: 'その他',
  marketValue: value,
  ...(costBasis !== undefined ? { costBasis } : {}),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const makeSnapshot = (monthKey: string, total: number, overrides?: Partial<MonthlySnapshot>): MonthlySnapshot => ({
  id: monthKey,
  monthKey,
  snapshotDate: `${monthKey}-15`,
  totalAssets: total,
  categoryBreakdown: [],
  assetClassBreakdown: { cash: 0, investment: total, crypto: 0 },
  holdingsSnapshot: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

// ──────────────────────── Total assets ────────────────────────
describe('calcTotalAssets', () => {
  it('returns 0 for empty holdings', () => {
    expect(calcTotalAssets([])).toBe(0);
  });

  it('sums all market values', () => {
    const holdings = [makeHolding('1', 'cat-mainstream', 1000000), makeHolding('2', 'cat-cash', 500000)];
    expect(calcTotalAssets(holdings)).toBe(1500000);
  });
});

// ──────────────────────── Category breakdown ────────────────────────
describe('calcCategoryBreakdown', () => {
  it('returns empty for no holdings', () => {
    const cats = [makeCategory('cat-mainstream')];
    expect(calcCategoryBreakdown([], cats)).toHaveLength(0);
  });

  it('groups by category', () => {
    const cats = [makeCategory('cat-mainstream'), makeCategory('cat-cash', 'cash')];
    const holdings = [
      makeHolding('1', 'cat-mainstream', 1000000),
      makeHolding('2', 'cat-mainstream', 500000),
      makeHolding('3', 'cat-cash', 200000),
    ];
    const result = calcCategoryBreakdown(holdings, cats);
    const mainstream = result.find((r) => r.categoryId === 'cat-mainstream');
    const cash = result.find((r) => r.categoryId === 'cat-cash');
    expect(mainstream?.value).toBe(1500000);
    expect(cash?.value).toBe(200000);
  });
});

// ──────────────────────── Asset class breakdown ────────────────────────
describe('calcAssetClassBreakdown', () => {
  it('separates cash, investment, crypto', () => {
    const cats = [
      makeCategory('cat-mainstream', 'investment'),
      makeCategory('cat-crypto', 'crypto'),
      makeCategory('cat-cash', 'cash'),
    ];
    const holdings = [
      makeHolding('1', 'cat-mainstream', 1000000),
      makeHolding('2', 'cat-crypto', 300000),
      makeHolding('3', 'cat-cash', 500000),
    ];
    const result = calcAssetClassBreakdown(holdings, cats);
    expect(result.investment).toBe(1000000);
    expect(result.crypto).toBe(300000);
    expect(result.cash).toBe(500000);
  });

  it('returns 0 for all classes when empty', () => {
    expect(calcAssetClassBreakdown([], [])).toEqual({ cash: 0, investment: 0, crypto: 0 });
  });
});

// ──────────────────────── Ratios ────────────────────────
describe('calcCategoryRatios', () => {
  it('returns 0 ratios when total is 0', () => {
    const breakdown = [{ categoryId: 'a', value: 0 }];
    const result = calcCategoryRatios(breakdown, 0);
    expect(result[0].ratio).toBe(0);
  });

  it('calculates correct ratios', () => {
    const breakdown = [
      { categoryId: 'a', value: 750000 },
      { categoryId: 'b', value: 250000 },
    ];
    const result = calcCategoryRatios(breakdown, 1000000);
    expect(result.find((r) => r.categoryId === 'a')?.ratio).toBeCloseTo(0.75);
    expect(result.find((r) => r.categoryId === 'b')?.ratio).toBeCloseTo(0.25);
  });
});

// ──────────────────────── Account type breakdown ────────────────────────
describe('calcAccountTypeBreakdown', () => {
  it('groups by account type', () => {
    const holdings = [
      { ...makeHolding('1', 'cat', 500000), accountType: 'NISA' as const },
      { ...makeHolding('2', 'cat', 300000), accountType: 'NISA' as const },
      { ...makeHolding('3', 'cat', 200000), accountType: '特定' as const },
    ];
    const result = calcAccountTypeBreakdown(holdings);
    const nisa = result.find((r) => r.accountType === 'NISA');
    const tokutei = result.find((r) => r.accountType === '特定');
    expect(nisa?.value).toBe(800000);
    expect(tokutei?.value).toBe(200000);
  });
});

// ──────────────────────── Previous snapshot comparison ────────────────────────
describe('calcPrevSnapshotComparison', () => {
  it('returns null when no previous snapshots', () => {
    const result = calcPrevSnapshotComparison(1000000, [], '2026-06');
    expect(result).toBeNull();
  });

  it('ignores snapshots from current month', () => {
    const snaps = [makeSnapshot('2026-06', 900000)];
    const result = calcPrevSnapshotComparison(1000000, snaps, '2026-06');
    expect(result).toBeNull();
  });

  it('compares with most recent previous snapshot', () => {
    const snaps = [
      makeSnapshot('2026-05', 900000),
      makeSnapshot('2026-04', 800000),
    ];
    const result = calcPrevSnapshotComparison(1000000, snaps, '2026-06');
    expect(result?.diff).toBe(100000);
    expect(result?.baseTotal).toBe(900000);
    expect(result?.diffPercent).toBeCloseTo(11.11, 1);
  });

  it('handles zero base total', () => {
    const snaps = [makeSnapshot('2026-05', 0)];
    const result = calcPrevSnapshotComparison(1000000, snaps, '2026-06');
    expect(result?.diffPercent).toBeNull();
  });
});

// ──────────────────────── Year comparison ────────────────────────
describe('calcYearComparison', () => {
  it('returns null when no snapshots in current year', () => {
    const snaps = [makeSnapshot('2025-12', 800000)];
    const result = calcYearComparison(1000000, snaps, 2026);
    expect(result).toBeNull();
  });

  it('uses January snapshot as year start', () => {
    const snaps = [
      makeSnapshot('2026-01', 800000),
      makeSnapshot('2026-03', 850000),
    ];
    const result = calcYearComparison(1000000, snaps, 2026);
    expect(result?.label).toBe('yearStart');
    expect(result?.baseTotal).toBe(800000);
    expect(result?.diff).toBe(200000);
  });

  it('uses first available snapshot when no January record', () => {
    const snaps = [makeSnapshot('2026-03', 850000)];
    const result = calcYearComparison(1000000, snaps, 2026);
    expect(result?.label).toBe('yearFirst');
    expect(result?.baseTotal).toBe(850000);
  });
});

// ──────────────────────── FIRE progress ────────────────────────
describe('calcFireProgress', () => {
  const baseSettings: AppSettings = {
    fireTargetAmount: 0,
    displayCurrency: 'JPY',
    maskAmountsOnLaunch: false,
  };

  it('returns isGoalSet=false when target is 0', () => {
    const result = calcFireProgress(1000000, baseSettings);
    expect(result.isGoalSet).toBe(false);
  });

  it('calculates progress correctly', () => {
    const settings = { ...baseSettings, fireTargetAmount: 50000000 };
    const result = calcFireProgress(10000000, settings);
    expect(result.reached).toBeCloseTo(0.2);
    expect(result.remaining).toBe(40000000);
  });

  it('caps reached at 1 when over target', () => {
    const settings = { ...baseSettings, fireTargetAmount: 5000000 };
    const result = calcFireProgress(10000000, settings);
    expect(result.reached).toBe(1);
    expect(result.remaining).toBe(0);
  });

  it('handles zero assets', () => {
    const settings = { ...baseSettings, fireTargetAmount: 50000000 };
    const result = calcFireProgress(0, settings);
    expect(result.reached).toBe(0);
    expect(result.remaining).toBe(50000000);
  });
});

// ──────────────────────── Unrealized gains ────────────────────────
describe('calcUnrealizedGains', () => {
  it('excludes cash holdings', () => {
    const cats = [makeCategory('cat-cash', 'cash'), makeCategory('cat-mainstream', 'investment')];
    const holdings = [
      { ...makeHolding('1', 'cat-cash', 1000000), costBasis: 900000 },
      { ...makeHolding('2', 'cat-mainstream', 1500000), costBasis: 1200000 },
    ];
    const result = calcUnrealizedGains(holdings, cats);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].holdingId).toBe('2');
  });

  it('excludes holdings without costBasis', () => {
    const cats = [makeCategory('cat-mainstream')];
    const holdings = [
      makeHolding('1', 'cat-mainstream', 1000000),
      { ...makeHolding('2', 'cat-mainstream', 1500000), costBasis: 1200000 },
    ];
    const result = calcUnrealizedGains(holdings, cats);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].holdingId).toBe('2');
  });

  it('calculates gain correctly', () => {
    const cats = [makeCategory('cat-mainstream')];
    const holdings = [{ ...makeHolding('1', 'cat-mainstream', 1500000), costBasis: 1200000 }];
    const result = calcUnrealizedGains(holdings, cats);
    expect(result.totalGain).toBe(300000);
    expect(result.totalGainPercent).toBeCloseTo(25);
  });

  it('returns null gainPercent when costBasis is 0', () => {
    const cats = [makeCategory('cat-mainstream')];
    const holdings = [{ ...makeHolding('1', 'cat-mainstream', 1000000), costBasis: 0 }];
    const result = calcUnrealizedGains(holdings, cats);
    expect(result.entries[0].gainPercent).toBeNull();
  });

  it('returns empty when no eligible holdings', () => {
    const result = calcUnrealizedGains([], []);
    expect(result.entries).toHaveLength(0);
    expect(result.totalGain).toBe(0);
  });
});

// ──────────────────────── Snapshot ────────────────────────
describe('buildSnapshot', () => {
  const cats = [
    makeCategory('cat-mainstream', 'investment'),
    makeCategory('cat-cash', 'cash'),
  ];
  const holdings = [
    makeHolding('h1', 'cat-mainstream', 1000000),
    makeHolding('h2', 'cat-cash', 500000),
  ];

  it('totalAssets equals sum of categoryBreakdown', () => {
    const snap = buildSnapshot(holdings, cats);
    const catSum = snap.categoryBreakdown.reduce((s, c) => s + c.value, 0);
    expect(snap.totalAssets).toBe(catSum);
  });

  it('totalAssets equals sum of assetClassBreakdown', () => {
    const snap = buildSnapshot(holdings, cats);
    const classSum = snap.assetClassBreakdown.cash + snap.assetClassBreakdown.investment + snap.assetClassBreakdown.crypto;
    expect(snap.totalAssets).toBe(classSum);
  });

  it('preserves createdAt on upsert', () => {
    const existingId = 'existing-id';
    const existingCreatedAt = '2026-01-01T00:00:00.000Z';
    const snap = buildSnapshot(holdings, cats, undefined, existingId, existingCreatedAt);
    expect(snap.id).toBe(existingId);
    expect(snap.createdAt).toBe(existingCreatedAt);
    expect(snap.updatedAt).not.toBe(existingCreatedAt);
  });

  it('snapshot is immutable from holding changes (values frozen at build time)', () => {
    const snap = buildSnapshot(holdings, cats);
    const originalTotal = snap.totalAssets;
    // Mutating holdings after snapshot creation should not affect snapshot
    holdings[0].marketValue = 9999999;
    expect(snap.totalAssets).toBe(originalTotal);
  });
});

// ──────────────────────── hasHoldingsChangedSinceSnapshot ────────────────────────
describe('hasHoldingsChangedSinceSnapshot', () => {
  const cats = [makeCategory('cat-mainstream')];

  it('returns false when values match', () => {
    const holdings = [makeHolding('h1', 'cat-mainstream', 1000000)];
    const snap = buildSnapshot(holdings, cats);
    expect(hasHoldingsChangedSinceSnapshot(holdings, snap)).toBe(false);
  });

  it('returns true when a value changes', () => {
    const holdings = [makeHolding('h1', 'cat-mainstream', 1000000)];
    const snap = buildSnapshot(holdings, cats);
    const updated = [{ ...holdings[0], marketValue: 1100000 }];
    expect(hasHoldingsChangedSinceSnapshot(updated, snap)).toBe(true);
  });

  it('returns true when a holding is added', () => {
    const holdings = [makeHolding('h1', 'cat-mainstream', 1000000)];
    const snap = buildSnapshot(holdings, cats);
    const updated = [...holdings, makeHolding('h2', 'cat-mainstream', 200000)];
    expect(hasHoldingsChangedSinceSnapshot(updated, snap)).toBe(true);
  });
});
