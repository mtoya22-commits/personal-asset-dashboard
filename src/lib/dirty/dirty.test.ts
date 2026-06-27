import { describe, it, expect } from 'vitest';

// Test the isFormDirty logic pattern (as a pure function to verify the concept)
type FormValues = {
  name: string; categoryId: string; accountType: string;
  marketValue: string; costBasis: string; quantity: string; memo: string;
};

function isFormDirty(current: FormValues, initial: FormValues | null): boolean {
  if (!initial) return false;
  return (
    current.name !== initial.name ||
    current.categoryId !== initial.categoryId ||
    current.accountType !== initial.accountType ||
    current.marketValue !== initial.marketValue ||
    current.costBasis !== initial.costBasis ||
    current.quantity !== initial.quantity ||
    current.memo !== initial.memo
  );
}

const initial: FormValues = {
  name: 'Test', categoryId: 'cat-1', accountType: 'その他',
  marketValue: '100000', costBasis: '', quantity: '', memo: '',
};

describe('isFormDirty', () => {
  it('returns false when values match initial', () => {
    expect(isFormDirty({ ...initial }, initial)).toBe(false);
  });

  it('returns false when initial is null (form not open)', () => {
    expect(isFormDirty({ ...initial }, null)).toBe(false);
  });

  it('returns true when name changes', () => {
    expect(isFormDirty({ ...initial, name: 'Changed' }, initial)).toBe(true);
  });

  it('returns true when marketValue changes', () => {
    expect(isFormDirty({ ...initial, marketValue: '200000' }, initial)).toBe(true);
  });

  it('returns false when value is reverted to initial', () => {
    const modified = { ...initial, name: 'Changed' };
    const reverted = { ...modified, name: initial.name };
    expect(isFormDirty(reverted, initial)).toBe(false);
  });

  it('returns true when accountType changes', () => {
    expect(isFormDirty({ ...initial, accountType: 'NISA' }, initial)).toBe(true);
  });
});

type CatValues = { name: string; color: string; sortOrder: number };

function isCatDirty(current: CatValues, original: CatValues | null): boolean {
  if (!original) return false;
  return (
    current.name !== original.name ||
    current.color !== original.color ||
    current.sortOrder !== original.sortOrder
  );
}

const catInitial: CatValues = { name: '王道', color: '#1234ab', sortOrder: 0 };

describe('isCatDirty', () => {
  it('returns false when category dialog opened without changes', () => {
    expect(isCatDirty({ ...catInitial }, catInitial)).toBe(false);
  });

  it('returns true when category name changes', () => {
    expect(isCatDirty({ ...catInitial, name: 'New Name' }, catInitial)).toBe(true);
  });

  it('returns false when name reverted to original', () => {
    expect(isCatDirty({ ...catInitial, name: catInitial.name }, catInitial)).toBe(false);
  });

  it('returns true when color changes', () => {
    expect(isCatDirty({ ...catInitial, color: '#ff0000' }, catInitial)).toBe(true);
  });
});
