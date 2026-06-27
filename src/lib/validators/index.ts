import type { BackupFile } from '../../types/index.js';
import { DEFAULT_CATEGORIES } from '../../storage/defaults.js';

export type ValidationResult = { ok: true } | { ok: false; error: string };

function isValidAssetClass(v: unknown): v is 'cash' | 'investment' | 'crypto' {
  return v === 'cash' || v === 'investment' || v === 'crypto';
}

function isValidAccountType(v: unknown): boolean {
  return ['NISA', '特定', 'iDeCo', 'DC', '預金', '暗号資産取引所', 'その他'].includes(v as string);
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v) && v >= 0 && Math.floor(v) === v;
}

function isNonNegativeFinite(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v) && v >= 0;
}

export function validateBackupFile(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: '不正なJSON形式です' };
  }
  const obj = raw as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    return { ok: false, error: `未対応のschemaVersionです: ${obj.schemaVersion}` };
  }
  if (obj.appName !== 'personal-asset-dashboard') {
    return { ok: false, error: 'このファイルは対応していないアプリのバックアップです' };
  }
  if (!Array.isArray(obj.categories)) {
    return { ok: false, error: 'カテゴリデータが不正です' };
  }
  if (!Array.isArray(obj.holdings)) {
    return { ok: false, error: '保有資産データが不正です' };
  }
  if (!Array.isArray(obj.snapshots)) {
    return { ok: false, error: '月次記録データが不正です' };
  }
  if (typeof obj.settings !== 'object' || obj.settings === null) {
    return { ok: false, error: '設定データが不正です' };
  }

  // Validate categories
  const catResult = validateCategories(obj.categories as unknown[]);
  if (!catResult.ok) return catResult;

  const validCatIds = new Set((obj.categories as Array<{ id: string }>).map((c) => c.id));
  const catAssetClassMap = new Map(
    (obj.categories as Array<{ id: string; assetClass: string }>).map((c) => [c.id, c.assetClass]),
  );

  // Validate holdings
  const holdResult = validateHoldings(obj.holdings as unknown[], validCatIds, catAssetClassMap);
  if (!holdResult.ok) return holdResult;

  // Validate snapshots
  const snapResult = validateSnapshots(obj.snapshots as unknown[]);
  if (!snapResult.ok) return snapResult;

  // Validate settings
  const settResult = validateSettings(obj.settings);
  if (!settResult.ok) return settResult;

  return { ok: true };
}

function validateCategories(cats: unknown[]): ValidationResult {
  const ids = new Set<string>();
  const defaultCatMap = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.assetClass]));

  for (const cat of cats) {
    if (typeof cat !== 'object' || cat === null) {
      return { ok: false, error: 'カテゴリのデータ形式が不正です' };
    }
    const c = cat as Record<string, unknown>;
    if (typeof c.id !== 'string' || !c.id) {
      return { ok: false, error: 'カテゴリIDが不正です' };
    }
    if (ids.has(c.id)) {
      return { ok: false, error: `カテゴリIDが重複しています: ${c.id}` };
    }
    ids.add(c.id);
    if (typeof c.name !== 'string') {
      return { ok: false, error: `カテゴリ名が不正です: ${c.id}` };
    }
    if (!isValidAssetClass(c.assetClass)) {
      return { ok: false, error: `大分類が不正です: ${c.id}` };
    }
    // Fixed category ID → assetClass must match
    if (defaultCatMap.has(c.id) && defaultCatMap.get(c.id) !== c.assetClass) {
      return { ok: false, error: `固定カテゴリ「${c.id}」の大分類は変更できません` };
    }
  }

  // All default categories must be present
  for (const dc of DEFAULT_CATEGORIES) {
    if (!ids.has(dc.id)) {
      return { ok: false, error: `固定カテゴリが欠落しています: ${dc.id}` };
    }
  }

  return { ok: true };
}

