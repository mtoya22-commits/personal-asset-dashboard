import type {
  Holding,
  AssetCategory,
  MonthlySnapshot,
  HoldingSnapshot,
  AssetClass,
  AppSettings,
} from '../../types/index.js';
import { getMonthKeyJST, getSnapshotDateJST, getISONow } from '../formatters/index.js';

// ────────────────────────────────────────────────────────────────────────────
// Basic aggregation
// ────────────────────────────────────────────────────────────────────────────

export function calcTotalAssets(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + h.marketValue, 0);
}

export function calcCategoryBreakdown(
  holdings: Holding[],
  categories: AssetCategory[],
): Array<{ categoryId: string; categoryName: string; assetClass: AssetClass; value: number }> {
  const map = new Map<string, { categoryName: string; assetClass: AssetClass; value: number }>();
  for (const cat of categories) {
    map.set(cat.id, { categoryName: cat.name, assetClass: cat.assetClass, value: 0 });
  }
  for (const h of holdings) {
    const entry = map.get(h.categoryId);
    if (entry) entry.value += h.marketValue;
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.value > 0)
    .map(([categoryId, v]) => ({ categoryId, ...v }));
}

export function calcAssetClassBreakdown(
  holdings: Holding[],
  categories: AssetCategory[],
): { cash: number; investment: number; crypto: number } {
  const catMap = new Map<string, AssetClass>(categories.map((c) => [c.id, c.assetClass]));
  let cash = 0,
    investment = 0,
    crypto = 0;
  for (const h of holdings) {
    const ac = catMap.get(h.categoryId) ?? 'investment';
    if (ac === 'cash') cash += h.marketValue;
    else if (ac === 'crypto') crypto += h.marketValue;
    else investment += h.marketValue;
  }
  return { cash, investment, crypto };
}

export function calcCategoryRatios(
  breakdown: Array<{ categoryId: string; value: number }>,
  total: number,
): Array<{ categoryId: string; ratio: number }> {
  if (total === 0) return breakdown.map((b) => ({ categoryId: b.categoryId, ratio: 0 }));
  return breakdown.map((b) => ({ categoryId: b.categoryId, ratio: b.value / total }));
}

export function calcAssetClassRatios(
  breakdown: { cash: number; investment: number; crypto: number },
  total: number,
): { cash: number; investment: number; crypto: number } {
  if (total === 0) return { cash: 0, investment: 0, crypto: 0 };
  return {
    cash: breakdown.cash / total,
    investment: breakdown.investment / total,
    crypto: breakdown.crypto / total,
  };
}

export function calcAccountTypeBreakdown(
  holdings: Holding[],
): Array<{ accountType: string; value: number }> {
  const map = new Map<string, number>();
  for (const h of holdings) {
    map.set(h.accountType, (map.get(h.accountType) ?? 0) + h.marketValue);
  }
  return Array.from(map.entries())
    .map(([accountType, value]) => ({ accountType, value }))
    .sort((a, b) => b.value - a.value);
}

export function calcNisaValue(holdings: Holding[], categories: AssetCategory[]): number {
  const catMap = new Map<string, string>(categories.map((c) => [c.id, c.assetClass]));
  return holdings
    .filter((h) => h.accountType === 'NISA' && catMap.get(h.categoryId) === 'investment')
    .reduce((s, h) => s + h.marketValue, 0);
}

export function calcNisaRatio(nisaValue: number, investmentTotal: number): number | null {
  if (investmentTotal === 0) return null;
  return nisaValue / investmentTotal;
}

// ────────────────────────────────────────────────────────────────────────────
// Comparisons
// ────────────────────────────────────────────────────────────────────────────

export type SnapshotComparison = {
  diff: number;
  diffPercent: number | null;
  baseDate: string;
  baseTotal: number;
};

