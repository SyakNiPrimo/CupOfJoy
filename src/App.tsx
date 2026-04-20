import { useEffect, useMemo, useState } from 'react';
import AttendancePanel from './components/AttendancePanel';
import DashboardPanel from './components/DashboardPanel';
import POSPanel from './components/POSPanel';
import logo from './assets/logo.png';
import { supabase } from './lib/supabase';

type Tab = 'attendance' | 'dashboard' | 'pos';

type StaffIdentity = {
  employeeId?: string;
  employeeNumber?: string;
  employeeName?: string;
  qrToken?: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'owner' | 'staff';
  is_active: boolean;
};

function readLastStaff(): StaffIdentity | null {
  try {
    const raw = localStorage.getItem('coj_last_staff');
    if (!raw) return null;
    return JSON.parse(raw) as StaffIdentity;
  } catch {
    return null;
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('attendance');
  const [staffIdentity, setStaffIdentity] = useState<StaffIdentity | null>(() => readLastStaff());
  const [ownerProfile, setOwnerProfile] = useState<ProfileRow | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [ownerLoginOpen, setOwnerLoginOpen] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const syncStaff = () => {
      const currentStaff = readLastStaff();
      setStaffIdentity(currentStaff);

      if (currentStaff?.qrToken) {
        setTab('pos');
      } else if (!ownerProfile) {
        setTab('attendance');
      }
    };

    window.addEventListener('coj-staff-updated', syncStaff);
    return () => window.removeEventListener('coj-staff-updated', syncStaff);
  }, [ownerProfile]);

  useEffect(() => {
    let active = true;

    async function refreshOwner() {
      setOwnerLoading(true);

      const { data, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !data.user) {
        setOwnerProfile(null);
        setOwnerLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, is_active')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        setAuthError(profileError.message);
        setOwnerProfile(null);
        setOwnerLoading(false);
        return;
      }

      if (!profile || profile.role !== 'owner' || !profile.is_active) {
        await supabase.auth.signOut();
        setOwnerProfile(null);
        setAuthError('This account is not allowed to access the owner dashboard.');
        setOwnerLoading(false);
        return;
      }

      setOwnerProfile(profile as ProfileRow);
      setOwnerLoginOpen(false);
      setTab('dashboard');
      setOwnerLoading(false);
    }

    void refreshOwner();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshOwner();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const activeRole = useMemo(() => {
    if (ownerProfile) return 'admin';
    if (staffIdentity?.qrToken) return 'staff';
    return 'none';
  }, [ownerProfile, staffIdentity?.qrToken]);

  useEffect(() => {
    if (activeRole === 'none' && tab !== 'attendance') {
      setTab('attendance');
    }

    if (activeRole === 'staff' && tab === 'dashboard') {
      setTab('pos');
    }
  }, [activeRole, tab]);

  async function signInOwner() {
    try {
      setAuthBusy(true);
      setAuthError('');

      const { error } = await supabase.auth.signInWithPassword({
        email: ownerEmail,
        password: ownerPassword,
      });

      if (error) throw error;
      setOwnerPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.';
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOutOwner() {
    await supabase.auth.signOut();
    setOwnerProfile(null);
    setTab(staffIdentity?.qrToken ? 'pos' : 'attendance');
  }

  const showAttendance = tab === 'attendance';
  const showDashboard = activeRole === 'admin' && tab === 'dashboard';
  const showPOS = activeRole !== 'none' && tab === 'pos';

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
            <div className="muted">
              {activeRole === 'admin'
                ? 'Owner dashboard'
                : activeRole === 'staff'
                  ? `Active staff: ${staffIdentity?.employeeName || 'Staff'}`
                  : 'Time in or time out to begin'}
            </div>
          </div>
        </div>

        <div className="tab-row wrap">
          <button
            className={tab === 'attendance' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setTab('attendance')}
            type="button"
          >
            Attendance
          </button>

          {activeRole === 'admin' ? (
            <button
              className={tab === 'dashboard' ? 'tab-btn active' : 'tab-btn'}
              onClick={() => setTab('dashboard')}
              type="button"
            >
              Dashboard
            </button>
          ) : null}

          {activeRole !== 'none' ? (
            <button
              className={tab === 'pos' ? 'tab-btn active' : 'tab-btn'}
              onClick={() => setTab('pos')}
              type="button"
            >
              POS
            </button>
          ) : null}

          {ownerProfile ? (
            <button className="ghost-btn" onClick={signOutOwner} type="button">
              Sign Out Owner
            </button>
          ) : (
            <button
              className="ghost-btn"
              onClick={() => {
                setOwnerLoginOpen((open) => !open);
                setAuthError('');
              }}
              type="button"
            >
              Owner Login
            </button>
          )}
        </div>
      </header>

      {ownerLoginOpen && !ownerProfile ? (
        <div className="panel" style={{ marginBottom: '18px' }}>
          <div className="section-title">Owner Login</div>
          <p className="muted">Owner access opens the admin dashboard.</p>

          <div className="action-row wrap">
            <input
              type="email"
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              placeholder="Owner email"
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid #d7c9b6',
                minWidth: '220px',
              }}
            />
            <input
              type="password"
              value={ownerPassword}
              onChange={(event) => setOwnerPassword(event.target.value)}
              placeholder="Password"
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid #d7c9b6',
                minWidth: '220px',
              }}
            />
            <button className="secondary-btn" onClick={signInOwner} type="button" disabled={authBusy}>
              {authBusy ? 'Signing In...' : 'Sign In'}
            </button>
          </div>

          {authError ? <div className="error-box">{authError}</div> : null}
        </div>
      ) : null}

      {ownerLoading ? <div className="info-box">Checking access...</div> : null}

      {showAttendance ? (
        <AttendancePanel onGoToPOS={() => setTab('pos')} />
      ) : showDashboard ? (
        <DashboardPanel forcedMode="admin" />
      ) : showPOS ? (
        <POSPanel />
      ) : (
        <AttendancePanel onGoToPOS={() => setTab('pos')} />
      )}
    </div>
  );
}
