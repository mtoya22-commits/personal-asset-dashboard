import { useState } from 'react';
import type { AppData } from '../../hooks/useAppData.js';
import { SnapshotHistory } from './SnapshotHistory.js';
import { Settings } from '../settings/Settings.js';

type Tab = 'history' | 'settings';

type HistoryAndSettingsProps = {
  data: AppData;
  masked: boolean;
};

export function HistoryAndSettings({ data, masked }: HistoryAndSettingsProps) {
  const [tab, setTab] = useState<Tab>('history');

  return (
    <div className="screen">
      <div className="row" style={{ gap: 0, marginBottom: 16, background: 'var(--color-surface-2)', borderRadius: 8, padding: 3 }}>
        {(['history', 'settings'] as Tab[]).map((t) => (
          <button
            key={t}
            className="btn"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              background: tab === t ? 'var(--color-surface)' : 'transparent',
              color: tab === t ? 'var(--color-primary)' : 'var(--color-text-2)',
              boxShadow: tab === t ? 'var(--shadow)' : 'none',
              borderRadius: 6,
              fontSize: '0.88rem',
              padding: '8px 12px',
            }}
            aria-pressed={tab === t}
            aria-label={t === 'history' ? '月次履歴' : '設定'}
          >
            {t === 'history' ? '月次履歴' : '設定'}
          </button>
        ))}
      </div>

      {tab === 'history' ? (
        <SnapshotHistory data={data} masked={masked} />
      ) : (
        <Settings data={data} masked={masked} />
      )}
    </div>
  );
}
