import { describe, it, expect } from 'vitest';
import type { BackupFile } from '../../types/index.js';
import { validateBackupFile, normalizeNumericInput, normalizeIntegerInput } from './index.js';
import { DEFAULT_CATEGORIES } from '../../storage/defaults.js';

function makeValidBackup(): BackupFile {
  return {
    schemaVersion: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    appName: 'personal-asset-dashboard',
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    holdings: [],
    snapshots: [],
    settings: {
      fireTargetAmount: 0,
      displayCurrency: 'JPY',
      maskAmountsOnLaunch: false,
    },
  };
}

describe('validateBackupFile', () => {
  it('accepts a valid backup', () => {
    const result = validateBackupFile(makeValidBackup());
    expect(result.ok).toBe(true);
  });

  it('rejects non-object', () => {
    expect(validateBackupFile(null).ok).toBe(false);
    expect(validateBackupFile('string').ok).toBe(false);
    expect(validateBackupFile(42).ok).toBe(false);
  });

  it('rejects unknown schemaVersion', () => {
    const backup = { ...makeValidBackup(), schemaVersion: 2 };
    const result = validateBackupFile(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('schemaVersion');
  });

  it('rejects wrong appName', () => {
    const backup = { ...makeValidBackup(), appName: 'other-app' };
    expect(validateBackupFile(backup).ok).toBe(false);
  });

  it('rejects duplicate holding IDs', () => {
    const backup = makeValidBackup();
    backup.holdings = [
      { id: 'h1', categoryId: DEFAULT_CATEGORIES[0].id, name: 'A', accountType: 'その他', marketValue: 1000, createdAt: '', updatedAt: '' },
      { id: 'h1', categoryId: DEFAULT_CATEGORIES[0].id, name: 'B', accountType: 'その他', marketValue: 2000, createdAt: '', updatedAt: '' },
    ];
    const result = validateBackupFile(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('重複');
  });

  it('rejects duplicate monthKeys', () => {
    const backup = makeValidBackup();
    backup.snapshots = [
      { id: 's1', monthKey: '2026-01', snapshotDate: '2026-01-31', totalAssets: 0, categoryBreakdown: [], assetClassBreakdown: { cash: 0, investment: 0, crypto: 0 }, holdingsSnapshot: [], createdAt: '', updatedAt: '' },
      { id: 's2', monthKey: '2026-01', snapshotDate: '2026-01-15', totalAssets: 0, categoryBreakdown: [], assetClassBreakdown: { cash: 0, investment: 0, crypto: 0 }, holdingsSnapshot: [], createdAt: '', updatedAt: '' },
    ];
    const result = validateBackupFile(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('monthKey');
  });

  it('rejects category assetClass mismatch for fixed categories', () => {
    const backup = makeValidBackup();
    const cashCat = backup.categories.find((c) => c.id === 'cat-cash')!;
    cashCat.assetClass = 'investment' as const;
    const result = validateBackupFile(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('大分類');
  });

  it('rejects missing default category', () => {
    const backup = makeValidBackup();
    backup.categories = backup.categories.filter((c) => c.id !== 'cat-cash');
    const result = validateBackupFile(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('cat-cash');
  });

  it('rejects negative market value', () => {
    const backup = makeValidBackup();
    backup.holdings = [
      { id: 'h1', categoryId: DEFAULT_CATEGORIES[0].id, name: 'A', accountType: 'その他', marketValue: -100, createdAt: '', updatedAt: '' },
    ];
    const result = validateBackupFile(backup);
    expect(result.ok).toBe(false);
  });

  it('accepts edited category names and colors', () => {
    const backup = makeValidBackup();
    backup.categories = backup.categories.map((c) => ({ ...c, name: `${c.name} (edited)`, color: '#ff0000' }));
    expect(validateBackupFile(backup).ok).toBe(true);
  });

  it('rejects holding with unknown categoryId', () => {
    const backup = makeValidBackup();
    backup.holdings = [
      { id: 'h1', categoryId: 'non-existent-cat', name: 'A', accountType: 'その他', marketValue: 1000, createdAt: '', updatedAt: '' },
    ];
    const result = validateBackupFile(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('カテゴリID');
  });

  it('rejects NISA holding in non-investment category', () => {
    const backup = makeValidBackup();
    const cashCat = backup.categories.find((c) => c.id === 'cat-cash')!;
    backup.holdings = [
      { id: 'h1', categoryId: cashCat.id, name: 'Cash NISA', accountType: 'NISA', marketValue: 1000, createdAt: '', updatedAt: '' },
    ];
    const result = validateBackupFile(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('NISA');
  });

  it('accepts NISA holding in investment category', () => {
    const backup = makeValidBackup();
    const invCat = backup.categories.find((c) => c.assetClass === 'investment')!;
    backup.holdings = [
      { id: 'h1', categoryId: invCat.id, name: 'Inv NISA', accountType: 'NISA', marketValue: 1000, createdAt: '', updatedAt: '' },
    ];
    expect(validateBackupFile(backup).ok).toBe(true);
  });

  it('rejects snapshot where totalAssets does not match assetClassBreakdown sum', () => {
    const backup = makeValidBackup();
    backup.snapshots = [
      {
        id: 's1',
        monthKey: '2026-01',
        snapshotDate: '2026-01-31',
        totalAssets: 1000000,
        categoryBreakdown: [],
        assetClassBreakdown: { cash: 100000, investment: 200000, crypto: 0 },
        holdingsSnapshot: [],
        createdAt: '',
        updatedAt: '',
      },
    ];
    const result = validateBackupFile(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('合計が一致しません');
  });

  it('accepts snapshot where totalAssets matches assetClassBreakdown sum', () => {
    const backup = makeValidBackup();
    backup.snapshots = [
      {
        id: 's1',
        monthKey: '2026-01',
        snapshotDate: '2026-01-31',
        totalAssets: 1500000,
        categoryBreakdown: [],
        assetClassBreakdown: { cash: 500000, investment: 1000000, crypto: 0 },
        holdingsSnapshot: [],
        createdAt: '',
        updatedAt: '',
      },
    ];
    expect(validateBackupFile(backup).ok).toBe(true);
  });
});

describe('normalizeNumericInput', () => {
  it('parses plain numbers', () => {
    expect(normalizeNumericInput('1000000')).toBe(1000000);
  });

  it('parses numbers with commas', () => {
    expect(normalizeNumericInput('1,000,000')).toBe(1000000);
  });

  it('converts full-width digits', () => {
    expect(normalizeNumericInput('１２３４５')).toBe(12345);
  });

  it('returns null for empty string', () => {
    expect(normalizeNumericInput('')).toBeNull();
  });

  it('returns null for negative numbers', () => {
    expect(normalizeNumericInput('-100')).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(normalizeNumericInput('abc')).toBeNull();
  });

  it('returns null for Infinity', () => {
    expect(normalizeNumericInput('Infinity')).toBeNull();
  });
});

describe('normalizeIntegerInput', () => {
  it('floors decimal input', () => {
    expect(normalizeIntegerInput('1000.7')).toBe(1000);
  });

  it('returns null for empty', () => {
    expect(normalizeIntegerInput('')).toBeNull();
  });
});
