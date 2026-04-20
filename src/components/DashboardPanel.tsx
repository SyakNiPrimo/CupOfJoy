import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import EmployeeAdminPanel from './EmployeeAdminPanel';
import SalesAdminPanel from './SalesAdminPanel';

type StaffIdentity = {
  employeeId: string;
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

type CutoffPayrollRow = {
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  cutoff_start: string;
  cutoff_end: string;
  payday: string;
  cutoff_label: string;
  total_sessions: number;
  completed_sessions: number;
  open_sessions: number;
  on_time_days: number;
  late_days: number;
  total_worked_minutes: number;
  total_worked_hours: number;
  total_late_minutes: number;
  total_payroll_deduction: number;
  total_overtime_minutes: number;
  total_overtime_hours: number;
  total_overtime_pay: number;
  has_overtime: boolean;
  first_session_in: string | null;
  last_session_out: string | null;
};

type CutoffSessionRow = {
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  work_date: string;
  time_in_at: string;
  time_in_local_time: string;
  time_in_location: string | null;
  time_in_selfie_path: string | null;
  late_minutes: number;
  payroll_deduction: number;
  time_out_at: string | null;
  time_out_local_time: string | null;
  time_out_location: string | null;
  time_out_selfie_path: string | null;
  overtime_minutes: number;
  overtime_hours: number;
  overtime_pay: number;
  overtime_qualified: boolean;
  worked_minutes: number | null;
  worked_hours: number | null;
  session_status: 'completed' | 'open';
  cutoff_start: string;
  cutoff_end: string;
  payday: string;
  cutoff_label: string;
};

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '12px',
  marginTop: '12px',
};

const statCardStyle: React.CSSProperties = {
  background: '#f3ede4',
  border: '1px solid #e3d6c3',
  borderRadius: '16px',
  padding: '14px',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  opacity: 0.75,
  marginBottom: '6px',
};

const cardValueStyle: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
};

const listCardStyle: React.CSSProperties = {
  background: '#f7f3ec',
  border: '1px solid #eadfce',
  borderRadius: '16px',
  padding: '14px',
  marginBottom: '10px',
};

function money(value?: number | null) {
  return `₱${Number(value ?? 0).toFixed(2)}`;
}

function numberValue(value?: number | null) {
  return Number(value ?? 0);
}

function formatDateOnly(value?: string | null) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function readLastStaff(): StaffIdentity | null {
  try {
    const raw = localStorage.getItem('coj_last_staff');
    if (!raw) return null;
    return JSON.parse(raw) as StaffIdentity;
  } catch {
    return null;
  }
}

