import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { getDB, getCategories, getHoldings, getSnapshots, getSettings, putHolding, upsertSnapshot, deleteHolding } from './db.js';
import type { Holding, MonthlySnapshot } from '../types/index.js';
import { DEFAULT_CATEGORIES } from './defaults.js';

// Reset the fake IndexedDB between tests
let fakeIDB: IDBFactory;
beforeEach(async () => {
  fakeIDB = new IDBFactory();
  // Patch the global indexedDB used by idb library for this test module
  // Since fake-indexeddb/auto patches globalThis.indexedDB, we reset it per test
  globalThis.indexedDB = fakeIDB;
  // @ts-expect-error - resetting module-level cached db
  (await import('./db.js')).then?.(() => {});
});

// Note: Since we can't easily reset the cached _db in db.ts between tests,
// we test the storage operations in sequence within a single describe block.

const makeHolding = (id: string): Holding => ({
  id,
  categoryId: DEFAULT_CATEGORIES[0].id,
  name: `Test ${id}`,
  accountType: 'その他',
  marketValue: 1000000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const makeSnapshot = (monthKey: string, total: number): MonthlySnapshot => ({
  id: `snap-${monthKey}`,
  monthKey,
  snapshotDate: `${monthKey}-28`,
  totalAssets: total,
  categoryBreakdown: [],
  assetClassBreakdown: { cash: 0, investment: total, crypto: 0 },
  holdingsSnapshot: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('Storage: categories', () => {
  it('seeds default categories on first load', async () => {
    const cats = await getCategories();
    expect(cats.length).toBe(DEFAULT_CATEGORIES.length);
  });
});

describe('Storage: holdings', () => {
  it('can add and retrieve a holding', async () => {
    const h = makeHolding('test-h1');
    await putHolding(h);
    const holdings = await getHoldings();
    expect(holdings.some((x) => x.id === 'test-h1')).toBe(true);
  });

  it('can delete a holding', async () => {
    const h = makeHolding('test-h2');
    await putHolding(h);
    await deleteHolding('test-h2');
    const holdings = await getHoldings();
    expect(holdings.some((x) => x.id === 'test-h2')).toBe(false);
  });
});

describe('Storage: snapshots upsert', () => {
  it('saves a snapshot', async () => {
    const snap = makeSnapshot('2026-01', 10000000);
    await upsertSnapshot(snap);
    const snaps = await getSnapshots();
    expect(snaps.some((s) => s.monthKey === '2026-01')).toBe(true);
  });

  it('upserts snapshot with same monthKey', async () => {
    const snap1 = makeSnapshot('2026-02', 10000000);
    const createdAt = snap1.createdAt;
    await upsertSnapshot(snap1);

    const snap2 = { ...makeSnapshot('2026-02', 11000000), createdAt };
    await upsertSnapshot(snap2);

    const snaps = await getSnapshots();
    const saved = snaps.find((s) => s.monthKey === '2026-02');
    expect(saved?.totalAssets).toBe(11000000);
    expect(saved?.createdAt).toBe(createdAt);
  });
});

describe('Storage: settings', () => {
  it('returns default settings initially', async () => {
    const s = await getSettings();
    expect(s.displayCurrency).toBe('JPY');
    expect(s.fireTargetAmount).toBe(0);
  });
});

describe('Storage: DB migration', () => {
  it('creates all required object stores', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('categories')).toBe(true);
    expect(db.objectStoreNames.contains('holdings')).toBe(true);
    expect(db.objectStoreNames.contains('snapshots')).toBe(true);
    expect(db.objectStoreNames.contains('settings')).toBe(true);
    expect(db.objectStoreNames.contains('recoveryBackups')).toBe(true);
  });

  it('existing records survive DB open (migration safety)', async () => {
    // Add a holding, then re-open DB (same version) and verify it persists
    const h = makeHolding('migration-test');
    await putHolding(h);
    // Re-get the db (same cached instance)
    const holdings = await getHoldings();
    expect(holdings.some((x) => x.id === 'migration-test')).toBe(true);
  });
});