export function calcPrevSnapshotComparison(
  currentTotal: number,
  snapshots: MonthlySnapshot[],
  currentMonthKey: string,
): SnapshotComparison | null {
  const prevSnaps = snapshots
    .filter((s) => s.monthKey < currentMonthKey)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  if (prevSnaps.length === 0) return null;
  const prev = prevSnaps[0];
  const diff = currentTotal - prev.totalAssets;
  const diffPercent = prev.totalAssets === 0 ? null : (diff / prev.totalAssets) * 100;
  return { diff, diffPercent, baseDate: prev.snapshotDate, baseTotal: prev.totalAssets };
}

export type YearComparison = {
  diff: number;
  diffPercent: number | null;
  baseDate: string;
  baseTotal: number;
  label: 'yearStart' | 'yearFirst';
};

export function calcYearComparison(
  currentTotal: number,
  snapshots: MonthlySnapshot[],
  currentYear: number,
): YearComparison | null {
  const yearSnaps = snapshots
    .filter((s) => s.monthKey.startsWith(`${currentYear}-`))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  if (yearSnaps.length === 0) return null;
  const januarySnap = yearSnaps.find((s) => s.monthKey === `${currentYear}-01`);
  const base = januarySnap ?? yearSnaps[0];
  const label: 'yearStart' | 'yearFirst' = januarySnap ? 'yearStart' : 'yearFirst';
  const diff = currentTotal - base.totalAssets;
  const diffPercent = base.totalAssets === 0 ? null : (diff / base.totalAssets) * 100;
  return { diff, diffPercent, baseDate: base.snapshotDate, baseTotal: base.totalAssets, label };
}

// ────────────────────────────────────────────────────────────────────────────
// FIRE progress
// ────────────────────────────────────────────────────────────────────────────

export type FireProgress = {
  targetAmount: number;
  currentAmount: number;
  reached: number;
  remaining: number;
  isGoalSet: boolean;
};

export function calcFireProgress(currentTotal: number, settings: AppSettings): FireProgress {
  const isGoalSet = settings.fireTargetAmount > 0;
  const targetAmount = settings.fireTargetAmount;
  const reached = isGoalSet && targetAmount > 0 ? Math.min(currentTotal / targetAmount, 1) : 0;
  const remaining = isGoalSet ? Math.max(targetAmount - currentTotal, 0) : 0;
  return { targetAmount, currentAmount: currentTotal, reached, remaining, isGoalSet };
}

// ────────────────────────────────────────────────────────────────────────────
// Top N
// ────────────────────────────────────────────────────────────────────────────

export function calcTopHoldings(
  holdings: Holding[],
  categories: AssetCategory[],
  n = 5,
): Array<{ holding: Holding; categoryName: string; ratio: number }> {
  const total = calcTotalAssets(holdings);
  const catMap = new Map<string, string>(categories.map((c) => [c.id, c.name]));
  return [...holdings]
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, n)
    .map((h) => ({
      holding: h,
      categoryName: catMap.get(h.categoryId) ?? '—',
      ratio: total > 0 ? h.marketValue / total : 0,
    }));
}

export function calcTopCategories(
  breakdown: Array<{ categoryId: string; categoryName: string; value: number }>,
  n = 5,
): Array<{ categoryId: string; categoryName: string; value: number }> {
  return [...breakdown].sort((a, b) => b.value - a.value).slice(0, n);
}

// ────────────────────────────────────────────────────────────────────────────
// Unrealized gains
// ────────────────────────────────────────────────────────────────────────────

export type UnrealizedGainEntry = {
  holdingId: string;
  name: string;
  marketValue: number;
  costBasis: number;
  gain: number;
  gainPercent: number | null;
};

export type UnrealizedGainsSummary = {
  totalGain: number;
  totalGainPercent: number | null;
  targetMarketValue: number;
  investmentCryptoTotal: number;
  entries: UnrealizedGainEntry[];
};

