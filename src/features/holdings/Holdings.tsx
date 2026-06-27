import { useState, useMemo } from 'react';
import type { AppData } from '../../hooks/useAppData.js';
import type { Holding } from '../../types/index.js';
import { formatCurrency, formatDate } from '../../lib/formatters/index.js';
import { ConfirmDialog } from '../../components/ConfirmDialog.js';
import { HoldingForm } from './HoldingForm.js';
import { ja } from '../../strings/ja.js';

type SortMode = 'value' | 'category';

type HoldingsProps = {
  data: AppData;
  masked: boolean;
};

export function Holdings({ data, masked }: HoldingsProps) {
  const { categories, holdings, saveHolding, removeHolding } = data;

  const [filterCatId, setFilterCatId] = useState('');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('value');
  const [formOpen, setFormOpen] = useState(false);
  const [editHolding, setEditHolding] = useState<Holding | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = [...holdings];
    if (filterCatId) result = result.filter((h) => h.categoryId === filterCatId);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((h) => h.name.toLowerCase().includes(q));
    }
    if (sortMode === 'value') {
      result.sort((a, b) => b.marketValue - a.marketValue);
    } else {
      const catOrder = new Map(categories.map((c, i) => [c.id, i]));
      result.sort((a, b) => (catOrder.get(a.categoryId) ?? 999) - (catOrder.get(b.categoryId) ?? 999));
    }
    return result;
  }, [holdings, filterCatId, search, sortMode, categories]);

  // Category subtotals
  const catSubtotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of filtered) {
      map.set(h.categoryId, (map.get(h.categoryId) ?? 0) + h.marketValue);
    }
    return map;
  }, [filtered]);

  const handleEdit = (h: Holding) => {
    setEditHolding(h);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await removeHolding(deleteId);
    setDeleteId(null);
  };

  const holdingToDelete = holdings.find((h) => h.id === deleteId);

  // Group by category for display when sorted by category
  const grouped = useMemo(() => {
    if (sortMode !== 'category') return null;
    const groups = new Map<string, Holding[]>();
    for (const h of filtered) {
      if (!groups.has(h.categoryId)) groups.set(h.categoryId, []);
      groups.get(h.categoryId)!.push(h);
    }
    return groups;
  }, [filtered, sortMode]);

  const totalFiltered = filtered.reduce((s, h) => s + h.marketValue, 0);

  return (
    <div className="screen">
      <div className="section-header" style={{ marginBottom: 12 }}>
        <h1 className="section-title">{ja.holdings.title}</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setEditHolding(undefined); setFormOpen(true); }}
          aria-label={ja.holdings.addHolding}
        >
          + 追加
        </button>
      </div>

      {/* Filter and search */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <input
          className="form-input"
          placeholder={ja.holdings.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={ja.holdings.search}
          style={{ marginBottom: 8 }}
        />
        <div className="row-between">
          <select
            className="form-input"
            value={filterCatId}
            onChange={(e) => setFilterCatId(e.target.value)}
            aria-label={ja.holdings.filterCategory}
            style={{ flex: 1, marginRight: 8 }}
          >
            <option value="">{ja.holdings.allCategories}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className="form-input"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            aria-label="並び替え"
            style={{ flex: 1 }}
          >
            <option value="value">{ja.holdings.sortByValue}</option>
            <option value="category">{ja.holdings.sortByCategory}</option>
          </select>
        </div>
      </div>

      {/* Total */}
      {filtered.length > 0 && (
        <div className="row-between" style={{ padding: '6px 4px', marginBottom: 4 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--color-text-3)' }}>
            {filtered.length}件
          </span>
          <span className="amount-small">{formatCurrency(totalFiltered, masked)}</span>
        </div>
      )}

      {/* Empty state */}
      {holdings.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-text">{ja.holdings.empty}</div>
        </div>
      )}

      {/* Holdings list */}
      {sortMode === 'category' && grouped
        ? Array.from(grouped.entries()).map(([catId, items]) => {
            const cat = categories.find((c) => c.id === catId);
            const subtotal = catSubtotals.get(catId) ?? 0;
            return (
              <div key={catId}>
                <div className="row-between" style={{ padding: '8px 4px 4px' }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="color-dot" style={{ background: cat?.color }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-2)' }}>
                      {cat?.name ?? '—'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--color-text-2)' }}>
                    {ja.holdings.subtotal}: {formatCurrency(subtotal, masked)}
                  </span>
                </div>
                {items.map((h) => <HoldingRow key={h.id} holding={h} masked={masked} onEdit={handleEdit} onDelete={setDeleteId} />)}
              </div>
            );
          })
        : filtered.map((h) => <HoldingRow key={h.id} holding={h} masked={masked} onEdit={handleEdit} onDelete={setDeleteId} categories={categories} />)
      }

      <HoldingForm
        open={formOpen}
        holding={editHolding}
        categories={categories}
        onSave={saveHolding}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={!!deleteId}
        title={ja.holdings.deleteConfirmTitle}
        message={`「${holdingToDelete?.name ?? ''}」${ja.holdings.deleteConfirmMessage}`}
        confirmLabel={ja.holdings.deleteConfirmButton}
        cancelLabel={ja.holdings.cancelButton}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

function HoldingRow({
  holding,
  masked,
  onEdit,
  onDelete,
  categories,
}: {
  holding: Holding;
  masked: boolean;
  onEdit: (h: Holding) => void;
  onDelete: (id: string) => void;
  categories?: { id: string; name: string; color: string }[];
}) {
  const cat = categories?.find((c) => c.id === holding.categoryId);
  return (
    <div
      className="card"
      style={{ marginBottom: 8, padding: '12px 14px' }}
    >
      <div className="row-between">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {holding.name}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-3)', marginTop: 2 }}>
            {cat && <span className="color-dot" style={{ background: cat.color, marginRight: 4 }} />}
            {holding.accountType}
          </div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 12 }}>
          <div className="amount-small">{formatCurrency(holding.marketValue, masked)}</div>
          {holding.costBasis !== undefined && (
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-3)' }}>
              取得: {formatCurrency(holding.costBasis, masked)}
            </div>
          )}
        </div>
      </div>
      {holding.memo && (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-3)', marginTop: 6, wordBreak: 'break-word' }}>
          {holding.memo}
        </div>
      )}
      <div className="row" style={{ gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-3)', flex: 1 }}>
          更新: {formatDate(holding.updatedAt)}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onEdit(holding)}
          aria-label={`${holding.name}を編集`}
        >
          編集
        </button>
        <button
          className="btn btn-sm"
          style={{ color: 'var(--color-down)' }}
          onClick={() => onDelete(holding.id)}
          aria-label={`${holding.name}を削除`}
        >
          削除
        </button>
      </div>
    </div>
  );
}
