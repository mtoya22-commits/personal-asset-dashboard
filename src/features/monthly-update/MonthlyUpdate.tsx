import { useState, useMemo, useCallback, useEffect } from 'react';
import type { AppData } from '../../hooks/useAppData.js';
import { PencilIcon } from '../../components/icons/index.js';
import type { Holding } from '../../types/index.js';
import { buildSnapshot } from '../../lib/calculations/index.js';
import {
  formatCurrency,
  formatDiff,
  getMonthKeyJST,
  getISONow,
} from '../../lib/formatters/index.js';
import { normalizeIntegerInput } from '../../lib/validators/index.js';
import { useDirtyFlag } from '../../hooks/useUnsavedChanges.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import { ja } from '../../strings/ja.js';

type MonthlyUpdateProps = {
  data: AppData;
  masked: boolean;
};

type RowState = {
  holdingId: string;
  value: string;
  original: number;
};

export function computeRows(holdings: Holding[], prevRows: RowState[]): RowState[] {
  const prevMap = new Map(prevRows.map((r) => [r.holdingId, r]));
  return holdings.map((h) => {
    const existing = prevMap.get(h.id);
    return existing
      ? { ...existing, original: h.marketValue }
      : { holdingId: h.id, value: String(h.marketValue), original: h.marketValue };
  });
}

