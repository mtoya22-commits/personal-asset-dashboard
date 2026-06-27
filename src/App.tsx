import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import type { TabId } from './types/index.js';
import { useAppData } from './hooks/useAppData.js';
import { useMask } from './hooks/useMask.js';
import { Dashboard } from './features/dashboard/Dashboard.js';
import { Holdings } from './features/holdings/Holdings.js';
import { MonthlyUpdate } from './features/monthly-update/MonthlyUpdate.js';
import { Allocation } from './features/allocation/Allocation.js';
import { HistoryAndSettings } from './features/snapshots/HistoryAndSettings.js';
import { ja } from './strings/ja.js';

const LAST_TAB_KEY = 'pad:last-viewed-tab';

const NAV_ITEMS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: ja.tabs.dashboard, icon: '📊' },
  { id: 'holdings', label: ja.tabs.holdings, icon: '💼' },
  { id: 'monthly-update', label: ja.tabs.monthlyUpdate, icon: '📝' },
  { id: 'allocation', label: ja.tabs.allocation, icon: '🥧' },
  { id: 'history', label: ja.tabs.history, icon: '📅' },
];

export default function App() {
  const [tab, setTab] = useState<TabId>(() => {
    try {
      const stored = localStorage.getItem(LAST_TAB_KEY) as TabId | null;
      if (stored && NAV_ITEMS.some((n) => n.id === stored)) return stored;
    } catch { /* ignore */ }
    return 'dashboard';
  });

  const data = useAppData();
  const { masked, toggleMask } = useMask(data.settings.maskAmountsOnLaunch);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    try {
      localStorage.setItem(LAST_TAB_KEY, tab);
    } catch { /* ignore */ }
  }, [tab]);

  if (data.loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          color: 'var(--color-text-3)',
        }}
      >
        {ja.common.loading}
      </div>
    );
  }

  if (data.error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          padding: 24,
          gap: 12,
        }}
      >
        <div style={{ color: 'var(--color-down)' }}>{ja.common.error}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-3)' }}>{data.error}</div>
        <button className="btn btn-primary" onClick={data.reload}>再読み込み</button>
      </div>
    );
  }

  return (
    <>
      {/* PWA update banner */}
      {needRefresh && (
        <div className="pwa-banner" role="alert">
          <span>{ja.pwa.updateAvailable}</span>
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
            onClick={() => updateServiceWorker(true)}
            aria-label={ja.pwa.updateButton}
          >
            {ja.pwa.updateButton}
          </button>
        </div>
      )}

      {/* App header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          position: 'sticky',
          top: needRefresh ? 44 : 0,
          zIndex: 40,
        }}
      >
        <h1
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--color-primary)',
          }}
        >
          {ja.appName}
        </h1>
        <button
          className="mask-toggle"
          onClick={toggleMask}
          aria-label={masked ? '金額を表示' : '金額を隠す'}
          title={masked ? '金額を表示' : '金額を隠す'}
        >
          {masked ? '👁️' : '🙈'}
        </button>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, minHeight: 0 }}>
        {tab === 'dashboard' && (
          <Dashboard
            data={data}
            masked={masked}
            onGoToSettings={() => setTab('history')}
            onGoToMonthlyUpdate={() => setTab('monthly-update')}
          />
        )}
        {tab === 'holdings' && <Holdings data={data} masked={masked} />}
        {tab === 'monthly-update' && <MonthlyUpdate data={data} masked={masked} />}
        {tab === 'allocation' && <Allocation data={data} masked={masked} />}
        {tab === 'history' && <HistoryAndSettings data={data} masked={masked} />}
      </main>

      {/* Bottom navigation */}
      <nav className="nav" aria-label="メインナビゲーション">
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`nav-item${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
            aria-label={label}
            aria-current={tab === id ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
