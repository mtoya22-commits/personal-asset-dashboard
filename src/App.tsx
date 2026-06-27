import { useState, useEffect, useCallback } from 'react';
import type { SVGProps } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import type { TabId } from './types/index.js';
import { useAppData } from './hooks/useAppData.js';
import { useMask } from './hooks/useMask.js';
import { hasUnsavedChanges } from './hooks/useUnsavedChanges.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { Dashboard } from './features/dashboard/Dashboard.js';
import { Holdings } from './features/holdings/Holdings.js';
import { MonthlyUpdate } from './features/monthly-update/MonthlyUpdate.js';
import { Allocation } from './features/allocation/Allocation.js';
import { HistoryAndSettings } from './features/snapshots/HistoryAndSettings.js';
import {
  EyeIcon,
  EyeOffIcon,
  GridIcon,
  BriefcaseIcon,
  PencilIcon,
  PieChartIcon,
  ClockIcon,
} from './components/icons/index.js';
import { ja } from './strings/ja.js';

const LAST_TAB_KEY = 'pad:last-viewed-tab';

type IconComponent = (props: SVGProps<SVGSVGElement> & { size?: number }) => React.ReactElement;

type NavItem = {
  id: TabId;
  label: string;
  Icon: IconComponent;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: '概要', Icon: GridIcon },
  { id: 'holdings', label: '資産', Icon: BriefcaseIcon },
  { id: 'monthly-update', label: '更新', Icon: PencilIcon },
  { id: 'allocation', label: '配分', Icon: PieChartIcon },
  { id: 'history', label: '履歴', Icon: ClockIcon },
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

  const [updatePending, setUpdatePending] = useState(false);

  const handleUpdateClick = useCallback(() => {
    if (hasUnsavedChanges()) {
      setUpdatePending(true);
    } else {
      updateServiceWorker(true);
    }
  }, [updateServiceWorker]);

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
          color: 'var(--text-subtle)',
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
        <div style={{ color: 'var(--negative)' }}>{ja.common.error}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)' }}>{data.error}</div>
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
            onClick={handleUpdateClick}
            aria-label={ja.pwa.updateButton}
          >
            {ja.pwa.updateButton}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={updatePending}
        title={ja.pwa.updateConfirmTitle}
        message={ja.pwa.updateConfirmMessage}
        confirmLabel={ja.pwa.updateButton}
        cancelLabel={ja.pwa.updateCancelLabel}
        onConfirm={() => { setUpdatePending(false); updateServiceWorker(true); }}
        onCancel={() => setUpdatePending(false)}
      />

      {/* App header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: needRefresh ? 44 : 0,
          zIndex: 40,
        }}
      >
        <h1
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--brand)',
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
          {masked ? <EyeIcon size={20} /> : <EyeOffIcon size={20} />}
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
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
            aria-label={label}
            aria-current={tab === id ? 'page' : undefined}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
