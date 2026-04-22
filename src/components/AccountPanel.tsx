import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'owner' | 'admin' | 'staff';
  is_active: boolean;
};

type AccessInvite = {
  id: string;
  email: string;
  role: 'owner' | 'admin';
  status: 'pending' | 'claimed' | 'cancelled';
  notes?: string | null;
  created_at: string;
  claimed_at?: string | null;
};

type ManagementAccount = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'owner' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type AccountPanelProps = {
  ownerProfile: ProfileRow;
  onSignedOut: () => void;
};

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '8px',
  border: '1px solid #ecd8a2',
  minWidth: '220px',
  width: '100%',
  background: 'rgba(255, 253, 247, 0.96)',
  color: '#2f2419',
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function roleLabel(role: 'owner' | 'admin' | 'staff') {
  if (role === 'owner') return 'Founder / Owner';
  if (role === 'admin') return 'Co-owner / Admin';
  return 'Staff';
}

export default function AccountPanel({ ownerProfile, onSignedOut }: AccountPanelProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [salesCorrectionPin, setSalesCorrectionPin] = useState('');
  const [confirmSalesCorrectionPin, setConfirmSalesCorrectionPin] = useState('');
  const [salesPinSet, setSalesPinSet] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'owner'>('admin');
  const [inviteNotes, setInviteNotes] = useState('');
  const [invites, setInvites] = useState<AccessInvite[]>([]);
  const [managementAccounts, setManagementAccounts] = useState<ManagementAccount[]>([]);
  const [removeAdminPin, setRemoveAdminPin] = useState('');
  const [removingAdminId, setRemovingAdminId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadAccountData();
  }, []);

  async function loadAccountData() {
    try {
      setError('');

      const [settingsResult, inviteResult, accountsResult] = await Promise.all([
        supabase.rpc('owner_settings_dashboard'),
        supabase.rpc('owner_access_invites_dashboard'),
        supabase.rpc('owner_management_accounts_dashboard'),
      ]);

      if (settingsResult.error) throw settingsResult.error;
      if (!settingsResult.data?.success) {
        throw new Error(settingsResult.data?.message || 'Unable to load account settings.');
      }

      if (inviteResult.error) throw inviteResult.error;
      if (!inviteResult.data?.success) {
        throw new Error(inviteResult.data?.message || 'Unable to load management invites.');
      }

      if (accountsResult.error) throw accountsResult.error;
      if (!accountsResult.data?.success) {
        throw new Error(accountsResult.data?.message || 'Unable to load management accounts.');
      }

      setSalesPinSet(Boolean(settingsResult.data.settings?.salesCorrectionPinSet));
      setInvites((inviteResult.data.invites ?? []) as AccessInvite[]);
      setManagementAccounts((accountsResult.data.accounts ?? []) as ManagementAccount[]);
    } catch (loadError) {
      const errorMessage = loadError instanceof Error ? loadError.message : 'Unable to load account settings.';
      setError(errorMessage);
    }
  }

  async function createInvite() {
    try {
      setBusy(true);
      setError('');
      setMessage('');

      const { data, error: rpcError } = await supabase.rpc('owner_create_access_invite', {
        p_email: inviteEmail,
        p_role: inviteRole,
        p_notes: inviteNotes || null,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to create management invite.');

      setInviteEmail('');
      setInviteNotes('');
      setMessage(`Invite saved for ${data.invite?.email || 'the management user'}. They can now create their account from the management login screen.`);
      await loadAccountData();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to create management invite.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvite(inviteId: string) {
    try {
      setBusy(true);
      setError('');
      setMessage('');

      const { data, error: rpcError } = await supabase.rpc('owner_cancel_access_invite', {
        p_invite_id: inviteId,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to cancel invite.');

      setMessage('Management invite cancelled.');
      await loadAccountData();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to cancel invite.');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    try {
      setBusy(true);
      setError('');
      setMessage('');

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
      setMessage('Password updated successfully.');
    } catch (passwordError) {
      const errorMessage = passwordError instanceof Error ? passwordError.message : 'Unable to update password.';
      setError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function updateSalesCorrectionPin() {
    try {
      setBusy(true);
      setError('');
      setMessage('');

      if (salesCorrectionPin.length < 4) {
        throw new Error('Admin PIN must be at least 4 characters.');
      }

      if (salesCorrectionPin !== confirmSalesCorrectionPin) {
        throw new Error('Admin PIN entries do not match.');
      }

      const { data, error: rpcError } = await supabase.rpc('owner_set_sales_correction_pin', {
        p_pin: salesCorrectionPin,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to save admin PIN.');

      setSalesCorrectionPin('');
      setConfirmSalesCorrectionPin('');
      setSalesPinSet(Boolean(data.settings?.salesCorrectionPinSet));
      setMessage('Sales correction admin PIN updated.');
    } catch (pinError) {
      const errorMessage = pinError instanceof Error ? pinError.message : 'Unable to save admin PIN.';
      setError(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function removeManagementAccess(account: ManagementAccount) {
    try {
      setBusy(true);
      setError('');
      setMessage('');

      if (!removeAdminPin.trim()) {
        throw new Error('Enter the admin PIN first to delete an admin account.');
      }

      const confirmation = window.prompt(
        `Type the email for ${account.full_name || account.email || 'this admin'} to confirm permanent deletion.`,
        '',
      );

      if (confirmation === null) return;

      if (confirmation.trim().toLowerCase() !== (account.email || '').trim().toLowerCase()) {
        throw new Error('Admin deletion cancelled. Email did not match.');
      }

      const { data, error: rpcError } = await supabase.rpc('owner_remove_management_access', {
        p_profile_id: account.id,
        p_admin_pin: removeAdminPin,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to permanently delete admin access.');

      setRemoveAdminPin('');
      setRemovingAdminId('');
      setMessage(data.message || 'Admin access deleted permanently.');
      await loadAccountData();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to permanently delete admin access.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    onSignedOut();
  }

  const accountSummary = useMemo(
    () => [
      { label: 'Name', value: ownerProfile.full_name || 'Management User' },
      { label: 'Email', value: ownerProfile.email || '-' },
      { label: 'Position', value: roleLabel(ownerProfile.role) },
      { label: 'Access', value: ownerProfile.role === 'owner' ? 'Full management authority' : 'Operations management access' },
    ],
    [ownerProfile],
  );

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div className="panel">
        <div className="section-title">Account Center</div>
        <p className="muted">Management identity, security settings, access control, and admin maintenance.</p>

        {error ? <div className="error-box">{error}</div> : null}
        {message ? <div className="success-box">{message}</div> : null}

        <div className="contract-grid">
          {accountSummary.map((item) => (
            <div className="metric-card" key={item.label}>
              <div className="metric-label">{item.label}</div>
              <div className="metric-value" style={{ fontSize: '1rem' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <div className="section-title">Change Password</div>
          <p className="muted">Use a strong password for your management account.</p>

          <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              style={inputStyle}
            />
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              placeholder="Confirm new password"
              style={inputStyle}
            />
            <button className="secondary-btn" onClick={changePassword} type="button" disabled={busy}>
              {busy ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="section-title">Sales Correction Admin PIN</div>
          <p className="muted">
            Protect staff-side sales corrections with an admin PIN. Current status:{' '}
            <strong>{salesPinSet ? 'PIN set' : 'PIN not set'}</strong>
          </p>

          <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
            <input
              type="password"
              value={salesCorrectionPin}
              onChange={(event) => setSalesCorrectionPin(event.target.value)}
              placeholder="New admin PIN"
              style={inputStyle}
            />
            <input
              type="password"
              value={confirmSalesCorrectionPin}
              onChange={(event) => setConfirmSalesCorrectionPin(event.target.value)}
              placeholder="Confirm admin PIN"
              style={inputStyle}
            />
            <button className="secondary-btn" onClick={updateSalesCorrectionPin} type="button" disabled={busy}>
              {busy ? 'Saving...' : salesPinSet ? 'Update Admin PIN' : 'Set Admin PIN'}
            </button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="section-title">Management Access Invite</div>
        <p className="muted">Invite another owner or admin. Claimed invitations now properly upgrade access when used from the management login screen.</p>

        <div className="contract-grid" style={{ marginTop: '12px' }}>
          <input
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="Invite email"
            style={inputStyle}
          />
          <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as 'admin' | 'owner')} style={inputStyle}>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
          <input
            type="text"
            value={inviteNotes}
            onChange={(event) => setInviteNotes(event.target.value)}
            placeholder="Optional note"
            style={inputStyle}
          />
          <button className="secondary-btn" onClick={createInvite} type="button" disabled={busy}>
            {busy ? 'Saving...' : 'Save Invite'}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="section-title">Management Accounts</div>
        <p className="muted">Active owner and admin accounts with protected removal for admins only.</p>

        <div className="inline-stack" style={{ marginTop: '12px', maxWidth: '360px' }}>
          <input
            type="password"
            value={removeAdminPin}
            onChange={(event) => setRemoveAdminPin(event.target.value)}
            placeholder="Enter admin PIN to delete an admin"
            style={inputStyle}
          />
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Update</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {managementAccounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.full_name || '-'}</td>
                  <td>{account.email || '-'}</td>
                  <td>{roleLabel(account.role)}</td>
                  <td>{account.is_active ? 'Active' : 'Inactive'}</td>
                  <td>{formatDateTime(account.created_at)}</td>
                  <td>{formatDateTime(account.updated_at)}</td>
                  <td>
                    {account.role === 'admin' ? (
                      <button
                        className="ghost-btn"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setRemovingAdminId(account.id);
                          void removeManagementAccess(account);
                        }}
                      >
                        {busy && removingAdminId === account.id ? 'Deleting...' : 'Delete Admin'}
                      </button>
                    ) : (
                      <span className="muted small">Founder account protected</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="section-title">Management Invites</div>
        <p className="muted">Invitation history for owner and admin access.</p>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Claimed</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.length ? (
                invites.map((invite) => (
                  <tr key={invite.id}>
                    <td>{invite.email}</td>
                    <td>{invite.role === 'owner' ? 'Owner' : 'Admin'}</td>
                    <td>{invite.status}</td>
                    <td>{formatDateTime(invite.created_at)}</td>
                    <td>{formatDateTime(invite.claimed_at)}</td>
                    <td>{invite.notes || '-'}</td>
                    <td>
                      {invite.status === 'pending' ? (
                        <button className="ghost-btn" onClick={() => void cancelInvite(invite.id)} type="button" disabled={busy}>
                          Cancel Invite
                        </button>
                      ) : (
                        <span className="muted small">No action</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <div className="info-box">No management invites yet.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="section-title">Session</div>
        <p className="muted">Sign out of the current management session from here.</p>
        <button className="ghost-btn" onClick={signOut} type="button">
          Sign Out
        </button>
      </div>
    </div>
  );
}
