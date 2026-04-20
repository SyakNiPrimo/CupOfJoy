import { useState } from 'react';
import AttendancePanel from './components/AttendancePanel';
import DashboardPanel from './components/DashboardPanel';
import POSPanel from './components/POSPanel';
import logo from './assets/logo.png';

type Tab = 'attendance' | 'dashboard' | 'pos';

export default function App() {
  const [tab, setTab] = useState<Tab>('attendance');

  return (
    <div className="app-shell">
      <header className="app-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <img
            src={logo}
            alt="Cup of Joy logo"
            style={{
              width: '64px',
              height: '64px',
              objectFit: 'contain',
              borderRadius: '14px',
              background: 'transparent',
              flexShrink: 0,
            }}
          />

          <div>
            <div className="brand-title">Cup of Joy Staff App</div>
            <div className="muted">Attendance, dashboard, and POS in one flow</div>
          </div>
        </div>

        <div className="tab-row">
          <button
            className={tab === 'attendance' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setTab('attendance')}
            type="button"
          >
            Attendance
          </button>

          <button
            className={tab === 'dashboard' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setTab('dashboard')}
            type="button"
          >
            Dashboard
          </button>

          <button
            className={tab === 'pos' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setTab('pos')}
            type="button"
          >
            POS
          </button>
        </div>
      </header>

      {tab === 'attendance' ? (
        <AttendancePanel onGoToPOS={() => setTab('pos')} />
      ) : tab === 'dashboard' ? (
        <DashboardPanel />
      ) : (
        <POSPanel />
      )}
    </div>
  );
}