function validateHoldings(
  holdings: unknown[],
  validCatIds: Set<string>,
  catAssetClassMap: Map<string, string>,
): ValidationResult {
  const ids = new Set<string>();
  for (const h of holdings) {
    if (typeof h !== 'object' || h === null) {
      return { ok: false, error: '保有資産のデータ形式が不正です' };
    }
    const holding = h as Record<string, unknown>;
    if (typeof holding.id !== 'string' || !holding.id) {
      return { ok: false, error: '保有資産IDが不正です' };
    }
    if (ids.has(holding.id)) {
      return { ok: false, error: `保有資産IDが重複しています: ${holding.id}` };
    }
    ids.add(holding.id);
    if (typeof holding.name !== 'string' || !holding.name) {
      return { ok: false, error: `資産名が不正です: ${holding.id}` };
    }
    if (typeof holding.categoryId !== 'string' || !validCatIds.has(holding.categoryId)) {
      return { ok: false, error: `保有資産「${holding.name}」のカテゴリIDが存在しません: ${holding.categoryId}` };
    }
    if (!isNonNegativeInt(holding.marketValue)) {
      return { ok: false, error: `評価額が不正です: ${holding.name}` };
    }
    if (holding.costBasis !== undefined && !isNonNegativeFinite(holding.costBasis)) {
      return { ok: false, error: `取得額が不正です: ${holding.name}` };
    }
    if (holding.quantity !== undefined && !isNonNegativeFinite(holding.quantity)) {
      return { ok: false, error: `数量が不正です: ${holding.name}` };
    }
    if (!isValidAccountType(holding.accountType)) {
      return { ok: false, error: `口座種別が不正です: ${holding.name}` };
    }
    if (holding.accountType === 'NISA' && catAssetClassMap.get(holding.categoryId as string) !== 'investment') {
      return { ok: false, error: `保有資産「${holding.name}」はNISA口座ですが、カテゴリが投資資産ではありません` };
    }
  }
  return { ok: true };
}

function validateSnapshots(snapshots: unknown[]): ValidationResult {
  const ids = new Set<string>();
  const monthKeys = new Set<string>();
  for (const s of snapshots) {
    if (typeof s !== 'object' || s === null) {
      return { ok: false, error: '月次記録のデータ形式が不正です' };
    }
    const snap = s as Record<string, unknown>;
    if (typeof snap.id !== 'string' || !snap.id) {
      return { ok: false, error: '月次記録IDが不正です' };
    }
    if (ids.has(snap.id)) {
      return { ok: false, error: `月次記録IDが重複しています: ${snap.id}` };
    }
    ids.add(snap.id);
    if (typeof snap.monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(snap.monthKey)) {
      return { ok: false, error: `monthKeyが不正です: ${snap.id}` };
    }
    if (monthKeys.has(snap.monthKey)) {
      return { ok: false, error: `monthKeyが重複しています: ${snap.monthKey}` };
    }
    monthKeys.add(snap.monthKey);
    if (!isNonNegativeInt(snap.totalAssets)) {
      return { ok: false, error: `totalAssetsが不正です: ${snap.monthKey}` };
    }

    const monthKey = snap.monthKey as string;
    const totalAssets = snap.totalAssets as number;

    // Validate assetClassBreakdown
    if (typeof snap.assetClassBreakdown !== 'object' || snap.assetClassBreakdown === null) {
      return { ok: false, error: `assetClassBreakdownが不正です: ${monthKey}` };
    }
    const acd = snap.assetClassBreakdown as Record<string, unknown>;
    if (!isNonNegativeFinite(acd.cash) || !isNonNegativeFinite(acd.investment) || !isNonNegativeFinite(acd.crypto)) {
      return { ok: false, error: `assetClassBreakdownの値が不正です: ${monthKey}` };
    }
    const storedCash = acd.cash as number;
    const storedInvestment = acd.investment as number;
    const storedCrypto = acd.crypto as number;
    if (Math.round(storedCash + storedInvestment + storedCrypto) !== totalAssets) {
      return { ok: false, error: `totalAssetsとassetClassBreakdownの合計が一致しません: ${monthKey}` };
    }

    // Validate holdingsSnapshot array and compute sums
    if (!Array.isArray(snap.holdingsSnapshot)) {
      return { ok: false, error: `holdingsSnapshotが不正です: ${monthKey}` };
    }
    const consistencyResult = validateSnapshotConsistency(
      monthKey,
      totalAssets,
      snap.holdingsSnapshot as unknown[],
      snap.categoryBreakdown as unknown,
      storedCash,
      storedInvestment,
      storedCrypto,
    );
    if (!consistencyResult.ok) return consistencyResult;
  }
  return { ok: true };
}

