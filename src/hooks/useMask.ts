import { useState, useEffect } from 'react';

const STORAGE_KEY = 'pad:mask-active';

export function useMask(maskOnLaunch: boolean) {
  const [masked, setMasked] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === 'true';
    } catch {
      // ignore
    }
    return maskOnLaunch;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(masked));
    } catch {
      // ignore
    }
  }, [masked]);

  const toggleMask = () => setMasked((m) => !m);

  return { masked, toggleMask };
}
