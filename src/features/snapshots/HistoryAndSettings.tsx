import { useState } from 'react';
import type { AppData } from '../../hooks/useAppData.js';
import { ClockIcon, SettingsIcon } from '../../components/icons/index.js';
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
      <div
        className="row"
        style={{
          gap: 0,
          marginBottom: 16,
          background: 'var(--surface-muted)',
          borderRadius: 'var(--radius-sm)',
          padding: 3,
        }}
      >
        {(['history', 'settings'] as Tab[]).map((t) => (
          <button
            key={t}
            className="btn"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              background: tab === t ? 'var(--surface)' : 'transparent',
              color: tab === t ? 'var(--brand)' : 'var(--text-muted)',
              boxShadow: tab === t ? 'var(--shadow-card)' : 'none',
              borderRadius: 7,
              fontSize: '0.88rem',
              padding: '7px 12px',
              gap: 6,
            }}
            aria-pressed={tab === t}
            aria-label={t === 'history' ? '月次履歴' : '設定'}
          >
            {t === 'history' ? (
              <>
                <ClockIcon size={15} />
                月次履歴
              </>
            ) : (
              <>
                <SettingsIcon size={15} />
                設定
              </>
            )}
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
