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
  getJstMonthFromIso,
} from '../../lib/formatters/index.js';
import { ja } from '../../strings/ja.js';

type DashboardProps = {
  data: AppData;
  masked: boolean;
  onGoToSettings: () => void;
  onGoToMonthlyUpdate: () => void;
};

const MaskedTooltip = ({
  active,
  payload,
  masked,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  masked: boolean;
}) => {
  if (!active || !payload?.length || masked) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{payload[0].name}</div>
      <div className="chart-tooltip-value">{formatCurrency(payload[0].value ?? 0, false)}</div>
    </div>
  );
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
  const nisaValue = useMemo(() => calcNisaValue(holdings, categories), [holdings, categories]);
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
    return holdings.some((h) => getJstMonthFromIso(h.updatedAt) === currentMonthKey);
  }, [holdings, currentMonthKey]);

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
      {/* Hero */}
      <div className="card" style={{ paddingBottom: 18 }}>
        <div className="card-title">{ja.dashboard.currentAssets}</div>
        <div className="hero-amount" style={{ marginBottom: 10 }}>
          {formatCurrency(total, masked)}
        </div>

        {prevComparison && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>{ja.dashboard.prevMonthComparison}</span>
            <span className={`amount-small ${diffClass(prevComparison.diff)}`}>
              {formatDiff(prevComparison.diff, masked)}
            </span>
            <span style={{ fontSize: '0.82rem', color: diffClass(prevComparison.diff) === 'diff-positive' ? 'var(--positive)' : diffClass(prevComparison.diff) === 'diff-negative' ? 'var(--negative)' : 'var(--text-subtle)' }}>
              ({formatDiffPercent(prevComparison.diffPercent ?? 0)})
            </span>
          </div>
        )}
        {prevComparison && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginBottom: yearComparison ? 8 : 0 }}>
            {ja.dashboard.comparisonBase}: {formatDate(prevComparison.baseDate)}
          </div>
        )}

        {yearComparison && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 6, marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
              {yearComparison.label === 'yearStart' ? ja.dashboard.yearStartComparison : ja.dashboard.yearFirstComparison}
            </span>
            <span className={`amount-small ${diffClass(yearComparison.diff)}`}>
              {formatDiff(yearComparison.diff, masked)}
            </span>
            <span style={{ fontSize: '0.82rem', color: diffClass(yearComparison.diff) === 'diff-positive' ? 'var(--positive)' : diffClass(yearComparison.diff) === 'diff-negative' ? 'var(--negative)' : 'var(--text-subtle)' }}>
              ({formatDiffPercent(yearComparison.diffPercent ?? 0)})
            </span>
          </div>
        )}
        {yearComparison?.label === 'yearFirst' && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginBottom: 0 }}>
            {ja.dashboard.comparisonBase}: {formatDate(yearComparison.baseDate)}
          </div>
        )}

        {lastHoldingUpdate && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: 8 }}>
            {ja.dashboard.lastUpdated}: {formatDate(lastHoldingUpdate.updatedAt)}
          </div>
        )}

        {snapshotChangedSince && (
          <div className="notice notice-info" style={{ marginTop: 12 }}>
            <div>{ja.dashboard.snapshotChanged}</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={onGoToMonthlyUpdate}>
              {ja.dashboard.updateSnapshot}
            </button>
          </div>
        )}
      </div>

      {/* FIRE progress */}
      <div className="card">
        <div className="card-title">{ja.dashboard.fireProgress}</div>
        {fire.isGoalSet ? (
          <>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {ja.dashboard.fireTarget}: {formatCurrency(fire.targetAmount, masked)}
              </span>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--brand)' }}>
                {formatPercent(fire.reached * 100)}
              </span>
            </div>
            <div className="progress-bar" style={{ marginBottom: 8 }}>
              <div
                className="progress-fill"
                style={{ width: `${Math.min(fire.reached * 100, 100)}%` }}
                role="progressbar"
                aria-valuenow={Math.round(fire.reached * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {ja.dashboard.fireRemaining}: {formatCurrency(fire.remaining, masked)}
            </div>
          </>
        ) : (
          <>
            <div style={{ color: 'var(--text-subtle)', fontSize: '0.85rem', marginBottom: 8 }}>
              FIRE目標が設定されていません
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onGoToSettings}>
              {ja.dashboard.setFireTarget}
            </button>
          </>
        )}
      </div>

      {/* Asset class breakdown (ledger style) */}
      <div className="card">
        <div className="card-title">{ja.dashboard.assetClassBreakdown}</div>
        {[
          { label: ja.assetClass.cash, value: assetClass.cash },
          { label: ja.assetClass.investment, value: assetClass.investment },
          { label: ja.assetClass.crypto, value: assetClass.crypto },
        ].map(({ label, value }) => (
          <div key={label} className="stat-row">
            <span className="stat-label">{label}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="stat-value">{formatCurrency(value, masked)}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', minWidth: 40, textAlign: 'right' }}>
                {formatPercent(total > 0 ? (value / total) * 100 : 0)}
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
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
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
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: 4 }}>
            {ja.unrealizedGains.scope}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
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
                <Tooltip content={(props) => <MaskedTooltip active={props.active} payload={props.payload as Array<{ name?: string; value?: number }>} masked={masked} />} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <table className="data-table data-table-3col" aria-label={ja.dashboard.categoryChart}>
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
          <table className="data-table data-table-3col" aria-label={ja.dashboard.topHoldings}>
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
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>{categoryName}</div>
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
            <span style={{ fontSize: '0.88rem', color: done ? 'var(--text)' : 'var(--text-muted)' }}>
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
                <span style={{ color: 'var(--text-subtle)', marginLeft: 8 }}>
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
          <div style={{ color: 'var(--text-subtle)', fontSize: '0.88rem' }}>未実施</div>
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
