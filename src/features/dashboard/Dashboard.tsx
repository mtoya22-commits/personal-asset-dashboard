import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { AppData } from '../../hooks/useAppData.js';
import { CheckIcon } from '../../components/icons/index.js';
import {
  calcTotalAssets,
  calcCategoryBreakdown,
  calcAssetClassBreakdown,
  calcPrevSnapshotComparison,
  calcYearComparison,
  calcFireProgress,
  calcTopHoldings,
  calcNisaValue,
  calcNisaRatio,
  calcUnrealizedGains,
  hasHoldingsChangedSinceSnapshot,
} from '../../lib/calculations/index.js';
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatDiff,
  formatDiffPercent,
  getMonthKeyJST,
  getTodayJST,
} from '../../lib/formatters/index.js';
import { ja } from '../../strings/ja.js';

type DashboardProps = {
  data: AppData;
  masked: boolean;
  onGoToSettings: () => void;
  onGoToMonthlyUpdate: () => void;
};

export function Dashboard({ data, masked, onGoToSettings, onGoToMonthlyUpdate }: DashboardProps) {
  const { categories, holdings, snapshots, settings } = data;
  const currentMonthKey = getMonthKeyJST();
  const jst = getTodayJST();
  const currentYear = jst.getFullYear();
  const currentMonth = jst.getMonth() + 1;

  const total = useMemo(() => calcTotalAssets(holdings), [holdings]);
  const categoryBreakdown = useMemo(
    () => calcCategoryBreakdown(holdings, categories),
    [holdings, categories],
  );
  const assetClass = useMemo(
    () => calcAssetClassBreakdown(holdings, categories),
    [holdings, categories],
  );
  const prevComparison = useMemo(
    () => calcPrevSnapshotComparison(total, snapshots, currentMonthKey),
    [total, snapshots, currentMonthKey],
  );
  const yearComparison = useMemo(
    () => calcYearComparison(total, snapshots, currentYear),
    [total, snapshots, currentYear],
  );
  const fire = useMemo(() => calcFireProgress(total, settings), [total, settings]);
  const topHoldings = useMemo(
    () => calcTopHoldings(holdings, categories, 5),
    [holdings, categories],
  );
  const nisaValue = useMemo(() => calcNisaValue(holdings), [holdings]);
  const nisaRatio = useMemo(
    () => calcNisaRatio(nisaValue, assetClass.investment),
    [nisaValue, assetClass.investment],
  );
  const unrealizedGains = useMemo(
    () => calcUnrealizedGains(holdings, categories),
    [holdings, categories],
  );

  const currentMonthSnapshot = useMemo(
    () => snapshots.find((s) => s.monthKey === currentMonthKey),
    [snapshots, currentMonthKey],
  );

  const snapshotChangedSince = useMemo(() => {
    if (!currentMonthSnapshot) return false;
    return hasHoldingsChangedSinceSnapshot(holdings, currentMonthSnapshot);
  }, [holdings, currentMonthSnapshot]);

  const lastHoldingUpdate = useMemo(() => {
    if (holdings.length === 0) return null;
    return holdings.reduce((latest, h) =>
      h.updatedAt > latest.updatedAt ? h : latest,
    );
  }, [holdings]);

  const lastBackupDays = useMemo(() => {
    const ts = settings.lastBackupExportInitiatedAt;
    if (!ts) return null;
    const diff = Date.now() - new Date(ts).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [settings.lastBackupExportInitiatedAt]);

  // Checklist
  const holdingsUpdatedThisMonth = useMemo(() => {
    if (holdings.length === 0) return false;
    const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    return holdings.some((h) => h.updatedAt.startsWith(monthStr));
  }, [holdings, currentYear, currentMonth]);

  const snapshotSavedThisMonth = !!currentMonthSnapshot;
  const backupDoneThisMonth = useMemo(() => {
    if (!settings.lastBackupExportInitiatedAt) return false;
    const d = new Date(settings.lastBackupExportInitiatedAt);
    const jstMonth = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    return (
      jstMonth.getFullYear() === currentYear && jstMonth.getMonth() + 1 === currentMonth
    );
  }, [settings.lastBackupExportInitiatedAt, currentYear, currentMonth]);

  // Chart data
  const pieData = useMemo(
    () =>
      categoryBreakdown
        .filter((c) => c.value > 0)
        .map((c) => {
          const cat = categories.find((cat) => cat.id === c.categoryId);
          return { name: c.categoryName, value: c.value, color: cat?.color ?? '#888' };
        }),
    [categoryBreakdown, categories],
  );

  const diffClass = (val: number) =>
    val > 0 ? 'diff-positive' : val < 0 ? 'diff-negative' : 'diff-neutral';

  return (
    <div className="screen">
      {/* Main total */}
      <div className="card">
        <div className="card-title">{ja.dashboard.currentAssets}</div>
        <div className="amount-large" style={{ marginBottom: 4 }}>
          {formatCurrency(total, masked)}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)' }}>
          {ja.dashboard.currentValue} — {ja.dashboard.assetNote}
        </div>

        {lastHoldingUpdate && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', marginTop: 6 }}>
            {ja.dashboard.lastUpdated}: {formatDate(lastHoldingUpdate.updatedAt)}
          </div>
        )}

        {/* Changed since snapshot notice */}
        {snapshotChangedSince && (
          <div className="notice notice-info" style={{ marginTop: 12 }}>
            <div>{ja.dashboard.snapshotChanged}</div>
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: 8 }}
              onClick={onGoToMonthlyUpdate}
            >
              {ja.dashboard.updateSnapshot}
            </button>
          </div>
        )}
      </div>

      {/* Comparisons */}
      {prevComparison && (
        <div className="card">
          <div className="card-title">{ja.dashboard.prevMonthComparison}</div>
          <div className={`amount-medium ${diffClass(prevComparison.diff)}`}>
            {formatDiff(prevComparison.diff, masked)}
            <span style={{ marginLeft: 8, fontSize: '0.9rem' }}>
              ({formatDiffPercent(prevComparison.diffPercent ?? 0)})
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', marginTop: 4 }}>
            {ja.dashboard.comparisonBase}: {formatDate(prevComparison.baseDate)}
            {' '}({formatCurrency(prevComparison.baseTotal, masked)})
          </div>
        </div>
      )}

      {yearComparison && (
        <div className="card">
          <div className="card-title">
            {yearComparison.label === 'yearStart'
              ? ja.dashboard.yearStartComparison
              : ja.dashboard.yearFirstComparison}
          </div>
          <div className={`amount-medium ${diffClass(yearComparison.diff)}`}>
            {formatDiff(yearComparison.diff, masked)}
            <span style={{ marginLeft: 8, fontSize: '0.9rem' }}>
              ({formatDiffPercent(yearComparison.diffPercent ?? 0)})
            </span>
          </div>
          {yearComparison.label === 'yearFirst' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', marginTop: 4 }}>
              {ja.dashboard.comparisonBase}: {formatDate(yearComparison.baseDate)}
            </div>
          )}
        </div>
      )}

      {/* FIRE progress */}
      <div className="card">
        <div className="card-title">{ja.dashboard.fireProgress}</div>
        {fire.isGoalSet ? (
          <>
            <div className="row-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-2)' }}>
                {ja.dashboard.fireTarget}: {formatCurrency(fire.targetAmount, masked)}
              </span>
              <span className="amount-small">
                {formatPercent(fire.reached * 100)}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(fire.reached * 100, 100)}%` }}
                role="progressbar"
                aria-valuenow={Math.round(fire.reached * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-2)', marginTop: 6 }}>
              {ja.dashboard.fireRemaining}: {formatCurrency(fire.remaining, masked)}
            </div>
          </>
        ) : (
          <div>
            <div style={{ color: 'var(--color-text-3)', fontSize: '0.88rem', marginBottom: 8 }}>
              FIRE目標が設定されていません
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onGoToSettings}>
              {ja.dashboard.setFireTarget}
            </button>
          </div>
        )}
      </div>

      {/* Asset class breakdown */}
      <div className="card">
        <div className="card-title">{ja.dashboard.assetClassBreakdown}</div>
        {[
          { label: ja.assetClass.cash, value: assetClass.cash, ratio: total > 0 ? assetClass.cash / total : 0 },
          { label: ja.assetClass.investment, value: assetClass.investment, ratio: total > 0 ? assetClass.investment / total : 0 },
          { label: ja.assetClass.crypto, value: assetClass.crypto, ratio: total > 0 ? assetClass.crypto / total : 0 },
        ].map(({ label, value, ratio }) => (
          <div key={label} className="row-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--color-surface-2)' }}>
            <span style={{ fontSize: '0.88rem' }}>{label}</span>
            <span style={{ textAlign: 'right' }}>
              <span className="amount-small">{formatCurrency(value, masked)}</span>
              <span style={{ marginLeft: 8, color: 'var(--color-text-3)', fontSize: '0.82rem' }}>
                {formatPercent(ratio * 100)}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* NISA */}
      {assetClass.investment > 0 && (
        <div className="card">
          <div className="card-title">{ja.dashboard.nisaValue}</div>
          <div className="amount-medium">{formatCurrency(nisaValue, masked)}</div>
          {nisaRatio !== null && (
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-2)', marginTop: 4 }}>
              {ja.dashboard.nisaRatio}: {formatPercent(nisaRatio * 100)}
            </div>
          )}
        </div>
      )}

      {/* Unrealized gains */}
      {unrealizedGains.entries.length > 0 && (
        <div className="card">
          <div className="card-title">{ja.unrealizedGains.label}</div>
          <div
            className={`amount-medium ${diffClass(unrealizedGains.totalGain)}`}
          >
            {formatDiff(unrealizedGains.totalGain, masked)}
            {unrealizedGains.totalGainPercent !== null && (
              <span style={{ marginLeft: 8, fontSize: '0.9rem' }}>
                ({formatDiffPercent(unrealizedGains.totalGainPercent)})
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', marginTop: 4 }}>
            {ja.unrealizedGains.scope}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)' }}>
            {ja.unrealizedGains.targetValue}: {formatCurrency(unrealizedGains.targetMarketValue, masked)}
            {' / '}
            {ja.unrealizedGains.investmentTotal}: {formatCurrency(unrealizedGains.investmentCryptoTotal, masked)}
          </div>
        </div>
      )}

      {/* Category chart */}
      {pieData.length > 0 && (
        <div className="card">
          <div className="card-title">{ja.dashboard.categoryChart}</div>
          {!masked && (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <table className="data-table" aria-label={ja.dashboard.categoryChart}>
            <thead>
              <tr>
                <th>カテゴリ</th>
                <th>評価額</th>
                <th>比率</th>
              </tr>
            </thead>
            <tbody>
              {categoryBreakdown
                .sort((a, b) => b.value - a.value)
                .map((c) => {
                  const cat = categories.find((x) => x.id === c.categoryId);
                  return (
                    <tr key={c.categoryId}>
                      <td>
                        <span
                          className="color-dot"
                          style={{ background: cat?.color, marginRight: 6 }}
                        />
                        {c.categoryName}
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(c.value, masked)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {formatPercent(total > 0 ? (c.value / total) * 100 : 0)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Top 5 holdings */}
      {topHoldings.length > 0 && (
        <div className="card">
          <div className="card-title">{ja.dashboard.topHoldings}</div>
          <table className="data-table" aria-label={ja.dashboard.topHoldings}>
            <thead>
              <tr>
                <th>資産名</th>
                <th>評価額</th>
                <th>比率</th>
              </tr>
            </thead>
            <tbody>
              {topHoldings.map(({ holding, categoryName, ratio }) => (
                <tr key={holding.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{holding.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-3)' }}>{categoryName}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(holding.marketValue, masked)}</td>
                  <td style={{ textAlign: 'right' }}>{formatPercent(ratio * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Monthly checklist */}
      <div className="card">
        <div className="card-title">{ja.dashboard.monthlyChecklist}</div>
        {[
          { label: ja.dashboard.checkHoldings, done: holdingsUpdatedThisMonth },
          { label: ja.dashboard.checkSnapshot, done: snapshotSavedThisMonth },
          { label: ja.dashboard.checkBackup, done: backupDoneThisMonth },
        ].map(({ label, done }) => (
          <div key={label} className="checklist-item">
            <div className={`check-icon ${done ? 'done' : 'pending'}`}>
              {done && <CheckIcon size={12} />}
            </div>
            <span style={{ fontSize: '0.88rem', color: done ? 'var(--color-text)' : 'var(--color-text-2)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Backup status */}
      <div className="card">
        <div className="card-title">{ja.dashboard.lastBackup}</div>
        {settings.lastBackupExportInitiatedAt ? (
          <>
            <div style={{ fontSize: '0.88rem', marginBottom: 4 }}>
              {formatDate(settings.lastBackupExportInitiatedAt)}
              {lastBackupDays !== null && (
                <span style={{ color: 'var(--color-text-3)', marginLeft: 8 }}>
                  ({lastBackupDays === 0 ? ja.backup.today : `${lastBackupDays}${ja.backup.daysSince}`})
                </span>
              )}
            </div>
            {lastBackupDays !== null && lastBackupDays > 90 && (
              <div className="notice notice-warn" style={{ marginTop: 6 }}>
                {ja.backup.remind90}
              </div>
            )}
            {lastBackupDays !== null && lastBackupDays > 30 && lastBackupDays <= 90 && (
              <div className="notice notice-info" style={{ marginTop: 6 }}>
                {ja.backup.remind30}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--color-text-3)', fontSize: '0.88rem' }}>未実施</div>
        )}
        <div className="card-title" style={{ marginTop: 10 }}>
          {ja.dashboard.snapshotStatus}
        </div>
        <div style={{ fontSize: '0.88rem' }}>
          {currentMonthSnapshot
            ? `${ja.dashboard.saved}: ${formatDate(currentMonthSnapshot.snapshotDate)}`
            : ja.dashboard.notSaved}
        </div>
      </div>
    </div>
  );
}
