import type { AssetCategory, AppSettings } from '../types/index.js';

export const DEFAULT_CATEGORIES: AssetCategory[] = [
  { id: 'cat-mainstream', name: '王道', color: '#4A7C9B', assetClass: 'investment', sortOrder: 0, isDefault: true },
  { id: 'cat-emerging', name: '新興', color: '#6B8E7A', assetClass: 'investment', sortOrder: 1, isDefault: true },
  { id: 'cat-highyield', name: '高配当', color: '#7A8E6B', assetClass: 'investment', sortOrder: 2, isDefault: true },
  { id: 'cat-commodity', name: 'コモディティ', color: '#8E7A6B', assetClass: 'investment', sortOrder: 3, isDefault: true },
  { id: 'cat-growth-individual', name: 'グロース個別', color: '#7B6B8E', assetClass: 'investment', sortOrder: 4, isDefault: true },
  { id: 'cat-highyield-individual', name: '高配当個別', color: '#6B7B8E', assetClass: 'investment', sortOrder: 5, isDefault: true },
  { id: 'cat-reit', name: 'REIT', color: '#8E8B6B', assetClass: 'investment', sortOrder: 6, isDefault: true },
  { id: 'cat-balanced', name: 'バランス', color: '#7A8080', assetClass: 'investment', sortOrder: 7, isDefault: true },
  { id: 'cat-bond', name: '債券', color: '#80907A', assetClass: 'investment', sortOrder: 8, isDefault: true },
  { id: 'cat-crypto', name: '暗号資産', color: '#9E8060', assetClass: 'crypto', sortOrder: 9, isDefault: true },
  { id: 'cat-cash', name: '現金', color: '#9E9E8A', assetClass: 'cash', sortOrder: 10, isDefault: true },
];

export const DEFAULT_SETTINGS: AppSettings = {
  fireTargetAmount: 0,
  displayCurrency: 'JPY',
  maskAmountsOnLaunch: false,
};
