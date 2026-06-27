import { useEffect } from 'react';

const dirtyKeys = new Set<string>();

export function markDirty(key: string): void {
  dirtyKeys.add(key);
}

export function markClean(key: string): void {
  dirtyKeys.delete(key);
}

export function hasUnsavedChanges(): boolean {
  return dirtyKeys.size > 0;
}

export function resetDirtyState(): void {
  dirtyKeys.clear();
}

export function useDirtyFlag(key: string, isDirty: boolean): void {
  useEffect(() => {
    if (isDirty) {
      markDirty(key);
    } else {
      markClean(key);
    }
    return () => markClean(key);
  }, [key, isDirty]);
}
