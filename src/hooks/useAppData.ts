import { useState, useEffect, useCallback } from 'react';
import type { Holding, AssetCategory, MonthlySnapshot, AppSettings } from '../types/index.js';
import {
  getCategories,
  getHoldings,
  getSnapshots,
  getSettings,
  putHolding,
  deleteHolding,
  putCategories,
  upsertSnapshot,
  deleteSnapshot,
  putSettings,
  replaceAllData,
  deleteAllData,
} from '../storage/index.js';
import { DEFAULT_SETTINGS } from '../storage/defaults.js';

export type AppData = {
  categories: AssetCategory[];
  holdings: Holding[];
  snapshots: MonthlySnapshot[];
  settings: AppSettings;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  saveHolding: (h: Holding) => Promise<void>;
  removeHolding: (id: string) => Promise<void>;
  saveCategories: (cats: AssetCategory[]) => Promise<void>;
  saveSnapshot: (s: MonthlySnapshot) => Promise<void>;
  removeSnapshot: (id: string) => Promise<void>;
  saveSettings: (s: AppSettings) => Promise<void>;
  importData: (data: {
    categories: AssetCategory[];
    holdings: Holding[];
    snapshots: MonthlySnapshot[];
    settings: AppSettings;
  }) => Promise<void>;
  clearAllData: () => Promise<void>;
};

export function useAppData(): AppData {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const [cats, holds, snaps, setts] = await Promise.all([
        getCategories(),
        getHoldings(),
        getSnapshots(),
        getSettings(),
      ]);
      setCategories(cats);
      setHoldings(holds);
      setSnapshots(snaps);
      setSettings(setts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveHolding = useCallback(
    async (h: Holding) => {
      await putHolding(h);
      setHoldings((prev) => {
        const idx = prev.findIndex((x) => x.id === h.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = h;
          return next;
        }
        return [...prev, h];
      });
    },
    [],
  );

  const removeHolding = useCallback(async (id: string) => {
    await deleteHolding(id);
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const saveCategories = useCallback(async (cats: AssetCategory[]) => {
    await putCategories(cats);
    setCategories([...cats].sort((a, b) => a.sortOrder - b.sortOrder));
  }, []);

  const saveSnapshot = useCallback(async (s: MonthlySnapshot) => {
    await upsertSnapshot(s);
    const updated = await getSnapshots();
    setSnapshots(updated);
  }, []);

  const removeSnapshot = useCallback(async (id: string) => {
    await deleteSnapshot(id);
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const saveSettings = useCallback(async (s: AppSettings) => {
    await putSettings(s);
    setSettings(s);
  }, []);

  const importData = useCallback(
    async (data: {
      categories: AssetCategory[];
      holdings: Holding[];
      snapshots: MonthlySnapshot[];
      settings: AppSettings;
    }) => {
      await replaceAllData(data);
      setCategories([...data.categories].sort((a, b) => a.sortOrder - b.sortOrder));
      setHoldings(data.holdings);
      setSnapshots([...data.snapshots].sort((a, b) => b.monthKey.localeCompare(a.monthKey)));
      setSettings(data.settings);
    },
    [],
  );

  const clearAllData = useCallback(async () => {
    await deleteAllData();
    const [cats] = await Promise.all([getCategories()]);
    setCategories(cats);
    setHoldings([]);
    setSnapshots([]);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    categories,
    holdings,
    snapshots,
    settings,
    loading,
    error,
    reload,
    saveHolding,
    removeHolding,
    saveCategories,
    saveSnapshot,
    removeSnapshot,
    saveSettings,
    importData,
    clearAllData,
  };
}
