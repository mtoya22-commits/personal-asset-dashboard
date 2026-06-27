import { openDB, type IDBPDatabase } from 'idb';
import type {
  AssetCategory,
  Holding,
  MonthlySnapshot,
  AppSettings,
  RecoveryBackup,
} from '../types/index.js';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './defaults.js';

const DB_NAME = 'personal-asset-dashboard-v1';
const DB_VERSION = 1;

export type PADSchema = {
  categories: {
    key: string;
    value: AssetCategory;
  };
  holdings: {
    key: string;
    value: Holding;
  };
  snapshots: {
    key: string;
    value: MonthlySnapshot;
    indexes: { monthKey: string };
  };
  settings: {
    key: string;
    value: AppSettings & { id: string };
  };
  recoveryBackups: {
    key: string;
    value: RecoveryBackup;
  };
};

let _db: IDBPDatabase<PADSchema> | null = null;

export async function getDB(): Promise<IDBPDatabase<PADSchema>> {
  if (_db) return _db;
  _db = await openDB<PADSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // v0 → v1: create all stores
      if (oldVersion < 1) {
        db.createObjectStore('categories', { keyPath: 'id' });
        db.createObjectStore('holdings', { keyPath: 'id' });
        const snapshotStore = db.createObjectStore('snapshots', { keyPath: 'id' });
        snapshotStore.createIndex('monthKey', 'monthKey', { unique: true });
        db.createObjectStore('settings', { keyPath: 'id' });
        db.createObjectStore('recoveryBackups', { keyPath: 'id' });
      }
      // future migrations go here: if (oldVersion < 2) { ... }
    },
  });
  return _db;
}

// ────────────────────────────────────────────────────────────────────────────
// Categories
// ────────────────────────────────────────────────────────────────────────────

export async function getCategories(): Promise<AssetCategory[]> {
  const db = await getDB();
  const cats = await db.getAll('categories');
  if (cats.length === 0) {
    // Seed defaults
    const tx = db.transaction('categories', 'readwrite');
    for (const cat of DEFAULT_CATEGORIES) {
      await tx.store.put(cat);
    }
    await tx.done;
    return DEFAULT_CATEGORIES;
  }
  return cats.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function putCategory(cat: AssetCategory): Promise<void> {
  const db = await getDB();
  await db.put('categories', cat);
}

export async function putCategories(cats: AssetCategory[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('categories', 'readwrite');
  await tx.store.clear();
  for (const cat of cats) {
    await tx.store.put(cat);
  }
  await tx.done;
}

// ────────────────────────────────────────────────────────────────────────────
// Holdings
// ────────────────────────────────────────────────────────────────────────────

export async function getHoldings(): Promise<Holding[]> {
  const db = await getDB();
  return db.getAll('holdings');
}

export async function putHolding(holding: Holding): Promise<void> {
  const db = await getDB();
  await db.put('holdings', holding);
  await maybeRequestPersistence();
}

export async function deleteHolding(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('holdings', id);
}

export async function putHoldings(holdings: Holding[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('holdings', 'readwrite');
  await tx.store.clear();
  for (const h of holdings) {
    await tx.store.put(h);
  }
  await tx.done;
}

// ────────────────────────────────────────────────────────────────────────────
// Snapshots
// ────────────────────────────────────────────────────────────────────────────

export async function getSnapshots(): Promise<MonthlySnapshot[]> {
  const db = await getDB();
  const snaps = await db.getAll('snapshots');
  return snaps.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

export async function upsertSnapshot(snapshot: MonthlySnapshot): Promise<void> {
  const db = await getDB();
  const existing = await db.getFromIndex('snapshots', 'monthKey', snapshot.monthKey);
  if (existing) {
    await db.put('snapshots', {
      ...snapshot,
      id: existing.id,
      createdAt: existing.createdAt,
    });
  } else {
    await db.put('snapshots', snapshot);
  }
}

export async function deleteSnapshot(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('snapshots', id);
}

export async function putSnapshots(snapshots: MonthlySnapshot[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('snapshots', 'readwrite');
  await tx.store.clear();
  for (const s of snapshots) {
    await tx.store.put(s);
  }
  await tx.done;
}

// ────────────────────────────────────────────────────────────────────────────
// Settings
// ────────────────────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'app-settings';

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  const record = await db.get('settings', SETTINGS_KEY);
  if (!record) return { ...DEFAULT_SETTINGS };
  const { id: _id, ...settings } = record;
  return settings;
}

export async function putSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('settings', { id: SETTINGS_KEY, ...settings });
}

// ────────────────────────────────────────────────────────────────────────────
// Recovery backups
// ────────────────────────────────────────────────────────────────────────────

const MAX_RECOVERY_BACKUPS = 3;

export async function getRecoveryBackups(): Promise<RecoveryBackup[]> {
  const db = await getDB();
  const backups = await db.getAll('recoveryBackups');
  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveRecoveryBackup(backup: RecoveryBackup): Promise<void> {
  const db = await getDB();
  await db.put('recoveryBackups', backup);
  // Keep only the most recent MAX_RECOVERY_BACKUPS
  const all = await db.getAll('recoveryBackups');
  const sorted = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sorted.length > MAX_RECOVERY_BACKUPS) {
    const tx = db.transaction('recoveryBackups', 'readwrite');
    for (const old of sorted.slice(MAX_RECOVERY_BACKUPS)) {
      await tx.store.delete(old.id);
    }
    await tx.done;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Full replace (import)
// ────────────────────────────────────────────────────────────────────────────

export async function replaceAllData(data: {
  categories: AssetCategory[];
  holdings: Holding[];
  snapshots: MonthlySnapshot[];
  settings: AppSettings;
}): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['categories', 'holdings', 'snapshots', 'settings'], 'readwrite');
  await tx.objectStore('categories').clear();
  for (const c of data.categories) await tx.objectStore('categories').put(c);
  await tx.objectStore('holdings').clear();
  for (const h of data.holdings) await tx.objectStore('holdings').put(h);
  await tx.objectStore('snapshots').clear();
  for (const s of data.snapshots) await tx.objectStore('snapshots').put(s);
  await tx.objectStore('settings').put({ id: SETTINGS_KEY, ...data.settings });
  await tx.done;
}

// ────────────────────────────────────────────────────────────────────────────
// Full delete
// ────────────────────────────────────────────────────────────────────────────

export async function deleteAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['categories', 'holdings', 'snapshots', 'settings', 'recoveryBackups'],
    'readwrite',
  );
  for (const store of ['categories', 'holdings', 'snapshots', 'settings', 'recoveryBackups'] as const) {
    await tx.objectStore(store).clear();
  }
  await tx.done;
}

// ────────────────────────────────────────────────────────────────────────────
// Storage persistence
// ────────────────────────────────────────────────────────────────────────────

let persistenceRequested = false;

async function maybeRequestPersistence(): Promise<void> {
  if (persistenceRequested) return;
  persistenceRequested = true;
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
}