export function MonthlyUpdate({ data, masked }: MonthlyUpdateProps) {
  const { categories, holdings, snapshots, saveHolding, saveSnapshot } = data;
  const currentMonthKey = getMonthKeyJST();

  const prevSnapshot = useMemo(() => {
    return [...snapshots]
      .filter((s) => s.monthKey < currentMonthKey)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))[0] ?? null;
  }, [snapshots, currentMonthKey]);

  const [rows, setRows] = useState<RowState[]>(() =>
    computeRows(holdings, []),
  );
  const [showChangedOnly, setShowChangedOnly] = useState(false);
  const [snapshotMemo, setSnapshotMemo] = useState('');
  const [confirmZero, setConfirmZero] = useState<{ holdingId: string; newVal: string } | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Sync rows when holdings change (e.g. after save), preserving user input for existing rows
  useEffect(() => {
    setRows((prev) => computeRows(holdings, prev));
  }, [holdings]);

  const getPrevValue = useCallback(
    (h: Holding): number | null => {
      if (!prevSnapshot) return null;
      const snap = prevSnapshot.holdingsSnapshot.find((s) => s.id === h.id);
      return snap?.marketValue ?? null;
    },
    [prevSnapshot],
  );

  const changedCount = useMemo(() => {
    return rows.filter((r) => {
      const parsed = normalizeIntegerInput(r.value);
      return parsed !== null && parsed !== r.original;
    }).length;
  }, [rows]);

  useDirtyFlag('monthlyUpdate', changedCount > 0);

  const displayedRows = useMemo(() => {
    if (!showChangedOnly) return rows;
    return rows.filter((r) => {
      const parsed = normalizeIntegerInput(r.value);
      return parsed !== null && parsed !== r.original;
    });
  }, [rows, showChangedOnly]);

  const handleValueChange = (holdingId: string, rawValue: string) => {
    // Check if changing from positive to zero
    const holding = holdings.find((h) => h.id === holdingId);
    if (holding && holding.marketValue > 0) {
      const parsed = normalizeIntegerInput(rawValue);
      if (parsed === 0) {
        setConfirmZero({ holdingId, newVal: rawValue });
        return;
      }
    }
    setRows((prev) => prev.map((r) => (r.holdingId === holdingId ? { ...r, value: rawValue } : r)));
  };

  const handleZeroConfirm = () => {
    if (!confirmZero) return;
    setRows((prev) =>
      prev.map((r) => (r.holdingId === confirmZero.holdingId ? { ...r, value: confirmZero.newVal } : r)),
    );
    setConfirmZero(null);
  };

  const applyRows = (): Holding[] => {
    return holdings.map((h) => {
      const row = rows.find((r) => r.holdingId === h.id);
      if (!row) return h;
      const parsed = normalizeIntegerInput(row.value);
      if (parsed === null || parsed === h.marketValue) return h;
      return { ...h, marketValue: parsed, updatedAt: getISONow() };
    });
  };

  const handleSaveValues = async () => {
    setSaving(true);
    try {
      const updated = applyRows();
      for (const h of updated) {
        if (h.updatedAt !== holdings.find((x) => x.id === h.id)?.updatedAt) {
          await saveHolding(h);
        }
      }
      setSuccessMsg(ja.monthlyUpdate.valuesSaved);
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSnapshot = async () => {
    if (holdings.length === 0) {
      setConfirmEmpty(true);
      return;
    }
    await doSaveAndSnapshot();
  };

  const doSaveAndSnapshot = async () => {
    setSaving(true);
    try {
      const updated = applyRows();
      for (const h of updated) {
        if (h.updatedAt !== holdings.find((x) => x.id === h.id)?.updatedAt) {
          await saveHolding(h);
        }
      }
      const currentSnap = snapshots.find((s) => s.monthKey === currentMonthKey);
      const snap = buildSnapshot(
        updated,
        categories,
        snapshotMemo.trim() || undefined,
        currentSnap?.id,
        currentSnap?.createdAt,
      );
      await saveSnapshot(snap);
      setSuccessMsg(ja.monthlyUpdate.snapshotSaved);
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setSaving(false);
      setConfirmEmpty(false);
    }
  };

  const jst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const monthLabel = `${jst.getMonth() + 1}月`;

  if (holdings.length === 0) {
    return (
      <div className="screen">
        <div className="section-title" style={{ marginBottom: 16 }}>
          {ja.monthlyUpdate.title.replace('月', monthLabel)}
        </div>
        <div className="empty-state">
          <div className="empty-state-icon"><PencilIcon size={48} /></div>
          <div className="empty-state-text">{ja.monthlyUpdate.empty}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1 className="section-title" style={{ marginBottom: 4 }}>
        {monthLabel}の評価額を更新
      </h1>
      <p style={{ fontSize: '0.82rem', color: 'var(--color-text-3)', marginBottom: 12 }}>
        一覧で評価額をまとめて更新できます
      </p>

      {successMsg && (
        <div className="notice notice-info" style={{ marginBottom: 12 }}>
          {successMsg}
        </div>
      )}

      <div className="row-between" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-2)' }}>
          {changedCount > 0 ? `${changedCount}${ja.monthlyUpdate.changedCount}` : '変更なし'}
        </span>
        <label className="row" style={{ gap: 6, cursor: 'pointer', fontSize: '0.82rem' }}>
          <input
            type="checkbox"
            checked={showChangedOnly}
            onChange={(e) => setShowChangedOnly(e.target.checked)}
            aria-label={ja.monthlyUpdate.showChangedOnly}
          />
          {ja.monthlyUpdate.showChangedOnly}
        </label>
      </div>

      <div>
        {displayedRows.map((row) => {
          const holding = holdings.find((h) => h.id === row.holdingId);
          if (!holding) return null;
          const cat = categories.find((c) => c.id === holding.categoryId);
          const prevValue = getPrevValue(holding);
          const currentParsed = normalizeIntegerInput(row.value);
          const diff =
            currentParsed !== null && prevValue !== null ? currentParsed - prevValue : null;
          const isChanged = currentParsed !== null && currentParsed !== row.original;

          return (
            <div key={row.holdingId} className="card" style={{ marginBottom: 8, padding: '12px 14px' }}>
              <div className="row-between" style={{ marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {holding.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-3)', marginTop: 2 }}>
                    <span className="color-dot" style={{ background: cat?.color, marginRight: 4 }} />
                    {cat?.name ?? '—'}
                  </div>
                </div>
                {diff !== null && (
                  <div
                    className={diff > 0 ? 'diff-positive' : diff < 0 ? 'diff-negative' : ''}
                    style={{ fontSize: '0.8rem', textAlign: 'right', flexShrink: 0, marginLeft: 8 }}
                  >
                    {formatDiff(diff, masked)}
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', flexShrink: 0 }}>
                  前回: {prevValue !== null ? formatCurrency(prevValue, masked) : ja.monthlyUpdate.noRecord}
                </span>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <input
                    className="form-input"
                    inputMode="numeric"
                    value={row.value}
                    onChange={(e) => handleValueChange(row.holdingId, e.target.value)}
                    aria-label={`${holding.name}の評価額`}
                    style={{
                      textAlign: 'right',
                      width: '100%',
                      maxWidth: 150,
                      padding: '6px 8px',
                      fontSize: '0.9rem',
                      background: isChanged ? 'var(--brand-soft)' : undefined,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="form-group" style={{ marginTop: 16 }}>
        <label className="form-label" htmlFor="snap-memo">{ja.monthlyUpdate.snapshotMemo}</label>
        <input
          id="snap-memo"
          className="form-input"
          value={snapshotMemo}
          onChange={(e) => setSnapshotMemo(e.target.value)}
          maxLength={500}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        <button
          className="btn btn-secondary btn-block"
          onClick={handleSaveValues}
          disabled={saving || changedCount === 0}
          aria-label={ja.monthlyUpdate.saveValuesOnly}
        >
          {ja.monthlyUpdate.saveValuesOnly}
        </button>
        <button
          className="btn btn-primary btn-block"
          onClick={handleSaveAndSnapshot}
          disabled={saving}
          aria-label={ja.monthlyUpdate.saveAndSnapshot}
        >
          {saving ? '保存中...' : ja.monthlyUpdate.saveAndSnapshot}
        </button>
      </div>

      <div style={{ height: 16 }} />
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
        前回月次記録比較: {prevSnapshot ? `${prevSnapshot.monthKey}` : '記録なし'}
      </div>

      <ConfirmDialog
        open={!!confirmZero}
        title={ja.monthlyUpdate.zeroConfirmTitle}
        message={`「${holdings.find((h) => h.id === confirmZero?.holdingId)?.name ?? ''}」— ${ja.monthlyUpdate.zeroConfirmMessage}`}
        confirmLabel={ja.monthlyUpdate.confirmButton}
        cancelLabel={ja.monthlyUpdate.cancelButton}
        onConfirm={handleZeroConfirm}
        onCancel={() => setConfirmZero(null)}
      />

      <ConfirmDialog
        open={confirmEmpty}
        title={ja.monthlyUpdate.emptySnapshotTitle}
        message={ja.monthlyUpdate.emptySnapshotMessage}
        confirmLabel={ja.monthlyUpdate.confirmButton}
        cancelLabel={ja.monthlyUpdate.cancelButton}
        onConfirm={doSaveAndSnapshot}
        onCancel={() => setConfirmEmpty(false)}
      />
    </div>
  );
}
