import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { AppData } from '../../hooks/useAppData.js';
import type { MonthlySnapshot } from '../../types/index.js';
import { formatCurrency, formatDate, formatDiff, formatDiffPercent } from '../../lib/formatters/index.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import { Dialog } from '../../components/Dialog.js';
import { ja } from '../../strings/ja.js';

type SnapshotHistoryProps = {
  data: AppData;
  masked: boolean;
};

export function SnapshotHistory({ data, masked }: SnapshotHistoryProps) {
  const { snapshots, removeSnapshot } = data;
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailSnap, setDetailSnap] = useState<MonthlySnapshot | null>(null);

  const sorted = useMemo(
    () => [...snapshots].sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
    [snapshots],
  );

  const chartData = useMemo(
    () =>
      [...snapshots]
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
        .slice(-12)
        .map((s) => ({ name: s.monthKey.slice(2), value: s.totalAssets })),
    [snapshots],
  );

  const getDiff = (snap: MonthlySnapshot, prev: MonthlySnapshot | undefined) => {
    if (!prev) return null;
    const diff = snap.totalAssets - prev.totalAssets;
    const pct = prev.totalAssets === 0 ? null : (diff / prev.totalAssets) * 100;
    return { diff, pct };
  };

  return (
    <div>
      <h2 className="section-title" style={{ marginBottom: 12 }}>{ja.history.title}</h2>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="card">
          <div className="card-title">{ja.history.trendChart}</div>
          {!masked ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={50} tickFormatter={(v) => `${(v / 1e4).toFixed(0)}万`} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), '資産']} />
                <Line type="monotone" dataKey="value" stroke="var(--color-primary)" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-3)', fontSize: '0.88rem' }}>
              グラフは金額マスク中は非表示です
            </div>
          )}
        </div>
      )}

      {/* Snapshot list */}
      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-text">{ja.history.noHistory}</div>
        </div>
      ) : (
        sorted.map((snap, idx) => {
          const prev = sorted[idx + 1];
          const diff = getDiff(snap, prev);
          return (
            <div key={snap.id} className="card" style={{ marginBottom: 8 }}>
              <div className="row-between">
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{snap.monthKey}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)' }}>
                    {ja.history.date}: {formatDate(snap.snapshotDate)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="amount-small">{formatCurrency(snap.totalAssets, masked)}</div>
                  {diff && (
                    <div
                      style={{ fontSize: '0.75rem' }}
                      className={diff.diff > 0 ? 'diff-positive' : diff.diff < 0 ? 'diff-negative' : 'diff-neutral'}
                    >
                      {formatDiff(diff.diff, masked)}
                      {diff.pct !== null && ` (${formatDiffPercent(diff.pct)})`}
                    </div>
                  )}
                </div>
              </div>
              {snap.memo && (
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-2)', marginTop: 6 }}>
                  {snap.memo}
                </div>
              )}
              <div className="row" style={{ gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDetailSnap(snap)}
                  aria-label={`${snap.monthKey}の詳細`}
                >
                  詳細
                </button>
                <button
                  className="btn btn-sm"
                  style={{ color: 'var(--color-down)' }}
                  onClick={() => setDeleteId(snap.id)}
                  aria-label={`${snap.monthKey}の月次記録を削除`}
                >
                  削除
                </button>
              </div>
            </div>
          );
        })
      )}

      <ConfirmDialog
        open={!!deleteId}
        title={ja.history.deleteSnapshot}
        message={ja.history.deleteConfirm}
        confirmLabel="削除する"
        danger
        onConfirm={async () => {
          if (deleteId) await removeSnapshot(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />

      <Dialog
        open={!!detailSnap}
        onClose={() => setDetailSnap(null)}
        title={detailSnap ? `${detailSnap.monthKey} 詳細` : ''}
      >
        {detailSnap && (
          <SnapshotDetail snap={detailSnap} masked={masked} />
        )}
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-secondary btn-block" onClick={() => setDetailSnap(null)}>
            閉じる
          </button>
        </div>
      </Dialog>
    </div>
  );
}

function SnapshotDetail({ snap, masked }: { snap: MonthlySnapshot; masked: boolean }) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-3)' }}>記録日: {formatDate(snap.snapshotDate)}</div>
        <div className="amount-medium" style={{ marginTop: 4 }}>{formatCurrency(snap.totalAssets, masked)}</div>
        {snap.memo && <div style={{ marginTop: 6, fontSize: '0.85rem' }}>{snap.memo}</div>}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="card-title">大分類</div>
        <table className="data-table">
          <tbody>
            <tr><td>現金</td><td>{formatCurrency(snap.assetClassBreakdown.cash, masked)}</td></tr>
            <tr><td>投資</td><td>{formatCurrency(snap.assetClassBreakdown.investment, masked)}</td></tr>
            <tr><td>暗号資産</td><td>{formatCurrency(snap.assetClassBreakdown.crypto, masked)}</td></tr>
          </tbody>
        </table>
      </div>

      <div>
        <div className="card-title">保有資産</div>
        <table className="data-table">
          <thead>
            <tr><th>資産名</th><th>カテゴリ</th><th>評価額</th></tr>
          </thead>
          <tbody>
            {snap.holdingsSnapshot.map((h) => (
              <tr key={h.id}>
                <td>{h.name}</td>
                <td style={{ color: 'var(--color-text-3)', textAlign: 'left' }}>{h.categoryName}</td>
                <td>{formatCurrency(h.marketValue, masked)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