function validateSnapshotConsistency(
  monthKey: string,
  totalAssets: number,
  holdingsSnap: unknown[],
  categoryBreakdownRaw: unknown,
  storedCash: number,
  storedInvestment: number,
  storedCrypto: number,
): ValidationResult {
  // Validate each holdingsSnapshot item and compute derived totals
  let holdingsTotal = 0;
  let computedCash = 0;
  let computedInvestment = 0;
  let computedCrypto = 0;
  const computedCatMap = new Map<string, number>();

  for (const h of holdingsSnap) {
    if (typeof h !== 'object' || h === null) {
      return { ok: false, error: `holdingsSnapshotのデータ形式が不正です: ${monthKey}` };
    }
    const hs = h as Record<string, unknown>;
    if (!isNonNegativeInt(hs.marketValue)) {
      return { ok: false, error: `holdingsSnapshotのmarketValueが不正です: ${monthKey}` };
    }
    if (!isValidAssetClass(hs.assetClass)) {
      return { ok: false, error: `holdingsSnapshotのassetClassが不正です: ${monthKey}` };
    }
    if (typeof hs.categoryId !== 'string' || !hs.categoryId) {
      return { ok: false, error: `holdingsSnapshotのcategoryIdが不正です: ${monthKey}` };
    }

    const mv = hs.marketValue as number;
    holdingsTotal += mv;
    computedCatMap.set(hs.categoryId, (computedCatMap.get(hs.categoryId) ?? 0) + mv);

    if (hs.assetClass === 'cash') computedCash += mv;
    else if (hs.assetClass === 'crypto') computedCrypto += mv;
    else computedInvestment += mv;
  }

  // holdingsSnapshot sum must equal totalAssets
  if (Math.round(holdingsTotal) !== totalAssets) {
    return { ok: false, error: `holdingsSnapshotの合計とtotalAssetsが一致しません: ${monthKey}` };
  }

  // holdingsSnapshot-derived assetClass breakdown must match stored
  if (
    Math.round(computedCash) !== Math.round(storedCash) ||
    Math.round(computedInvestment) !== Math.round(storedInvestment) ||
    Math.round(computedCrypto) !== Math.round(storedCrypto)
  ) {
    return { ok: false, error: `holdingsSnapshotの大分類集計とassetClassBreakdownが一致しません: ${monthKey}` };
  }

  // Validate categoryBreakdown array
  if (!Array.isArray(categoryBreakdownRaw)) {
    return { ok: false, error: `categoryBreakdownが不正です: ${monthKey}` };
  }
  const categoryBreakdown = categoryBreakdownRaw as unknown[];

  // Check for duplicate categoryIds and validate structure
  const catBdIds = new Set<string>();
  let catBdSum = 0;
  const storedCatMap = new Map<string, number>();
  for (const entry of categoryBreakdown) {
    if (typeof entry !== 'object' || entry === null) {
      return { ok: false, error: `categoryBreakdownのデータ形式が不正です: ${monthKey}` };
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.categoryId !== 'string' || !e.categoryId) {
      return { ok: false, error: `categoryBreakdownのcategoryIdが不正です: ${monthKey}` };
    }
    if (catBdIds.has(e.categoryId)) {
      return { ok: false, error: `categoryBreakdownにcategoryIdの重複があります: ${monthKey}` };
    }
    catBdIds.add(e.categoryId);
    if (!isNonNegativeFinite(e.value)) {
      return { ok: false, error: `categoryBreakdownのvalueが不正です: ${monthKey}` };
    }
    if (!isValidAssetClass(e.assetClass)) {
      return { ok: false, error: `categoryBreakdownのassetClassが不正です: ${monthKey}` };
    }
    const val = e.value as number;
    catBdSum += val;
    storedCatMap.set(e.categoryId, val);
  }

  // categoryBreakdown sum must equal totalAssets
  if (Math.round(catBdSum) !== totalAssets) {
    return { ok: false, error: `categoryBreakdownの合計とtotalAssetsが一致しません: ${monthKey}` };
  }

  // holdingsSnapshot-derived category breakdown must match stored categoryBreakdown
  if (computedCatMap.size !== storedCatMap.size) {
    return { ok: false, error: `holdingsSnapshotのカテゴリ集計とcategoryBreakdownが一致しません: ${monthKey}` };
  }
  for (const [catId, computedVal] of computedCatMap) {
    const storedVal = storedCatMap.get(catId);
    if (storedVal === undefined || Math.round(computedVal) !== Math.round(storedVal)) {
      return { ok: false, error: `holdingsSnapshotのカテゴリ集計とcategoryBreakdownが一致しません: ${monthKey}` };
    }
  }

  return { ok: true };
}

