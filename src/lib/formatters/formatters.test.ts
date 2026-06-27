import { describe, it, expect } from 'vitest';
import { formatDate, getJstMonthFromIso } from './index.js';

describe('formatDate', () => {
  it('formats YYYY-MM-DD directly without UTC offset', () => {
    expect(formatDate('2026-01-15')).toBe('2026/01/15');
  });

  it('formats ISO datetime strings in JST', () => {
    // 2026-01-01T00:00:00.000Z is 2026-01-01 09:00 JST → 2026/01/01
    const result = formatDate('2026-01-01T00:00:00.000Z');
    expect(result).toBe('2026/01/01');
  });

  it('handles end of day UTC that is next day in JST', () => {
    // 2025-12-31T20:00:00.000Z is 2026-01-01 05:00 JST → 2026/01/01
    const result = formatDate('2025-12-31T20:00:00.000Z');
    expect(result).toBe('2026/01/01');
  });
});

describe('getJstMonthFromIso', () => {
  it('returns YYYY-MM in JST', () => {
    expect(getJstMonthFromIso('2026-01-15T10:00:00.000Z')).toBe('2026-01');
  });

  it('handles UTC midnight crossing JST month boundary', () => {
    // 2025-12-31T20:00:00.000Z is 2026-01-01 05:00 JST
    expect(getJstMonthFromIso('2025-12-31T20:00:00.000Z')).toBe('2026-01');
  });

  it('does not cross month boundary for early UTC time', () => {
    // 2026-01-31T00:00:00.000Z is 2026-01-31 09:00 JST → 2026-01
    expect(getJstMonthFromIso('2026-01-31T00:00:00.000Z')).toBe('2026-01');
  });
});
