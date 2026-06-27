import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import type { AppData } from '../../hooks/useAppData.js';
import {
  calcTotalAssets,
  calcCategoryBreakdown,
  calcAssetClassBreakdown,
  calcAccountTypeBreakdown,
  calcTopCategories,
  calcTopHoldings,
  calcUnrealizedGains,
} from '../../lib/calculations/index.js';
import {
  formatCurrency,
  formatPercent,
  formatDiff,
  formatDiffPercent,
} from '../../lib/formatters/index.js';
import { ja } from '../../strings/ja.js';

type AllocationProps = {
  data: AppData;
  masked: boolean;
};

export function Allocation({ data, masked }: AllocationProps) {
  const { categories, holdings } = data;

  const total = useMemo(() => calcTotalAssets(holdings), [holdings]);
  const catBreakdown = useMemo(
    () => calcCategoryBreakdown(holdings, categories),
    [holdings, categories],
  );
  const assetClass = useMemo(
    () => calcAssetClassBreakdown(holdings, categories),
    [holdings, categories],
  );
  const accountTypes = useMemo(() => calcAccountTypeBreakdown(holdings), [holdings]);
  const topCats = useMemo(() => calcTopCategories(catBreakdown, 5), [catBreakdown]);
  const topHoldings = useMemo(() => calcTopHoldings(holdings, categories, 5), [holdings, categories]);
  const unrealized = useMemo(() => calcUnrealizedGains(holdings, categories), [holdings, categories]);

  const pieData = catBreakdown
    .filter((c) => c.value > 0)
    .map((c) => {
      const cat = categories.find((x) => x.id === c.categoryId);
      return { name: c.categoryName, value: c.value, color: cat?.color ?? '#888' };
    });

  if (holdings.length === 0) {
    return (
      <div className="screen">
        <div className="empty-state">
          <div className="empty-state-icon">📈</div>
          <div className="empty-state-text">保有資産を追加すると配分分析が表示されます</div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1 className="section-title" style={{ marginBottom: 16 }}>{ja.allocation.title}</h1>

      {/* Category donut chart */}
      <div className="card">
        <div className="card-title">{ja.allocation.categoryDonut}</div>
        {!masked && pieData.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [formatCurrency(v), '']} />
            </PieChart>
          </ResponsiveContainer>
        )}
        <table className="data-table" aria-label={ja.allocation.categoryTable}>
          <thead>
            <tr>
              <th>カテゴリ</th>
              <th>大分類</th>
              <th>評価額</th>
              <th>比率</th>
            </tr>
          </thead>
          <tbody>
            {[...catBreakdown]
              .sort((a, b) => b.value - a.value)
              .map((c) => {
                const cat = categories.find((x) => x.id === c.categoryId);
                return (
                  <tr key={c.categoryId}>
                    <td>
                      <span className="color-dot" style={{ background: cat?.color, marginRight: 6 }} />
                      {c.categoryName}
                    </td>
                    <td style={{ color: 'var(--color-text-3)', textAlign: 'left' }}>
                      {ja.assetClass[c.assetClass]}
                    </td>
                    <td>{formatCurrency(c.value, masked)}</td>
                    <td>{formatPercent(total > 0 ? (c.value / total) * 100 : 0)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Asset class breakdown */}
      <div className="card">
        <div className="card-title">{ja.allocation.assetClassBreakdown}</div>
        <table className="data-table" aria-label={ja.allocation.assetClassBreakdown}>
          <thead>
            <tr>
              <th>大分類</th>
              <th>評価額</th>
              <th>比率</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                { key: 'cash', label: ja.assetClass.cash, value: assetClass.cash },
                { key: 'investment', label: ja.assetClass.investment, value: assetClass.investment },
                { key: 'crypto', label: ja.assetClass.crypto, value: assetClass.crypto },
              ] as const
            ).map(({ key, label, value }) => (
              <tr key={key}>
                <td>{label}</td>
                <td>{formatCurrency(value, masked)}</td>
                <td>{formatPercent(total > 0 ? (value / total) * 100 : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Account type breakdown */}
      <div className="card">
        <div className="card-title">{ja.allocation.accountTypeTable}</div>
        <table className="data-table" aria-label={ja.allocation.accountTypeTable}>
          <thead>
            <tr>
              <th>口座種別</th>
              <th>評価額</th>
              <th>比率</th>
            </tr>
          </thead>
          <tbody>
            {accountTypes.map(({ accountType, value }) => (
              <tr key={accountType}>
                <td>{ja.accountType[accountType as keyof typeof ja.accountType] ?? accountType}</td>
                <td>{formatCurrency(value, masked)}</td>
                <td>{formatPercent(total > 0 ? (value / total) * 100 : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top 5 categories bar chart */}
      {topCats.length > 0 && (
        <div className="card">
          <div className="card-title">{ja.allocation.topCategories}</div>
          {!masked && (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={topCats.map((c) => {
                  const cat = categories.find((x) => x.id === c.categoryId);
                  return { name: c.categoryName, value: c.value, fill: cat?.color ?? '#888' };
                })}
                layout="vertical"
                margin={{ left: 8, right: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), '']} />
                <Bar dataKey="value">
                  {topCats.map((c) => {
                    const cat = categories.find((x) => x.id === c.categoryId);
                    return <Cell key={c.categoryId} fill={cat?.color ?? '#888'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <table className="data-table" aria-label={ja.allocation.topCategories}>
            <thead>
              <tr><th>カテゴリ</th><th>評価額</th><th>比率</th></tr>
            </thead>
            <tbody>
              {topCats.map((c) => (
                <tr key={c.categoryId}>
                  <td>{c.categoryName}</td>
                  <td>{formatCurrency(c.value, masked)}</td>
                  <td>{formatPercent(total > 0 ? (c.value / total) * 100 : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top 5 holdings */}
      {topHoldings.length > 0 && (
        <div className="card">
          <div className="card-title">{ja.allocation.topHoldings}</div>
          <table className="data-table" aria-label={ja.allocation.topHoldings}>
            <thead>
              <tr><th>資産名</th><th>評価額</th><th>比率</th></tr>
            </thead>
            <tbody>
              {topHoldings.map(({ holding, ratio }) => (
                <tr key={holding.id}>
                  <td>{holding.name}</td>
                  <td>{formatCurrency(holding.marketValue, masked)}</td>
                  <td>{formatPercent(ratio * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unrealized gains */}
      <div className="card">
        <div className="card-title">{ja.unrealizedGains.label}</div>
        {unrealized.entries.length === 0 ? (
          <div style={{ color: 'var(--color-text-3)', fontSize: '0.88rem' }}>
            {ja.unrealizedGains.noTarget}
          </div>
        ) : (
          <>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-3)', marginBottom: 8 }}>
              {ja.unrealizedGains.scope}
            </div>
            <table className="data-table" aria-label={ja.allocation.unrealizedGains}>
              <thead>
                <tr>
                  <th>資産名</th>
                  <th>評価損益</th>
                  <th>損益率</th>
                </tr>
              </thead>
              <tbody>
                {unrealized.entries.map((e) => (
                  <tr key={e.holdingId}>
                    <td>{e.name}</td>
                    <td className={e.gain >= 0 ? 'diff-positive' : 'diff-negative'}>
                      {formatDiff(e.gain, masked)}
                    </td>
                    <td className={e.gain >= 0 ? 'diff-positive' : 'diff-negative'}>
                      {e.gainPercent !== null ? formatDiffPercent(e.gainPercent) : '—'}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td>合計</td>
                  <td className={unrealized.totalGain >= 0 ? 'diff-positive' : 'diff-negative'}>
                    {formatDiff(unrealized.totalGain, masked)}
                  </td>
                  <td className={unrealized.totalGain >= 0 ? 'diff-positive' : 'diff-negative'}>
                    {unrealized.totalGainPercent !== null
                      ? formatDiffPercent(unrealized.totalGainPercent)
                      : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', marginTop: 8 }}>
              {ja.unrealizedGains.targetValue}: {formatCurrency(unrealized.targetMarketValue, masked)}
              {' / '}
              {ja.unrealizedGains.investmentTotal}: {formatCurrency(unrealized.investmentCryptoTotal, masked)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
