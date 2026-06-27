import { describe, it, expect, beforeEach } from 'vitest';
import { markDirty, markClean, hasUnsavedChanges, resetDirtyState } from './useUnsavedChanges.js';

describe('useUnsavedChanges', () => {
  beforeEach(() => {
    resetDirtyState();
  });

  it('returns false when no dirty keys', () => {
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('returns true after marking a key dirty', () => {
    markDirty('test-key');
    expect(hasUnsavedChanges()).toBe(true);
  });

  it('returns false after marking dirty then clean', () => {
    markDirty('test-key');
    markClean('test-key');
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('remains true when one of several dirty keys is cleaned', () => {
    markDirty('key-1');
    markDirty('key-2');
    markClean('key-1');
    expect(hasUnsavedChanges()).toBe(true);
  });

  it('returns false only after all dirty keys are cleaned', () => {
    markDirty('key-1');
    markDirty('key-2');
    markClean('key-1');
    markClean('key-2');
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('resetDirtyState clears all dirty keys', () => {
    markDirty('key-1');
    markDirty('key-2');
    resetDirtyState();
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('save flow: marking clean after save means no update confirmation needed', () => {
    markDirty('monthlyUpdate');
    markClean('monthlyUpdate');
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('discard flow: dirty state clears after explicit discard', () => {
    markDirty('holdingForm');
    markClean('holdingForm');
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('update confirmation needed when dirty', () => {
    markDirty('settings');
    expect(hasUnsavedChanges()).toBe(true);
  });

  it('no update confirmation needed after clean', () => {
    markDirty('settings');
    markClean('settings');
    expect(hasUnsavedChanges()).toBe(false);
  });
});
