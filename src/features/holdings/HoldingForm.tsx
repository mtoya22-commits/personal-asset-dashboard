import { useState, useEffect } from 'react';
import type { Holding, AssetCategory, AccountType } from '../../types/index.js';
import { validateHoldingInput, normalizeIntegerInput, normalizeNumericInput } from '../../lib/validators/index.js';
import { getISONow } from '../../lib/formatters/index.js';
import { useDirtyFlag } from '../../hooks/useUnsavedChanges.js';
import { Dialog } from '../../components/Dialog.js';
import { ja } from '../../strings/ja.js';

const ALL_ACCOUNT_TYPES: AccountType[] = ['NISA', '特定', 'iDeCo', 'DC', '預金', '暗号資産取引所', 'その他'];
const NON_INVESTMENT_ACCOUNT_TYPES: AccountType[] = ['預金', '暗号資産取引所', 'その他'];

type HoldingFormProps = {
  open: boolean;
  holding?: Holding;
  categories: AssetCategory[];
  onSave: (h: Holding) => Promise<void>;
  onClose: () => void;
};

export function HoldingForm({ open, holding, categories, onSave, onClose }: HoldingFormProps) {
  const isEdit = !!holding;
  const defaultCategoryId = categories[0]?.id ?? '';

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [accountType, setAccountType] = useState<AccountType>('その他');
  const [marketValue, setMarketValue] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [quantity, setQuantity] = useState('');
  const [memo, setMemo] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (holding) {
        setName(holding.name);
        setCategoryId(holding.categoryId);
        setAccountType(holding.accountType);
        setMarketValue(String(holding.marketValue));
        setCostBasis(holding.costBasis !== undefined ? String(holding.costBasis) : '');
        setQuantity(holding.quantity !== undefined ? String(holding.quantity) : '');
        setMemo(holding.memo ?? '');
      } else {
        setName('');
        setCategoryId(defaultCategoryId);
        setAccountType('その他');
        setMarketValue('');
        setCostBasis('');
        setQuantity('');
        setMemo('');
      }
      setErrors({});
    }
  }, [open, holding, defaultCategoryId]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isCash = selectedCategory?.assetClass === 'cash';
  const isInvestment = selectedCategory?.assetClass === 'investment';
  const availableAccountTypes = isInvestment ? ALL_ACCOUNT_TYPES : NON_INVESTMENT_ACCOUNT_TYPES;

  useDirtyFlag('holdingForm', open);

  const handleSave = async () => {
    const errs = validateHoldingInput({ name, marketValue, costBasis, quantity, memo, isCash });
    if (Object.keys(errs).length > 0) {
      setErrors(errs as Record<string, string>);
      return;
    }
    setSaving(true);
    try {
      const mv = normalizeIntegerInput(marketValue) ?? 0;
      const cb = !isCash && costBasis.trim() ? normalizeIntegerInput(costBasis) ?? undefined : undefined;
      const qty = !isCash && quantity.trim() ? normalizeNumericInput(quantity) ?? undefined : undefined;
      const now = getISONow();
      const h: Holding = {
        id: holding?.id ?? crypto.randomUUID(),
        categoryId,
        name: name.trim(),
        accountType,
        marketValue: mv,
        ...(cb !== undefined ? { costBasis: cb } : {}),
        ...(qty !== undefined ? { quantity: qty } : {}),
        ...(memo.trim() ? { memo: memo.trim() } : {}),
        createdAt: holding?.createdAt ?? now,
        updatedAt: now,
      };
      await onSave(h);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? ja.holdings.editHolding : ja.holdings.addHolding}
    >
      <div className="form-group">
        <label className="form-label" htmlFor="hf-name">{ja.holdings.name}<span aria-hidden> *</span></label>
        <input
          id="hf-name"
          className={`form-input${errors.name ? ' error' : ''}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          aria-required="true"
          aria-describedby={errors.name ? 'hf-name-err' : undefined}
        />
        {errors.name && <div id="hf-name-err" className="form-error">{errors.name}</div>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="hf-cat">{ja.holdings.category}</label>
        <select
          id="hf-cat"
          className="form-input"
          value={categoryId}
          onChange={(e) => {
            const newCatId = e.target.value;
            const newCat = categories.find((c) => c.id === newCatId);
            if (newCat?.assetClass !== 'investment' && accountType === 'NISA') {
              setAccountType('その他');
            }
            setCategoryId(newCatId);
          }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="hf-acct">{ja.holdings.accountType}</label>
        <select
          id="hf-acct"
          className="form-input"
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as AccountType)}
        >
          {availableAccountTypes.map((t) => (
            <option key={t} value={t}>{ja.accountType[t]}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="hf-mv">{ja.holdings.marketValue}<span aria-hidden> *</span></label>
        <input
          id="hf-mv"
          className={`form-input${errors.marketValue ? ' error' : ''}`}
          inputMode="numeric"
          value={marketValue}
          onChange={(e) => setMarketValue(e.target.value)}
          aria-describedby={errors.marketValue ? 'hf-mv-err' : undefined}
        />
        {errors.marketValue && <div id="hf-mv-err" className="form-error">{errors.marketValue}</div>}
      </div>

      {!isCash && (
        <>
          <div className="form-group">
            <label className="form-label" htmlFor="hf-cb">{ja.holdings.costBasis}</label>
            <input
              id="hf-cb"
              className={`form-input${errors.costBasis ? ' error' : ''}`}
              inputMode="numeric"
              value={costBasis}
              onChange={(e) => setCostBasis(e.target.value)}
              aria-describedby={errors.costBasis ? 'hf-cb-err' : undefined}
            />
            {errors.costBasis && <div id="hf-cb-err" className="form-error">{errors.costBasis}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="hf-qty">{ja.holdings.quantity}</label>
            <input
              id="hf-qty"
              className={`form-input${errors.quantity ? ' error' : ''}`}
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-describedby={errors.quantity ? 'hf-qty-err' : undefined}
            />
            {errors.quantity && <div id="hf-qty-err" className="form-error">{errors.quantity}</div>}
          </div>
        </>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="hf-memo">{ja.holdings.memo}</label>
        <textarea
          id="hf-memo"
          className={`form-input${errors.memo ? ' error' : ''}`}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={500}
          rows={3}
          style={{ resize: 'vertical' }}
          aria-describedby={errors.memo ? 'hf-memo-err' : undefined}
        />
        {errors.memo && <div id="hf-memo-err" className="form-error">{errors.memo}</div>}
      </div>

      <div className="dialog-actions">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          aria-label={ja.common.save}
        >
          {saving ? '保存中...' : ja.common.save}
        </button>
        <button className="btn btn-secondary" onClick={onClose} aria-label={ja.common.cancel}>
          {ja.common.cancel}
        </button>
      </div>
    </Dialog>
  );
}
