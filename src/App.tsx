import { useEffect, useMemo, useState } from 'react';
import AttendancePanel from './components/AttendancePanel';
import AccountPanel from './components/AccountPanel';
import AdminAttendancePanel from './components/AdminAttendancePanel';
import AdminDashboardPanel from './components/AdminDashboardPanel';
import AdminPayrollPanel from './components/AdminPayrollPanel';
import AdminPeopleOpsPanel from './components/AdminPeopleOpsPanel';
import EmployeeAdminPanel from './components/EmployeeAdminPanel';
import POSPanel from './components/POSPanel';
import SalesAdminPanel from './components/SalesAdminPanel';
import StaffAttendanceHistoryPanel from './components/StaffAttendanceHistoryPanel';
import StaffContractPanel from './components/StaffContractPanel';
import StaffLeavePanel from './components/StaffLeavePanel';
import StaffSalesHistoryPanel from './components/StaffSalesHistoryPanel';
import logo from './assets/logo.png';
import { supabase } from './lib/supabase';

type Tab =
  | 'home'
  | 'attendance'
  | 'management-login'
  | 'portal-login'
  | 'admin-dashboard'
  | 'admin-employees'
  | 'admin-payroll'
  | 'admin-attendance'
  | 'admin-people'
  | 'admin-sales'
  | 'admin-account'
  | 'staff-sales'
  | 'staff-attendance'
  | 'staff-contract'
  | 'staff-leave'
  | 'pos';

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
  role: 'owner' | 'admin' | 'staff';
  is_active: boolean;
};