export default function DashboardPanel() {
  const [mode, setMode] = useState<'staff' | 'admin'>('staff');

  const [staffIdentity, setStaffIdentity] = useState<StaffIdentity | null>(null);
  const [staffSummary, setStaffSummary] = useState<CutoffPayrollRow | null>(null);
  const [staffSessions, setStaffSessions] = useState<CutoffSessionRow[]>([]);

  const [ownerProfile, setOwnerProfile] = useState<ProfileRow | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const [allAdminRows, setAllAdminRows] = useState<CutoffPayrollRow[]>([]);
  const [adminRows, setAdminRows] = useState<CutoffPayrollRow[]>([]);
  const [adminSessions, setAdminSessions] = useState<CutoffSessionRow[]>([]);
  const [selectedCutoffKey, setSelectedCutoffKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const syncStaff = () => {
      setStaffIdentity(readLastStaff());
    };

    syncStaff();
    window.addEventListener('coj-staff-updated', syncStaff);

    return () => {
      window.removeEventListener('coj-staff-updated', syncStaff);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const refreshOwner = async () => {
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
        setError(profileError.message);
        setOwnerProfile(null);
        setOwnerLoading(false);
        return;
      }

      if (!profile || profile.role !== 'owner' || !profile.is_active) {
        await supabase.auth.signOut();
        setOwnerProfile(null);
        setError('This account is not allowed to access the owner dashboard.');
        setOwnerLoading(false);
        return;
      }

      setOwnerProfile(profile as ProfileRow);
      setOwnerLoading(false);
    };

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

  useEffect(() => {
    if (mode === 'staff' && staffIdentity?.qrToken) {
      void loadStaffDashboard(staffIdentity.qrToken);
    }
  }, [mode, staffIdentity?.qrToken]);

  useEffect(() => {
    if (mode === 'admin' && ownerProfile) {
      void loadAdminDashboard();
    }
  }, [mode, ownerProfile?.id, selectedCutoffKey]);

  async function loadStaffDashboard(qrToken: string) {
    try {
      setLoading(true);
      setError('');

      const { data: result, error: rpcError } = await supabase.rpc('staff_dashboard', {
        p_qr_token: qrToken,
      });

      if (rpcError) throw rpcError;

      if (!result.success) {
        throw new Error(result.message || 'Unable to load staff dashboard.');
      }

      setStaffSummary((result.currentSummary ?? null) as CutoffPayrollRow | null);
      setStaffSessions((result.sessions ?? []) as CutoffSessionRow[]);
    } catch (dashboardError) {
      const message =
        dashboardError instanceof Error ? dashboardError.message : 'Unable to load dashboard.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminDashboard() {
    try {
      setLoading(true);
      setError('');

      const { data: summaries, error: summaryError } = await supabase
        .from('cutoff_payroll_summary')
        .select('*')
        .order('cutoff_start', { ascending: false })
        .order('employee_name', { ascending: true });

      if (summaryError) throw summaryError;

      const rows = (summaries ?? []) as CutoffPayrollRow[];
      setAllAdminRows(rows);

      if (!rows.length) {
        setAdminRows([]);
        setAdminSessions([]);
        setSelectedCutoffKey('');
        return;
      }

      const availableCutoffKeys = Array.from(
        new Set(rows.map((row) => `${row.cutoff_start}__${row.cutoff_end}`)),
      );

      const effectiveCutoffKey =
        selectedCutoffKey && availableCutoffKeys.includes(selectedCutoffKey)
          ? selectedCutoffKey
          : availableCutoffKeys[0];

      setSelectedCutoffKey(effectiveCutoffKey);

      const [cutoffStart, cutoffEnd] = effectiveCutoffKey.split('__');

      const filteredRows = rows.filter(
        (row) => row.cutoff_start === cutoffStart && row.cutoff_end === cutoffEnd,
      );

      setAdminRows(filteredRows);

      const { data: sessions, error: sessionError } = await supabase
        .from('cutoff_session_summary')
        .select('*')
        .gte('work_date', cutoffStart)
        .lte('work_date', cutoffEnd)
        .order('work_date', { ascending: false })
        .order('employee_name', { ascending: true })
        .order('time_in_at', { ascending: false });

      if (sessionError) throw sessionError;

      setAdminSessions((sessions ?? []) as CutoffSessionRow[]);
    } catch (dashboardError) {
      const message =
        dashboardError instanceof Error ? dashboardError.message : 'Unable to load admin dashboard.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function signInOwner() {
    try {
      setError('');
      setLoading(true);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (signInError) throw signInError;

      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        throw new Error('Owner login succeeded but no user was returned.');
      }
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Unable to sign in.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function signOutOwner() {
    await supabase.auth.signOut();
    setOwnerProfile(null);
    setAdminRows([]);
    setAdminSessions([]);
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordMessage('');
  }

  async function changeOwnerPassword() {
    try {
      setError('');
      setPasswordMessage('');
      setLoading(true);

      if (newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters.');
      }

      if (newPassword !== confirmNewPassword) {
        throw new Error('New passwords do not match.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordMessage('Password updated successfully.');
    } catch (passwordError) {
      const message =
        passwordError instanceof Error ? passwordError.message : 'Unable to update password.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const adminOpenSessions = useMemo(
    () => adminSessions.filter((session) => session.session_status === 'open'),
    [adminSessions],
  );

  const cutoffOptions = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        cutoffStart: string;
        cutoffEnd: string;
        payday: string;
      }
    >();

    for (const row of allAdminRows) {
      const key = `${row.cutoff_start}__${row.cutoff_end}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          label: row.cutoff_label,
          cutoffStart: row.cutoff_start,
          cutoffEnd: row.cutoff_end,
          payday: row.payday,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.cutoffStart < b.cutoffStart ? 1 : -1,
    );
  }, [allAdminRows]);

  return (
    <>
      <div className="grid-two">
        <div className="panel">
          <div className="section-title">Dashboard</div>
          <p className="muted">Cutoff based summary for staff and owner view.</p>

          <div className="toggle-row">
            <button
              className={mode === 'staff' ? 'toggle-btn active' : 'toggle-btn'}
              type="button"
              onClick={() => setMode('staff')}
            >
              Staff
            </button>
            <button
              className={mode === 'admin' ? 'toggle-btn active' : 'toggle-btn'}
              type="button"
              onClick={() => setMode('admin')}
            >
              Admin
            </button>
          </div>

          {loading || ownerLoading ? <div className="info-box">Loading dashboard...</div> : null}
          {error ? <div className="error-box">{error}</div> : null}

          {mode === 'staff' ? (
            <>
              {!staffIdentity?.qrToken ? (
                <div className="info-box">
                  No staff session found yet. Time in first so the dashboard knows who to load.
                </div>
              ) : (
                <>
                  <div className="success-box">
                    <strong>{staffIdentity.employeeName || 'Staff'}</strong>
                    <br />
                    Employee No: {staffIdentity.employeeNumber || '—'}
                  </div>

                  {staffSummary ? (
                    <>
                      <div className="info-box">
                        <strong>Current cutoff:</strong> {staffSummary.cutoff_label}
                        <br />
                        Cutoff: {formatDateOnly(staffSummary.cutoff_start)} to{' '}
                        {formatDateOnly(staffSummary.cutoff_end)}
                        <br />
                        Payday: {formatDateOnly(staffSummary.payday)}
                      </div>

                      <div style={statsGridStyle}>
                        <div style={statCardStyle}>
                          <div style={cardTitleStyle}>Sessions</div>
                          <div style={cardValueStyle}>{numberValue(staffSummary.total_sessions)}</div>
                        </div>

                        <div style={statCardStyle}>
                          <div style={cardTitleStyle}>Worked Hours</div>
                          <div style={cardValueStyle}>{numberValue(staffSummary.total_worked_hours)}</div>
                        </div>

                        <div style={statCardStyle}>
                          <div style={cardTitleStyle}>Late Minutes</div>
                          <div style={cardValueStyle}>{numberValue(staffSummary.total_late_minutes)}</div>
                        </div>

                        <div style={statCardStyle}>
                          <div style={cardTitleStyle}>Deduction</div>
                          <div style={cardValueStyle}>{money(staffSummary.total_payroll_deduction)}</div>
                        </div>

                        <div style={statCardStyle}>
                          <div style={cardTitleStyle}>OT Hours</div>
                          <div style={cardValueStyle}>{numberValue(staffSummary.total_overtime_hours)}</div>
                        </div>

                        <div style={statCardStyle}>
                          <div style={cardTitleStyle}>OT Pay</div>
                          <div style={cardValueStyle}>{money(staffSummary.total_overtime_pay)}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="info-box">No cutoff summary yet for this staff.</div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {!ownerProfile ? (
                <div
                  className="panel"
                  style={{ padding: 0, boxShadow: 'none', background: 'transparent' }}
                >
                  <div className="info-box">Owner login required.</div>

                  <div className="action-row wrap" style={{ gap: '10px' }}>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
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
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="Password"
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: '1px solid #d7c9b6',
                        minWidth: '220px',
                      }}
                    />
                    <button className="secondary-btn" type="button" onClick={signInOwner}>
                      Sign In
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="success-box">
                    <strong>{ownerProfile.full_name || 'Owner'}</strong>
                    <br />
                    {ownerProfile.email || 'Signed in'}
                    <br />
                    <button
                      type="button"
                      className="ghost-btn"
                      style={{ marginTop: '10px' }}
                      onClick={signOutOwner}
                    >
                      Sign Out
                    </button>
                  </div>

                  <div className="info-box">
                    <strong>Change Admin Password</strong>
                    <br />
                    Use this after signing in as owner.
                    <div className="action-row wrap" style={{ gap: '10px', marginTop: '10px' }}>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        placeholder="New password"
                        style={{
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: '1px solid #d7c9b6',
                          minWidth: '220px',
                        }}
                      />
                      <input
                        type="password"
                        value={confirmNewPassword}
                        onChange={(event) => setConfirmNewPassword(event.target.value)}
                        placeholder="Confirm new password"
                        style={{
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: '1px solid #d7c9b6',
                          minWidth: '220px',
                        }}
                      />
                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={changeOwnerPassword}
                        disabled={loading}
                      >
                        Update Password
                      </button>
                    </div>
                    {passwordMessage ? (
                      <div style={{ marginTop: '8px', color: '#166534', fontWeight: 700 }}>
                        {passwordMessage}
                      </div>
                    ) : null}
                  </div>

                  {cutoffOptions.length ? (
                    <>
                      <div className="action-row wrap" style={{ marginBottom: '12px' }}>
                        <select
                          value={selectedCutoffKey}
                          onChange={(event) => setSelectedCutoffKey(event.target.value)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: '1px solid #d7c9b6',
                            minWidth: '240px',
                            background: '#fffaf2',
                          }}
                        >
                          {cutoffOptions.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label} | Payday {formatDateOnly(option.payday)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {adminRows.length ? (
                        <div className="info-box">
                          <strong>Selected cutoff:</strong> {adminRows[0].cutoff_label}
                          <br />
                          Cutoff: {formatDateOnly(adminRows[0].cutoff_start)} to{' '}
                          {formatDateOnly(adminRows[0].cutoff_end)}
                          <br />
                          Payday: {formatDateOnly(adminRows[0].payday)}
                        </div>
                      ) : (
                        <div className="info-box">No rows for the selected cutoff.</div>
                      )}
                    </>
                  ) : (
                    <div className="info-box">No admin cutoff rows yet.</div>
                  )}

                  <div style={statsGridStyle}>
                    <div style={statCardStyle}>
                      <div style={cardTitleStyle}>Employees</div>
                      <div style={cardValueStyle}>{adminRows.length}</div>
                    </div>

                    <div style={statCardStyle}>
                      <div style={cardTitleStyle}>Open Sessions</div>
                      <div style={cardValueStyle}>{adminOpenSessions.length}</div>
                    </div>

                    <div style={statCardStyle}>
                      <div style={cardTitleStyle}>Late Days</div>
                      <div style={cardValueStyle}>
                        {adminRows.reduce((sum, row) => sum + numberValue(row.late_days), 0)}
                      </div>
                    </div>

                    <div style={statCardStyle}>
                      <div style={cardTitleStyle}>Total Deduction</div>
                      <div style={cardValueStyle}>
                        {money(
                          adminRows.reduce(
                            (sum, row) => sum + numberValue(row.total_payroll_deduction),
                            0,
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="panel">
          {mode === 'staff' ? (
            <>
              <div className="section-title">Recent Sessions</div>
              <p className="muted">Current cutoff history for the last staff QR used on this device.</p>

              {!staffSessions.length ? (
                <div className="info-box">No session history yet.</div>
              ) : (
                staffSessions.map((session) => (
                  <div key={`${session.employee_id}-${session.time_in_at}`} style={listCardStyle}>
                    <strong>{formatDateOnly(session.work_date)}</strong>
                    <br />
                    Time In: {formatDateTime(session.time_in_at)}
                    <br />
                    Time Out: {session.time_out_at ? formatDateTime(session.time_out_at) : 'Open'}
                    <br />
                    Worked Hours: {session.worked_hours ?? 0}
                    <br />
                    Late Minutes: {numberValue(session.late_minutes)}
                    <br />
                    Deduction: {money(session.payroll_deduction)}
                    <br />
                    OT Hours: {numberValue(session.overtime_hours)}
                    <br />
                    OT Pay: {money(session.overtime_pay)}
                    <br />
                    Status: {session.session_status}
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              <div className="section-title">Admin View</div>
              <p className="muted">Owner summary for the current cutoff.</p>

              {!ownerProfile ? (
                <div className="info-box">Sign in as owner first to view admin data.</div>
              ) : (
                <>
                  {adminRows.map((row) => (
                    <div key={`${row.employee_id}-${row.cutoff_start}`} style={listCardStyle}>
                      <strong>{row.employee_name}</strong>
                      <br />
                      Employee No: {row.employee_number || '—'}
                      <br />
                      Sessions: {numberValue(row.total_sessions)}
                      <br />
                      Worked Hours: {numberValue(row.total_worked_hours)}
                      <br />
                      Late Minutes: {numberValue(row.total_late_minutes)}
                      <br />
                      Deduction: {money(row.total_payroll_deduction)}
                      <br />
                      OT Hours: {numberValue(row.total_overtime_hours)}
                      <br />
                      OT Pay: {money(row.total_overtime_pay)}
                      <br />
                      Open Sessions: {numberValue(row.open_sessions)}
                    </div>
                  ))}

                  <div className="section-title" style={{ marginTop: '18px' }}>
                    Open Session Alerts
                  </div>

                  {!adminOpenSessions.length ? (
                    <div className="success-box">No open sessions in the current cutoff.</div>
                  ) : (
                    adminOpenSessions.map((session) => (
                      <div key={`${session.employee_id}-${session.time_in_at}-open`} style={listCardStyle}>
                        <strong>{session.employee_name}</strong>
                        <br />
                        Work Date: {formatDateOnly(session.work_date)}
                        <br />
                        Time In: {formatDateTime(session.time_in_at)}
                        <br />
                        Status: {session.session_status}
                      </div>
                    ))
                  )}

                  <div className="section-title" style={{ marginTop: '18px' }}>
                    Sessions in Selected Cutoff
                  </div>

                  {!adminSessions.length ? (
                    <div className="info-box">No sessions for the selected cutoff.</div>
                  ) : (
                    adminSessions.map((session) => (
                      <div key={`${session.employee_id}-${session.time_in_at}-admin`} style={listCardStyle}>
                        <strong>{session.employee_name}</strong>
                        <br />
                        Work Date: {formatDateOnly(session.work_date)}
                        <br />
                        Time In: {formatDateTime(session.time_in_at)}
                        <br />
                        Time Out: {session.time_out_at ? formatDateTime(session.time_out_at) : 'Open'}
                        <br />
                        Worked Hours: {session.worked_hours ?? 0}
                        <br />
                        Late Minutes: {numberValue(session.late_minutes)}
                        <br />
                        Deduction: {money(session.payroll_deduction)}
                        <br />
                        OT Hours: {numberValue(session.overtime_hours)}
                        <br />
                        OT Pay: {money(session.overtime_pay)}
                        <br />
                        Status: {session.session_status}
                      </div>
                    ))
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {mode === 'admin' && ownerProfile ? (
  <>
    <EmployeeAdminPanel />
    <SalesAdminPanel />
  </>
) : null}
    </>
  );
}
