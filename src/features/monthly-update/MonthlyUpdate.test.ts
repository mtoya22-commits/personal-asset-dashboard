import { describe, it, expect } from 'vitest';
import type { Holding } from '../../types/index.js';
import { computeRows } from './MonthlyUpdate.js';

const makeHolding = (id: string, value: number): Holding => ({
  id,
  categoryId: 'cat-1',
  name: `Holding ${id}`,
  accountType: 'その他',
  marketValue: value,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('computeRows', () => {
  it('initializes rows from holdings when prevRows is empty', () => {
    const holdings = [makeHolding('h1', 100000), makeHolding('h2', 200000)];
    const rows = computeRows(holdings, []);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ holdingId: 'h1', value: '100000', original: 100000 });
    expect(rows[1]).toEqual({ holdingId: 'h2', value: '200000', original: 200000 });
  });

  it('preserves user-typed value when holding is already in prevRows', () => {
    const holdings = [makeHolding('h1', 100000)];
    const prevRows = [{ holdingId: 'h1', value: '150000', original: 100000 }];
    const rows = computeRows(holdings, prevRows);
    expect(rows[0].value).toBe('150000');
    expect(rows[0].original).toBe(100000);
  });

  it('adds new holdings without disrupting existing rows', () => {
    const holdings = [makeHolding('h1', 100000), makeHolding('h2', 200000)];
    const prevRows = [{ holdingId: 'h1', value: '120000', original: 100000 }];
    const rows = computeRows(holdings, prevRows);
    expect(rows).toHaveLength(2);
    expect(rows[0].value).toBe('120000');
    expect(rows[1].value).toBe('200000');
  });

  it('removes rows for deleted holdings', () => {
    const holdings = [makeHolding('h2', 200000)];
    const prevRows = [
      { holdingId: 'h1', value: '100000', original: 100000 },
      { holdingId: 'h2', value: '250000', original: 200000 },
    ];
    const rows = computeRows(holdings, prevRows);
    expect(rows).toHaveLength(1);
    expect(rows[0].holdingId).toBe('h2');
    expect(rows[0].value).toBe('250000');
  });
});
