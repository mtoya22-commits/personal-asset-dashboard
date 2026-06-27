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

  // Validate holdings
  const holdResult = validateHoldings(obj.holdings as unknown[]);
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

function validateHoldings(holdings: unknown[]): ValidationResult {
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