type PortalEmployee = {
  id: string;
  employeeNumber?: string | null;
  employeeName: string;
  employeeEmail?: string | null;
  isActive: boolean;
  contractStatus?: string | null;
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
  border: '1px solid #ecd8a2',
  minWidth: '220px',
  width: '100%',
  background: 'rgba(255, 253, 247, 0.96)',
  color: '#2f2419',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [staffIdentity, setStaffIdentity] = useState<StaffIdentity | null>(() => readLastStaff());
  const [managementProfile, setManagementProfile] = useState<ProfileRow | null>(null);
  const [staffPortalProfile, setStaffPortalProfile] = useState<ProfileRow | null>(null);
  const [portalEmployee, setPortalEmployee] = useState<PortalEmployee | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [managementEmail, setManagementEmail] = useState('');
  const [managementPassword, setManagementPassword] = useState('');
  const [managementFullName, setManagementFullName] = useState('');
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [portalFullName, setPortalFullName] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<'management' | 'staff' | null>(null);

  useEffect(() => {
    const syncStaff = () => {
      const currentStaff = readLastStaff();
      setStaffIdentity(currentStaff);

      if (currentStaff?.qrToken) {
        setTab('pos');
      } else if (!managementProfile && !staffPortalProfile) {
        setTab('home');
      } else if (staffPortalProfile && tab === 'pos') {
        setTab('staff-attendance');
      }
    };

    window.addEventListener('coj-staff-updated', syncStaff);
    return () => window.removeEventListener('coj-staff-updated', syncStaff);
  }, [managementProfile, staffPortalProfile, tab]);

  async function loadPortalIdentity() {
    const { data, error } = await supabase.rpc('staff_portal_identity');
    if (error) throw error;
    if (!data?.success) throw new Error(data?.message || 'No linked employee portal access found.');
    setPortalEmployee(data.employee as PortalEmployee);
  }

  useEffect(() => {
    let active = true;

    async function refreshAuth() {
      setAuthLoading(true);

      const { data, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !data.user) {
        setManagementProfile(null);
        setStaffPortalProfile(null);
        setPortalEmployee(null);
        setAuthLoading(false);
        return;
      }

      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, is_active')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile && !profileError) {
        await supabase.rpc('claim_management_access');
        await supabase.rpc('claim_staff_portal_access');
        const retry = await supabase
          .from('profiles')
          .select('id, email, full_name, role, is_active')
          .eq('id', data.user.id)
          .maybeSingle();
        profile = retry.data as ProfileRow | null;
        profileError = retry.error;
      }

      if (!active) return;

      if (profileError) {
        setAuthError(profileError.message);
        setManagementProfile(null);
        setStaffPortalProfile(null);
        setPortalEmployee(null);
        setAuthLoading(false);
        return;
      }

      if (!profile || !profile.is_active) {
        await supabase.auth.signOut();
        setManagementProfile(null);
        setStaffPortalProfile(null);
        setPortalEmployee(null);
        setAuthError('This account is not linked to an active Cup of Joy access record.');
        setAuthLoading(false);
        return;
      }

      if (!profile) {
        await supabase.auth.signOut();
        setManagementProfile(null);
        setStaffPortalProfile(null);
        setPortalEmployee(null);
        setAuthError('No linked access profile was found for this account.');
        setAuthLoading(false);
        setAuthIntent(null);
        return;
      }

      if (authIntent === 'management' && profile.role === 'staff') {
        const claimResult = await supabase.rpc('claim_management_access');
        if (!active) return;

        if (!claimResult.error && claimResult.data?.success) {
          const retry = await supabase
            .from('profiles')
            .select('id, email, full_name, role, is_active')
            .eq('id', data.user.id)
            .maybeSingle();
          profile = retry.data as ProfileRow | null;
          profileError = retry.error;
        }
      }

      if (!profile) {
        await supabase.auth.signOut();
        setManagementProfile(null);
        setStaffPortalProfile(null);
        setPortalEmployee(null);
        setAuthError('No linked access profile was found for this account.');
        setAuthLoading(false);
        setAuthIntent(null);
        return;
      }

      if (authIntent === 'management' && profile.role === 'staff') {
        await supabase.auth.signOut();
        setManagementProfile(null);
        setStaffPortalProfile(null);
        setPortalEmployee(null);
        setAuthError('This email is linked to the employee portal, not to owner/admin access.');
        setAuthLoading(false);
        setAuthIntent(null);
        return;
      }

      if (authIntent === 'staff' && (profile.role === 'owner' || profile.role === 'admin')) {
        await supabase.auth.signOut();
        setManagementProfile(null);
        setStaffPortalProfile(null);
        setPortalEmployee(null);
        setAuthError('This email is linked to owner/admin access. Please use the Owner / Admin Login screen.');
        setAuthLoading(false);
        setAuthIntent(null);
        return;
      }

      if (profile.role === 'owner' || profile.role === 'admin') {
        setManagementProfile(profile as ProfileRow);
        setStaffPortalProfile(null);
        setPortalEmployee(null);
        setTab((currentTab) =>
          currentTab.startsWith('admin-') || currentTab === 'pos' ? currentTab : 'admin-dashboard',
        );
      } else {
        setManagementProfile(null);
        setStaffPortalProfile(profile as ProfileRow);
        try {
          await loadPortalIdentity();
        } catch (portalError) {
          await supabase.auth.signOut();
          setStaffPortalProfile(null);
          setPortalEmployee(null);
          setAuthError(portalError instanceof Error ? portalError.message : 'Unable to load staff portal access.');
          setAuthLoading(false);
          return;
        }
        setTab((currentTab) => {
          if (currentTab.startsWith('staff-') || currentTab === 'attendance' || currentTab === 'pos') {
            return currentTab;
          }
          return staffIdentity?.qrToken ? 'pos' : 'staff-attendance';
        });
      }

      setAuthIntent(null);
      setAuthLoading(false);
    }

    void refreshAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshAuth();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [staffIdentity?.qrToken]);

  const activeRole = useMemo(() => {
    if (managementProfile) return 'admin';
    if (staffPortalProfile || staffIdentity?.qrToken) return 'staff';
    return 'none';
  }, [managementProfile, staffPortalProfile, staffIdentity?.qrToken]);

  const hasPosAccess = Boolean(staffIdentity?.qrToken);

  useEffect(() => {
    if (activeRole === 'none' && (tab.startsWith('admin-') || tab.startsWith('staff-') || tab === 'pos')) {
      setTab('home');
    }

    if (activeRole === 'staff' && tab.startsWith('admin-')) {
      setTab(hasPosAccess ? 'pos' : 'staff-attendance');
    }

    if (activeRole === 'admin' && tab.startsWith('staff-')) {
      setTab('admin-dashboard');
    }

    if (!hasPosAccess && tab === 'pos' && activeRole !== 'admin') {
      setTab('staff-attendance');
    }
  }, [activeRole, hasPosAccess, tab]);

  useEffect(() => {
    if (!managementProfile) {
      return;
    }

    let timeoutId = window.setTimeout(() => {
      void signOutCurrentUser();
    }, 15 * 60 * 1000);

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void signOutCurrentUser();
      }, 15 * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('mousedown', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('mousedown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [managementProfile]);

  async function signInManagement() {
    try {
      setAuthBusy(true);
      setAuthError('');
      setAuthMessage('');
      setAuthIntent('management');

      const { error } = await supabase.auth.signInWithPassword({
        email: managementEmail,
        password: managementPassword,
      });

      if (error) throw error;
      setManagementPassword('');
    } catch (error) {
      setAuthIntent(null);
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function createManagementAccount() {
    try {
      setAuthBusy(true);
      setAuthError('');
      setAuthMessage('');
      setAuthIntent('management');

      const { data, error } = await supabase.auth.signUp({
        email: managementEmail,
        password: managementPassword,
        options: {
          data: {
            full_name: managementFullName || undefined,
          },
        },
      });

      if (error) throw error;
      if (!data.session) {
        setAuthMessage('Account created. Complete any verification email, then sign in with the invited management email.');
      } else {
        setAuthMessage('Management account created and linked.');
      }
      setManagementPassword('');
    } catch (error) {
      setAuthIntent(null);
      setAuthError(error instanceof Error ? error.message : 'Unable to create management account.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function signInPortal() {
    try {
      setAuthBusy(true);
      setAuthError('');
      setAuthMessage('');
      setAuthIntent('staff');

      const { error } = await supabase.auth.signInWithPassword({
        email: portalEmail,
        password: portalPassword,
      });

      if (error) throw error;
      setPortalPassword('');
    } catch (error) {
      setAuthIntent(null);
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function createPortalAccount() {
    try {
      setAuthBusy(true);
      setAuthError('');
      setAuthMessage('');
      setAuthIntent('staff');

      const { data, error } = await supabase.auth.signUp({
        email: portalEmail,
        password: portalPassword,
        options: {
          data: {
            full_name: portalFullName || undefined,
          },
        },
      });

      if (error) throw error;
      if (!data.session) {
        setAuthMessage('Portal account created. Complete any verification email, then sign in using the employee email on file.');
      } else {
        setAuthMessage('Portal account created and linked to the employee record.');
      }
      setPortalPassword('');
    } catch (error) {
      setAuthIntent(null);
      setAuthError(error instanceof Error ? error.message : 'Unable to create portal account.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function sendPasswordReset(email: string) {
    try {
      setAuthBusy(true);
      setAuthError('');
      setAuthMessage('');

      if (!email) {
        throw new Error('Enter the email first.');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) throw error;

      setAuthMessage('Password reset email sent. Check the inbox for that account.');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to send password reset.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOutCurrentUser() {
    await supabase.auth.signOut();
    setManagementProfile(null);
    setStaffPortalProfile(null);
    setPortalEmployee(null);
    setSidebarOpen(false);
    setTab(staffIdentity?.qrToken ? 'pos' : 'home');
  }

  function handleStaffLoggedOut() {
    setStaffIdentity(null);
    setTab(staffPortalProfile ? 'staff-attendance' : 'home');
  }

  const showHeaderNav = activeRole !== 'none';
  const adminMenuItems: Array<{ tab: Tab; label: string }> = [
    { tab: 'admin-dashboard', label: 'Dashboard' },
    { tab: 'admin-employees', label: 'Employee Onboarding' },
    { tab: 'admin-payroll', label: 'Payroll' },
    { tab: 'admin-attendance', label: 'Attendance Corrections' },
    { tab: 'admin-people', label: 'People Ops' },
    { tab: 'admin-sales', label: 'Sales History' },
    { tab: 'admin-account', label: 'Account' },
    { tab: 'pos', label: 'POS' },
  ];
  const staffMenuItems: Array<{ tab: Tab; label: string }> = [
    ...(hasPosAccess ? [{ tab: 'pos' as Tab, label: 'POS' }] : []),
    { tab: 'staff-sales', label: 'Sales History' },
    { tab: 'staff-attendance', label: 'Attendance History' },
    { tab: 'staff-leave', label: 'Leave' },
    { tab: 'staff-contract', label: 'Contract' },
    { tab: 'attendance', label: 'Time In / Out' },
  ];

  function selectRoleTab(nextTab: Tab) {
    setTab(nextTab);
    setSidebarOpen(false);
  }

  const appContent = (
    <>
      {authLoading ? <div className="info-box">Checking access...</div> : null}

      {tab === 'home' ? (
        <div className="grid-two">
          <button
            className="panel"
            onClick={() => {
              setTab('portal-login');
              setAuthError('');
              setAuthMessage('');
            }}
            type="button"
            style={{ textAlign: 'left', minHeight: '220px', cursor: 'pointer' }}
          >
            <div className="section-title">Employee Portal</div>
            <p className="muted">Use your employee email and password to review attendance, payroll, leave, and contract anytime.</p>
            <div className="secondary-btn" style={{ display: 'inline-block', marginTop: '18px' }}>
              Employee Login
            </div>
          </button>

          <button
            className="panel"
            onClick={() => {
              setTab('management-login');
              setAuthError('');
              setAuthMessage('');
            }}
            type="button"
            style={{ textAlign: 'left', minHeight: '220px', cursor: 'pointer' }}
          >
            <div className="section-title">Owner / Admin Login</div>
            <p className="muted">Sign in with a management account to open the operations dashboard.</p>
            <div className="secondary-btn" style={{ display: 'inline-block', marginTop: '18px' }}>
              Management Login
            </div>
          </button>
        </div>
      ) : null}

      {tab === 'management-login' ? (
        <div className="panel" style={{ maxWidth: '560px', margin: '0 auto' }}>
          <button className="ghost-btn" onClick={() => setTab('home')} type="button">
            Back
          </button>

          <div className="section-title" style={{ marginTop: '16px' }}>
            Owner / Admin Login
          </div>
          <p className="muted">Use an invited management email and password. New admin accounts must be invited first from the account page.</p>

          <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
            <input
              type="text"
              value={managementFullName}
              onChange={(event) => setManagementFullName(event.target.value)}
              placeholder="Full name (for first-time setup)"
              style={inputStyle}
            />
            <input
              type="email"
              value={managementEmail}
              onChange={(event) => setManagementEmail(event.target.value)}
              placeholder="Management email"
              style={inputStyle}
            />
            <input
              type="password"
              value={managementPassword}
              onChange={(event) => setManagementPassword(event.target.value)}
              placeholder="Password"
              style={inputStyle}
            />

            <button className="primary-btn" onClick={signInManagement} type="button" disabled={authBusy}>
              {authBusy ? 'Signing In...' : 'Sign In'}
            </button>

            <button className="secondary-btn" onClick={createManagementAccount} type="button" disabled={authBusy}>
              {authBusy ? 'Creating...' : 'Create Invited Account'}
            </button>

            <button className="ghost-btn" onClick={() => void sendPasswordReset(managementEmail)} type="button" disabled={authBusy}>
              Forgot password?
            </button>
          </div>

          {authError ? <div className="error-box">{authError}</div> : null}
          {authMessage ? <div className="success-box">{authMessage}</div> : null}
        </div>
      ) : null}

      {tab === 'portal-login' ? (
        <div className="panel" style={{ maxWidth: '560px', margin: '0 auto' }}>
          <button className="ghost-btn" onClick={() => setTab('home')} type="button">
            Back
          </button>

          <div className="section-title" style={{ marginTop: '16px' }}>
            Employee Portal
          </div>
          <p className="muted">Use the employee email on file. If this is the first login, create the portal password first.</p>

          <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
            <input
              type="text"
              value={portalFullName}
              onChange={(event) => setPortalFullName(event.target.value)}
              placeholder="Full name (for first-time setup)"
              style={inputStyle}
            />
            <input
              type="email"
              value={portalEmail}
              onChange={(event) => setPortalEmail(event.target.value)}
              placeholder="Employee email"
              style={inputStyle}
            />
            <input
              type="password"
              value={portalPassword}
              onChange={(event) => setPortalPassword(event.target.value)}
              placeholder="Password"
              style={inputStyle}
            />

            <button className="primary-btn" onClick={signInPortal} type="button" disabled={authBusy}>
              {authBusy ? 'Signing In...' : 'Sign In'}
            </button>

            <button className="secondary-btn" onClick={createPortalAccount} type="button" disabled={authBusy}>
              {authBusy ? 'Creating...' : 'Create Portal Password'}
            </button>

            <button className="ghost-btn" onClick={() => void sendPasswordReset(portalEmail)} type="button" disabled={authBusy}>
              Forgot password?
            </button>
          </div>

          {authError ? <div className="error-box">{authError}</div> : null}
          {authMessage ? <div className="success-box">{authMessage}</div> : null}
        </div>
      ) : null}

      {tab === 'attendance' ? (
        <AttendancePanel
          onBack={() => setTab(staffPortalProfile ? 'staff-attendance' : 'home')}
          onGoToPOS={() => setTab('pos')}
          onStaffLoggedOut={handleStaffLoggedOut}
        />
      ) : null}

      {activeRole === 'admin' && tab === 'admin-dashboard' ? <AdminDashboardPanel /> : null}
      {activeRole === 'admin' && tab === 'admin-employees' ? <EmployeeAdminPanel /> : null}
      {activeRole === 'admin' && tab === 'admin-payroll' ? <AdminPayrollPanel /> : null}
      {activeRole === 'admin' && tab === 'admin-attendance' ? <AdminAttendancePanel /> : null}
      {activeRole === 'admin' && tab === 'admin-people' ? <AdminPeopleOpsPanel /> : null}
      {activeRole === 'admin' && tab === 'admin-sales' ? <SalesAdminPanel /> : null}
      {activeRole === 'admin' && tab === 'admin-account' && managementProfile ? (
        <AccountPanel ownerProfile={managementProfile} onSignedOut={signOutCurrentUser} />
      ) : null}

      {(activeRole === 'admin' || hasPosAccess) && tab === 'pos' ? <POSPanel /> : null}

      {activeRole === 'staff' && tab === 'staff-sales' ? <StaffSalesHistoryPanel qrToken={staffIdentity?.qrToken ?? null} /> : null}
      {activeRole === 'staff' && tab === 'staff-attendance' ? (
        <StaffAttendanceHistoryPanel qrToken={staffIdentity?.qrToken ?? null} />
      ) : null}
      {activeRole === 'staff' && tab === 'staff-leave' ? <StaffLeavePanel qrToken={staffIdentity?.qrToken ?? null} /> : null}
      {activeRole === 'staff' && tab === 'staff-contract' ? (
        <StaffContractPanel qrToken={staffIdentity?.qrToken ?? null} />
      ) : null}
    </>
  );

  const sidebarItems = activeRole === 'admin' ? adminMenuItems : staffMenuItems;
  const sidebarTitle =
    activeRole === 'admin' ? 'Cup of Joy' : portalEmployee?.employeeName || staffIdentity?.employeeName || 'Staff';
  const sidebarSubtitle =
    activeRole === 'admin'
      ? managementProfile?.role === 'admin'
        ? 'Admin'
        : 'Owner'
      : portalEmployee?.employeeNumber || staffIdentity?.employeeNumber || 'Staff';

  return (
    <div className={activeRole !== 'none' ? 'owner-layout' : 'app-shell'}>
      {activeRole !== 'none' ? (
        <aside className={sidebarOpen ? 'owner-sidebar open' : 'owner-sidebar'}>
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <img
                src={logo}
                alt="Cup of Joy logo"
                style={{
                  width: '52px',
                  height: '52px',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.34)',
                  padding: '4px',
                  boxShadow: '0 8px 20px rgba(80, 51, 25, 0.12)',
                  flexShrink: 0,
                }}
              />
              <div>
                <div className="section-title" style={{ marginBottom: '2px' }}>
                  Cup of Joy
                </div>
                <div className="muted small">
                  {activeRole === 'admin' ? 'Operations' : 'Employee Portal'}
                </div>
              </div>
            </div>
            <div className="section-title">{sidebarTitle}</div>
            <p className="muted">{sidebarSubtitle}</p>
          </div>

          <nav className="owner-nav">
            {sidebarItems.map((item) => (
              <button
                className={tab === item.tab ? 'owner-nav-btn active' : 'owner-nav-btn'}
                key={item.tab}
                onClick={() => selectRoleTab(item.tab)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="owner-sidebar-footer">
            {activeRole === 'admin' ? (
              <>
                <div className="muted small">Auto sign-out after 15 minutes idle.</div>
                <button className="ghost-btn full-width" onClick={signOutCurrentUser} type="button">
                  Sign Out
                </button>
              </>
            ) : staffPortalProfile ? (
              <>
                <div className="muted small">
                  {hasPosAccess
                    ? 'Portal access is signed in. Use Time In / Out to close the kiosk session if needed.'
                    : 'Signed in to the employee portal.'}
                </div>
                <button className="ghost-btn full-width" onClick={signOutCurrentUser} type="button">
                  Sign Out
                </button>
              </>
            ) : (
              <div className="muted small">Use Time In / Out to end staff access.</div>
            )}
          </div>
        </aside>
      ) : null}

      {sidebarOpen && activeRole !== 'none' ? (
        <div className="mobile-drawer-backdrop" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <main className={activeRole !== 'none' ? 'owner-main' : undefined}>
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
                width: '72px',
                height: '72px',
                objectFit: 'contain',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.42)',
                padding: '6px',
                boxShadow: '0 10px 24px rgba(80, 51, 25, 0.1)',
                flexShrink: 0,
              }}
            />

            <div>
              <div className="brand-title">Cup of Joy</div>
              <div className="muted">
                {activeRole === 'admin'
                  ? 'Management dashboard'
                  : activeRole === 'staff'
                    ? hasPosAccess
                      ? `Active staff: ${staffIdentity?.employeeName || portalEmployee?.employeeName || 'Staff'}`
                      : `Employee portal: ${portalEmployee?.employeeName || 'Staff'}`
                    : 'Choose how you want to continue'}
              </div>
            </div>
          </div>

          {showHeaderNav ? (
            <div className="tab-row wrap">
              <button
                className="tab-btn active mobile-menu-btn"
                onClick={() => setSidebarOpen(true)}
                type="button"
                aria-label="Open menu"
              >
                Menu
              </button>
            </div>
          ) : null}
        </header>
        {appContent}
      </main>
    </div>
  );
}
