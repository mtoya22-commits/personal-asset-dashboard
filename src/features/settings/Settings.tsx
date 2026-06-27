import { useState, useRef, useMemo } from 'react';
import type { AppData } from '../../hooks/useAppData.js';
import type { AssetCategory, AppSettings, BackupFile, RecoveryBackup } from '../../types/index.js';
import { useDirtyFlag } from '../../hooks/useUnsavedChanges.js';
import { DownloadIcon, UploadIcon, TrashIcon } from '../../components/icons/index.js';
import { validateBackupFile, asTypedBackupFile } from '../../lib/validators/index.js';
import {
  buildMonthlySummaryCsv,
  buildCategoryHistoryCsv,
  downloadCsvFile,
} from '../../lib/csv/index.js';
import {
  formatCurrency,
  formatDate,
  getFileDateSuffix,
  getISONow,
} from '../../lib/formatters/index.js';
import { getRecoveryBackups, saveRecoveryBackup } from '../../storage/index.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import { Dialog } from '../../components/Dialog.js';
import { ja } from '../../strings/ja.js';

type SettingsProps = {
  data: AppData;
  masked: boolean;
};

export function Settings({ data, masked }: SettingsProps) {
  const { categories, holdings, snapshots, settings, saveSettings, saveCategories, importData, clearAllData } = data;

  const [fireTarget, setFireTarget] = useState(String(settings.fireTargetAmount || ''));
  const [maskOnLaunch, setMaskOnLaunch] = useState(settings.maskAmountsOnLaunch);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('');
  const [catSortOrder, setCatSortOrder] = useState(0);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<BackupFile | null>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [recoveryBackups, setRecoveryBackups] = useState<RecoveryBackup[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<RecoveryBackup | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const [csvSuccess, setCsvSuccess] = useState('');

  // ──────────────────────────────── Settings save
  const handleSaveSettings = async () => {
    const amount = Number(fireTarget.replace(/[,\s]/g, '')) || 0;
    const next: AppSettings = {
      ...settings,
      fireTargetAmount: isFinite(amount) && amount >= 0 ? Math.floor(amount) : 0,
      maskAmountsOnLaunch: maskOnLaunch,
    };
    await saveSettings(next);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  // ──────────────────────────────── Category editing
  const handleOpenCatEdit = (cat: AssetCategory) => {
    setEditCategoryId(cat.id);
    setCatName(cat.name);
    setCatColor(cat.color);
    setCatSortOrder(cat.sortOrder);
  };

  const handleSaveCategory = async () => {
    if (!editCategoryId) return;
    const updatedCats = categories.map((c) =>
      c.id === editCategoryId
        ? { ...c, name: catName.trim() || c.name, color: catColor, sortOrder: catSortOrder }
        : c,
    );
    await saveCategories(updatedCats);
    setEditCategoryId(null);
  };

  // ──────────────────────────────── JSON Export
  const handleExport = async () => {
    const backup: BackupFile = {
      schemaVersion: 1,
      exportedAt: getISONow(),
      appName: 'personal-asset-dashboard',
      categories,
      holdings,
      snapshots,
      settings,
    };
    const json = JSON.stringify(backup, null, 2);
    const filename = `asset-backup-${getFileDateSuffix()}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });

    let exported = false;

    // 1. Web Share API
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        exported = true;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          return; // user cancelled
        }
        // fall through
      }
    }

    // 2. Download
    if (!exported) {
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        exported = true;
      } catch {
        // fall through
      }
    }

    // Update backup timestamp only on successful export
    if (exported) {
      const now = getISONow();
      await saveSettings({ ...settings, lastBackupExportInitiatedAt: now });
    }
  };

  // ──────────────────────────────── JSON Import
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const result = validateBackupFile(raw);
      if (!result.ok) {
        setImportError(result.error);
        setImportFile(null);
        return;
      }
      setImportFile(asTypedBackupFile(raw));
      setImportOpen(true);
    } catch {
      setImportError('JSONの解析に失敗しました');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportConfirm = async () => {
    if (!importFile) return;
    // Save recovery backup
    const currentData: BackupFile = {
      schemaVersion: 1,
      exportedAt: getISONow(),
      appName: 'personal-asset-dashboard',
      categories,
      holdings,
      snapshots,
      settings,
    };
    const recovery: RecoveryBackup = {
      id: crypto.randomUUID(),
      createdAt: getISONow(),
      reason: 'pre-import',
      data: currentData,
    };
    await saveRecoveryBackup(recovery);
    try {
      await importData({
        categories: importFile.categories,
        holdings: importFile.holdings,
        snapshots: importFile.snapshots,
        settings: importFile.settings,
      });
      setImportOpen(false);
      setImportFile(null);
      setImportSuccess(ja.import.success);
      setTimeout(() => setImportSuccess(''), 3000);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : ja.import.error);
    }
  };

  // ──────────────────────────────── CSV Export
  const handleCsvExport = () => {
    if (snapshots.length === 0) {
      setCsvSuccess('エクスポートできる月次記録がありません');
      setTimeout(() => setCsvSuccess(''), 3000);
      return;
    }
    const suffix = getFileDateSuffix();
    downloadCsvFile(buildMonthlySummaryCsv(snapshots), `asset-monthly-summary-${suffix}.csv`);
    downloadCsvFile(buildCategoryHistoryCsv(snapshots), `asset-category-history-${suffix}.csv`);
    setCsvSuccess('CSVをダウンロードしました');
    setTimeout(() => setCsvSuccess(''), 3000);
  };

  // ──────────────────────────────── Restore
  const handleOpenRestore = async () => {
    const backups = await getRecoveryBackups();
    setRecoveryBackups(backups);
    setRestoreOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (!restoreTarget) return;
    await importData({
      categories: restoreTarget.data.categories,
      holdings: restoreTarget.data.holdings,
      snapshots: restoreTarget.data.snapshots,
      settings: restoreTarget.data.settings,
    });
    setRestoreConfirmOpen(false);
    setRestoreOpen(false);
    setRestoreTarget(null);
  };

  // ──────────────────────────────── Delete all
  const handleDeleteAll = async () => {
    if (deleteInput !== '削除') return;
    await clearAllData();
    // Clear localStorage pad: keys
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('pad:')) localStorage.removeItem(key);
    }
    setDeleteOpen(false);
    setDeleteInput('');
  };

  const settingsChanged = useMemo(
    () =>
      fireTarget !== String(settings.fireTargetAmount || '') ||
      maskOnLaunch !== settings.maskAmountsOnLaunch,
    [fireTarget, settings.fireTargetAmount, maskOnLaunch, settings.maskAmountsOnLaunch],
  );
  useDirtyFlag('settings', settingsChanged || !!editCategoryId);

  const lastBackupDays = settings.lastBackupExportInitiatedAt
    ? Math.floor((Date.now() - new Date(settings.lastBackupExportInitiatedAt).getTime()) / (86400000))
    : null;

  return (
    <div>
      {/* Settings */}
      <h2 className="section-title" style={{ marginBottom: 12 }}>{ja.history.settingsTitle}</h2>

      {/* FIRE target */}
      <div className="card">
        <div className="card-title">{ja.settings.fireTarget}</div>
        <div className="form-group">
          <label className="form-label" htmlFor="fire-target">目標金額（円）</label>
          <input
            id="fire-target"
            className="form-input"
            inputMode="numeric"
            value={fireTarget}
            onChange={(e) => setFireTarget(e.target.value)}
            placeholder={ja.settings.fireTargetPlaceholder}
          />
        </div>
        <label className="row" style={{ gap: 8, alignItems: 'center', cursor: 'pointer', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={maskOnLaunch}
            onChange={(e) => setMaskOnLaunch(e.target.checked)}
            aria-label={ja.settings.maskOnLaunch}
          />
          <span style={{ fontSize: '0.88rem' }}>{ja.settings.maskOnLaunch}</span>
        </label>
        <div className="form-hint">{ja.settings.maskNote}</div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={handleSaveSettings}>
          {settingsSaved ? '保存しました ✓' : ja.settings.save}
        </button>
      </div>

      {/* Category settings */}
      <div className="card">
        <div className="card-title">{ja.settings.categorySettings}</div>
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="row-between"
            style={{ padding: '8px 0', borderBottom: '1px solid var(--color-surface-2)' }}
          >
            <div className="row" style={{ gap: 8 }}>
              <span className="color-dot" style={{ background: cat.color, width: 16, height: 16 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{cat.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-3)' }}>
                  {cat.assetClass === 'cash' ? '現金' : cat.assetClass === 'crypto' ? '暗号資産' : '投資'}
                </div>
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handleOpenCatEdit(cat)}
              aria-label={`${cat.name}を編集`}
            >
              編集
            </button>
          </div>
        ))}
      </div>

      {/* Backup */}
      <div className="card">
        <div className="card-title">{ja.settings.backupStatus}</div>
        <div style={{ fontSize: '0.85rem', marginBottom: 8 }}>
          {settings.lastBackupExportInitiatedAt
            ? `${formatDate(settings.lastBackupExportInitiatedAt)}（${lastBackupDays === 0 ? '本日' : `${lastBackupDays}日前`}）`
            : '未実施'}
        </div>
        {lastBackupDays !== null && lastBackupDays > 90 && (
          <div className="notice notice-warn" style={{ marginBottom: 8 }}>{ja.backup.remind90}</div>
        )}
        {lastBackupDays !== null && lastBackupDays > 30 && lastBackupDays <= 90 && (
          <div className="notice notice-info" style={{ marginBottom: 8 }}>{ja.backup.remind30}</div>
        )}
        <div className="form-hint" style={{ marginBottom: 12 }}>{ja.settings.backupNote}</div>
        <button className="btn btn-primary btn-sm" onClick={handleExport} aria-label={ja.settings.exportJson}>
          <DownloadIcon size={15} />
          {ja.settings.exportJson}
        </button>
      </div>

      {/* Import */}
      <div className="card">
        <div className="card-title">JSONインポート</div>
        {importError && <div className="notice notice-error" style={{ marginBottom: 8 }}>{importError}</div>}
        {importSuccess && <div className="notice notice-info" style={{ marginBottom: 8 }}>{importSuccess}</div>}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          aria-label={ja.import.selectFile}
        />
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fileInputRef.current?.click()}
          aria-label={ja.settings.importJson}
        >
          <UploadIcon size={15} />
          {ja.settings.importJson}
        </button>
        <div className="form-hint" style={{ marginTop: 8 }}>
          インポートすると現在のデータがすべて置き換わります。
        </div>
      </div>

      {/* CSV Export */}
      <div className="card">
        <div className="card-title">CSVエクスポート</div>
        {csvSuccess && <div className="notice notice-info" style={{ marginBottom: 8 }}>{csvSuccess}</div>}
        <button className="btn btn-secondary btn-sm" onClick={handleCsvExport} aria-label={ja.settings.exportCsv}>
          <DownloadIcon size={15} />
          {ja.settings.exportCsv}
        </button>
        <div className="form-hint" style={{ marginTop: 8 }}>
          月次サマリーとカテゴリ履歴をUTF-8 BOM付きCSVで出力します
        </div>
      </div>

      {/* Restore */}
      <div className="card">
        <div className="card-title">{ja.settings.restorePoint}</div>
        <button className="btn btn-secondary btn-sm" onClick={handleOpenRestore} aria-label={ja.settings.restorePoint}>
          復元ポイントを確認
        </button>
        <div className="form-hint" style={{ marginTop: 8 }}>
          インポート直前に自動保存された状態に戻せます（最大3件）
        </div>
      </div>

      {/* Privacy */}
      <div className="card">
        <div className="card-title">{ja.settings.privacyTitle}</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-2)', lineHeight: 1.6 }}>
          {ja.settings.privacyNote}
        </p>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-2)', lineHeight: 1.6, marginTop: 8 }}>
          {ja.settings.securityNote}
        </p>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-2)', lineHeight: 1.6, marginTop: 8 }}>
          {ja.settings.noSync}
        </p>
      </div>

      {/* Delete all */}
      <div className="card" style={{ border: '1px solid var(--color-down)' }}>
        <div className="card-title" style={{ color: 'var(--color-down)' }}>{ja.deleteAll.title}</div>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-text-2)', marginBottom: 8 }}>
          {ja.deleteAll.warning}
        </p>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => { setDeleteOpen(true); setDeleteInput(''); }}
          aria-label={ja.deleteAll.title}
        >
          <TrashIcon size={15} />
          {ja.deleteAll.title}
        </button>
      </div>

      {/* Category edit dialog */}
      <Dialog
        open={!!editCategoryId}
        onClose={() => setEditCategoryId(null)}
        title={`カテゴリを編集: ${categories.find((c) => c.id === editCategoryId)?.name ?? ''}`}
        center
      >
        <div className="form-group">
          <label className="form-label" htmlFor="cat-name">{ja.settings.categoryName}</label>
          <input
            id="cat-name"
            className="form-input"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            maxLength={30}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cat-color">{ja.settings.categoryColor}</label>
          <div className="row" style={{ gap: 8 }}>
            <input
              id="cat-color"
              type="color"
              value={catColor}
              onChange={(e) => setCatColor(e.target.value)}
              style={{ width: 50, height: 40, border: 'none', cursor: 'pointer', borderRadius: 6 }}
              aria-label="色を選択"
            />
            <input
              className="form-input"
              value={catColor}
              onChange={(e) => setCatColor(e.target.value)}
              maxLength={7}
              aria-label="HEXカラーコード"
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cat-order">{ja.settings.categorySortOrder}</label>
          <input
            id="cat-order"
            type="number"
            className="form-input"
            value={catSortOrder}
            onChange={(e) => setCatSortOrder(Number(e.target.value))}
          />
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-3)', marginBottom: 12 }}>
          大分類: {categories.find((c) => c.id === editCategoryId)?.assetClass === 'cash' ? '現金' : categories.find((c) => c.id === editCategoryId)?.assetClass === 'crypto' ? '暗号資産' : '投資'}（変更不可）
        </div>
        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={handleSaveCategory}>{ja.common.save}</button>
          <button className="btn btn-secondary" onClick={() => setEditCategoryId(null)}>{ja.common.cancel}</button>
        </div>
      </Dialog>

      {/* Import confirm dialog */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} title={ja.import.title}>
        {importFile && (
          <>
            <div className="notice notice-warn" style={{ marginBottom: 12 }}>
              {ja.import.warning}
            </div>
            <div style={{ marginBottom: 12, fontSize: '0.88rem' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>取込予定</div>
              <div>{ja.import.categories}: {importFile.categories.length}件</div>
              <div>{ja.import.holdings}: {importFile.holdings.length}件</div>
              <div>{ja.import.snapshots}: {importFile.snapshots.length}件</div>
            </div>
            <div className="notice notice-info" style={{ marginBottom: 12 }}>
              {ja.import.recoveryNote}
            </div>
          </>
        )}
        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={handleImportConfirm}>
            {ja.import.confirmButton}
          </button>
          <button className="btn btn-secondary" onClick={() => setImportOpen(false)}>
            {ja.import.cancelButton}
          </button>
        </div>
      </Dialog>

      {/* Restore dialog */}
      <Dialog open={restoreOpen} onClose={() => setRestoreOpen(false)} title={ja.restore.title}>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-2)', marginBottom: 12 }}>
          {ja.restore.description}
        </p>
        {recoveryBackups.length === 0 ? (
          <div style={{ color: 'var(--color-text-3)', fontSize: '0.88rem' }}>{ja.restore.noPoints}</div>
        ) : (
          recoveryBackups.map((rb) => (
            <div key={rb.id} className="card" style={{ marginBottom: 8 }}>
              <div className="row-between">
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{formatDate(rb.createdAt)}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)' }}>
                    資産 {formatCurrency(rb.data.settings?.fireTargetAmount ?? 0, masked)} / 保有資産 {rb.data.holdings.length}件
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setRestoreTarget(rb); setRestoreConfirmOpen(true); }}
                  aria-label={`${formatDate(rb.createdAt)}の状態に復元`}
                >
                  復元
                </button>
              </div>
            </div>
          ))
        )}
        <button className="btn btn-secondary btn-block" style={{ marginTop: 8 }} onClick={() => setRestoreOpen(false)}>
          閉じる
        </button>
      </Dialog>

      <ConfirmDialog
        open={restoreConfirmOpen}
        title={ja.restore.title}
        message={ja.restore.warning}
        confirmLabel={ja.restore.confirmButton}
        cancelLabel={ja.restore.cancelButton}
        onConfirm={handleRestoreConfirm}
        onCancel={() => setRestoreConfirmOpen(false)}
      />

      {/* Delete all dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title={ja.deleteAll.title} center>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-2)', marginBottom: 8 }}>
          {ja.deleteAll.target}
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-down)', marginBottom: 12 }}>
          {ja.deleteAll.warning}
        </p>
        <div className="form-group">
          <label className="form-label" htmlFor="delete-confirm">
            {ja.deleteAll.inputLabel}
          </label>
          <input
            id="delete-confirm"
            className="form-input"
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder={ja.deleteAll.inputPlaceholder}
            autoComplete="off"
          />
        </div>
        <div className="dialog-actions">
          <button
            className="btn btn-danger"
            disabled={deleteInput !== '削除'}
            onClick={handleDeleteAll}
            aria-label={ja.deleteAll.confirmButton}
          >
            {ja.deleteAll.confirmButton}
          </button>
          <button className="btn btn-secondary" onClick={() => setDeleteOpen(false)}>
            {ja.deleteAll.cancelButton}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
