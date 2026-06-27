export type AssetClass = 'cash' | 'investment' | 'crypto';

export type AccountType =
  | 'NISA'
  | '特定'
  | 'iDeCo'
  | 'DC'
  | '預金'
  | '暗号資産取引所'
  | 'その他';

export type AssetCategory = {
  id: string;
  name: string;
  color: string;
  assetClass: AssetClass;
  sortOrder: number;
  isDefault: boolean;
};

export type Holding = {
  id: string;
  categoryId: string;
  name: string;
  accountType: AccountType;
  marketValue: number;
  costBasis?: number;
  quantity?: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type HoldingSnapshot = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  assetClass: AssetClass;
  accountType: AccountType;
  marketValue: number;
  costBasis?: number;
  quantity?: number;
  memo?: string;
};

export type MonthlySnapshot = {
  id: string;
  monthKey: string;
  snapshotDate: string;
  totalAssets: number;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    assetClass: AssetClass;
    value: number;
  }>;
  assetClassBreakdown: {
    cash: number;
    investment: number;
    crypto: number;
  };
  holdingsSnapshot: HoldingSnapshot[];
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type AppSettings = {
  fireTargetAmount: number;
  displayCurrency: 'JPY';
  maskAmountsOnLaunch: boolean;
  lastBackupExportInitiatedAt?: string;
};

export type RecoveryBackup = {
  id: string;
  createdAt: string;
  reason: 'pre-import';
  data: BackupFile;
};

export type BackupFile = {
  schemaVersion: 1;
  exportedAt: string;
  appName: 'personal-asset-dashboard';
  categories: AssetCategory[];
  holdings: Holding[];
  snapshots: MonthlySnapshot[];
  settings: AppSettings;
};

// v2 candidates - type definitions only, no UI or storage in MVP
export type TargetAllocation = {
  assetClassTargets?: {
    cash?: { min?: number; max?: number; target?: number };
    investment?: { min?: number; max?: number; target?: number };
    crypto?: { min?: number; max?: number; target?: number };
  };
  categoryTargets?: Record<string, { target?: number; max?: number }>;
};

export type ContributionRecord = {
  id: string;
  date: string;
  amount: number;
  accountType: 'NISA' | '特定' | 'iDeCo' | 'DC';
  productName?: string;
  memo?: string;
};

export type TabId = 'dashboard' | 'holdings' | 'monthly-update' | 'allocation' | 'history';
