import { useEffect, useMemo, useState } from 'react';
import AttendancePanel from './components/AttendancePanel';
import DashboardPanel from './components/DashboardPanel';
import POSPanel from './components/POSPanel';
import logo from './assets/logo.png';
import { supabase } from './lib/supabase';

type Tab = 'home' | 'attendance' | 'owner-login' | 'dashboard' | 'pos';

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

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '8px',
  border: '1px solid #d7c9b6',
  minWidth: '220px',
  width: '100%',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [staffIdentity, setStaffIdentity] = useState<StaffIdentity | null>(() => readLastStaff());
  const [ownerProfile, setOwnerProfile] = useState<ProfileRow | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  useEffect(() => {
    const syncStaff = () => {
      const currentStaff = readLastStaff();
      setStaffIdentity(currentStaff);

      if (currentStaff?.qrToken) {
        setTab('pos');
      } else if (!ownerProfile) {
        setTab('home');
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
    if (activeRole === 'none' && (tab === 'dashboard' || tab === 'pos')) {
      setTab('home');
    }

    if (activeRole === 'staff' && tab === 'dashboard') {
      setTab('pos');
    }
  }, [activeRole, tab]);

  async function signInOwner() {
    try {
      setAuthBusy(true);
      setAuthError('');
      setAuthMessage('');

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

  async function sendPasswordReset() {
    try {
      setAuthBusy(true);
      setAuthError('');
      setAuthMessage('');

      if (!ownerEmail) {
        throw new Error('Enter your owner email first.');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(ownerEmail, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setAuthMessage('Password reset email sent. Check your inbox.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send password reset.';
      setAuthError(message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOutOwner() {
    await supabase.auth.signOut();
    setOwnerProfile(null);
    setTab(staffIdentity?.qrToken ? 'pos' : 'home');
  }

  const showHeaderNav = activeRole !== 'none';

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
              borderRadius: '8px',
              background: 'transparent',
              flexShrink: 0,
            }}
          />

          <div>
            <div className="brand-title">Cup of Joy</div>
            <div className="muted">
              {activeRole === 'admin'
                ? 'Owner dashboard'
                : activeRole === 'staff'
                  ? `Active staff: ${staffIdentity?.employeeName || 'Staff'}`
                  : 'Choose how you want to continue'}
            </div>
          </div>
        </div>

        {showHeaderNav ? (
          <div className="tab-row wrap">
            <button
              className={tab === 'attendance' ? 'tab-btn active' : 'tab-btn'}
              onClick={() => setTab('attendance')}
              type="button"
            >
              Staff Time In / Out
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

            <button
              className={tab === 'pos' ? 'tab-btn active' : 'tab-btn'}
              onClick={() => setTab('pos')}
              type="button"
            >
              POS
            </button>

            {ownerProfile ? (
              <button className="ghost-btn" onClick={signOutOwner} type="button">
                Sign Out Owner
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      {ownerLoading ? <div className="info-box">Checking access...</div> : null}

      {tab === 'home' ? (
        <div className="grid-two">
          <button
            className="panel"
            onClick={() => setTab('attendance')}
            type="button"
            style={{
              textAlign: 'left',
              minHeight: '220px',
              cursor: 'pointer',
            }}
          >
            <div className="section-title">Staff Login</div>
            <p className="muted">Time in, time out, then continue to POS after a successful staff login.</p>
            <div className="primary-btn" style={{ display: 'inline-block', marginTop: '18px' }}>
              Continue as Staff
            </div>
          </button>

          <button
            className="panel"
            onClick={() => {
              setTab('owner-login');
              setAuthError('');
              setAuthMessage('');
            }}
            type="button"
            style={{
              textAlign: 'left',
              minHeight: '220px',
              cursor: 'pointer',
            }}
          >
            <div className="section-title">Owner Login</div>
            <p className="muted">Sign in with owner email and password to open the admin dashboard.</p>
            <div className="secondary-btn" style={{ display: 'inline-block', marginTop: '18px' }}>
              Continue as Owner
            </div>
          </button>
        </div>
      ) : null}

      {tab === 'owner-login' ? (
        <div className="panel" style={{ maxWidth: '560px', margin: '0 auto' }}>
          <button className="ghost-btn" onClick={() => setTab('home')} type="button">
            Back
          </button>

          <div className="section-title" style={{ marginTop: '16px' }}>
            Owner Login
          </div>
          <p className="muted">Use your owner email and password.</p>

          <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
            <input
              type="email"
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              placeholder="Owner email"
              style={inputStyle}
            />
            <input
              type="password"
              value={ownerPassword}
              onChange={(event) => setOwnerPassword(event.target.value)}
              placeholder="Password"
              style={inputStyle}
            />

            <button className="primary-btn" onClick={signInOwner} type="button" disabled={authBusy}>
              {authBusy ? 'Signing In...' : 'Sign In'}
            </button>

            <button className="ghost-btn" onClick={sendPasswordReset} type="button" disabled={authBusy}>
              Forgot password?
            </button>
          </div>

          {authError ? <div className="error-box">{authError}</div> : null}
          {authMessage ? <div className="success-box">{authMessage}</div> : null}
        </div>
      ) : null}

      {tab === 'attendance' ? (
        <AttendancePanel onBack={() => setTab('home')} onGoToPOS={() => setTab('pos')} />
      ) : null}

      {activeRole === 'admin' && tab === 'dashboard' ? <DashboardPanel forcedMode="admin" /> : null}

      {activeRole !== 'none' && tab === 'pos' ? <POSPanel /> : null}
    </div>
  );
}