function validateSettings(settings: unknown): ValidationResult {
  if (typeof settings !== 'object' || settings === null) {
    return { ok: false, error: '設定データが不正です' };
  }
  const s = settings as Record<string, unknown>;
  if (typeof s.fireTargetAmount !== 'number' || !isFinite(s.fireTargetAmount) || s.fireTargetAmount < 0) {
    return { ok: false, error: 'FIRE目標額が不正です' };
  }
  if (s.displayCurrency !== 'JPY') {
    return { ok: false, error: '通貨設定が不正です' };
  }
  if (typeof s.maskAmountsOnLaunch !== 'boolean') {
    return { ok: false, error: '金額マスク設定が不正です' };
  }
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Input normalization
// ────────────────────────────────────────────────────────────────────────────

export function normalizeNumericInput(raw: string): number | null {
  // Convert full-width digits to half-width
  const halfWidth = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  // Remove commas and spaces
  const cleaned = halfWidth.replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!isFinite(n) || n < 0) return null;
  return n;
}

export function normalizeIntegerInput(raw: string): number | null {
  const n = normalizeNumericInput(raw);
  if (n === null) return null;
  return Math.floor(n);
}

export type HoldingValidationError = {
  name?: string;
  marketValue?: string;
  costBasis?: string;
  quantity?: string;
  memo?: string;
};

export function validateHoldingInput(input: {
  name: string;
  marketValue: string;
  costBasis: string;
  quantity: string;
  memo: string;
  isCash: boolean;
}): HoldingValidationError {
  const errors: HoldingValidationError = {};

  if (!input.name.trim()) {
    errors.name = '資産名は必須です';
  } else if (input.name.trim().length > 80) {
    errors.name = '資産名は80文字以内で入力してください';
  }

  const mv = normalizeIntegerInput(input.marketValue);
  if (mv === null) {
    errors.marketValue = '評価額は0以上の整数を入力してください';
  }

  if (!input.isCash) {
    if (input.costBasis.trim() !== '') {
      const cb = normalizeIntegerInput(input.costBasis);
      if (cb === null) {
        errors.costBasis = '取得額は0以上の整数を入力してください';
      }
    }
    if (input.quantity.trim() !== '') {
      const qty = normalizeNumericInput(input.quantity);
      if (qty === null) {
        errors.quantity = '数量は0以上の数値を入力してください';
      }
    }
  }

  if (input.memo.length > 500) {
    errors.memo = 'メモは500文字以内で入力してください';
  }

  return errors;
}

export function asTypedBackupFile(raw: unknown): BackupFile {
  return raw as BackupFile;
}

export { DEFAULT_CATEGORIES };