export function calcUnrealizedGains(
  holdings: Holding[],
  categories: AssetCategory[],
): UnrealizedGainsSummary {
  const catMap = new Map<string, AssetClass>(categories.map((c) => [c.id, c.assetClass]));
  const investmentCryptoTotal = holdings
    .filter((h) => {
      const ac = catMap.get(h.categoryId);
      return ac === 'investment' || ac === 'crypto';
    })
    .reduce((s, h) => s + h.marketValue, 0);

  const eligible = holdings.filter((h) => {
    const ac = catMap.get(h.categoryId);
    return (ac === 'investment' || ac === 'crypto') && h.costBasis !== undefined;
  });

  const entries: UnrealizedGainEntry[] = eligible.map((h) => {
    const costBasis = h.costBasis!;
    const gain = h.marketValue - costBasis;
    const gainPercent = costBasis === 0 ? null : (gain / costBasis) * 100;
    return { holdingId: h.id, name: h.name, marketValue: h.marketValue, costBasis, gain, gainPercent };
  });

  const targetMarketValue = entries.reduce((s, e) => s + e.marketValue, 0);
  const totalCost = entries.reduce((s, e) => s + e.costBasis, 0);
  const totalGain = entries.reduce((s, e) => s + e.gain, 0);
  const totalGainPercent = totalCost === 0 ? null : (totalGain / totalCost) * 100;

  return { totalGain, totalGainPercent, targetMarketValue, investmentCryptoTotal, entries };
}

// ────────────────────────────────────────────────────────────────────────────
// Snapshot generation
// ────────────────────────────────────────────────────────────────────────────

export function buildHoldingsSnapshot(
  holdings: Holding[],
  categories: AssetCategory[],
): HoldingSnapshot[] {
  const catMap = new Map<string, AssetCategory>(categories.map((c) => [c.id, c]));
  return holdings.map((h) => {
    const cat = catMap.get(h.categoryId);
    return {
      id: h.id,
      name: h.name,
      categoryId: h.categoryId,
      categoryName: cat?.name ?? '—',
      assetClass: cat?.assetClass ?? 'investment',
      accountType: h.accountType,
      marketValue: h.marketValue,
      ...(h.costBasis !== undefined ? { costBasis: h.costBasis } : {}),
      ...(h.quantity !== undefined ? { quantity: h.quantity } : {}),
      ...(h.memo !== undefined ? { memo: h.memo } : {}),
    };
  });
}

export function buildSnapshot(
  holdings: Holding[],
  categories: AssetCategory[],
  memo?: string,
  existingId?: string,
  existingCreatedAt?: string,
): MonthlySnapshot {
  const monthKey = getMonthKeyJST();
  const snapshotDate = getSnapshotDateJST();
  const now = getISONow();
  const categoryBreakdown = calcCategoryBreakdown(holdings, categories);
  const assetClassBreakdown = calcAssetClassBreakdown(holdings, categories);
  const totalAssets =
    assetClassBreakdown.cash + assetClassBreakdown.investment + assetClassBreakdown.crypto;
  const holdingsSnapshot = buildHoldingsSnapshot(holdings, categories);

  return {
    id: existingId ?? crypto.randomUUID(),
    monthKey,
    snapshotDate,
    totalAssets,
    categoryBreakdown,
    assetClassBreakdown,
    holdingsSnapshot,
    ...(memo !== undefined ? { memo } : {}),
    createdAt: existingCreatedAt ?? now,
    updatedAt: now,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Dashboard change detection
// ────────────────────────────────────────────────────────────────────────────

export function hasHoldingsChangedSinceSnapshot(
  holdings: Holding[],
  snapshot: MonthlySnapshot,
): boolean {
  if (holdings.length !== snapshot.holdingsSnapshot.length) return true;
  const snapMap = new Map(snapshot.holdingsSnapshot.map((h) => [h.id, h.marketValue]));
  for (const h of holdings) {
    if (!snapMap.has(h.id)) return true;
    if (snapMap.get(h.id) !== h.marketValue) return true;
  }
  return false;
}
