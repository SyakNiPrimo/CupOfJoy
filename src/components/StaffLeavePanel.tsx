import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type StaffLeavePanelProps = {
  qrToken?: string | null;
};

type LeaveRequest = {
  id: string;
  leave_date: string;
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled';
  unpaid: boolean;
  requested_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
};

type LoanRepayment = {
  amount: number;
  paid_at: string;
  notes: string | null;
};

type LoanRecord = {
  id: string;
  principal_amount: number;
  outstanding_balance: number;
  payment_terms: string;
  agreement_html: string;
  start_date: string;
  status: 'active' | 'settled' | 'cancelled';
  issued_at: string;
  notes: string | null;
  repayments: LoanRepayment[];
};

type DashboardResponse = {
  employee: {
    employeeNumber: string | null;
    employeeName: string;
    startDate: string;
    leaveEligible: boolean;
  };
  loansEnabled: boolean;
  leaveRequests: LeaveRequest[];
  loans: LoanRecord[];
};

function money(value?: number | null) {
  return `PHP ${Number(value ?? 0).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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

function printAgreement(loan: LoanRecord) {
  const popup = window.open('', '_blank', 'width=960,height=720');
  if (!popup) return;
  popup.document.write(loan.agreement_html);
  popup.document.close();
  popup.focus();
  popup.print();
}

export default function StaffLeavePanel({ qrToken = null }: StaffLeavePanelProps) {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [leaveDate, setLeaveDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadDashboard();
  }, [qrToken]);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError('');

      const { data, error: rpcError } = await supabase.rpc('staff_leave_dashboard', {
        p_qr_token: qrToken,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to load leave dashboard.');

      setDashboard(data as DashboardResponse);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load leave dashboard.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function submitLeaveRequest() {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const { data, error: rpcError } = await supabase.rpc('submit_unpaid_leave_request', {
        p_qr_token: qrToken,
        p_leave_date: leaveDate || null,
        p_reason: reason,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to submit leave request.');

      setMessage('Unpaid leave request submitted.');
      setLeaveDate('');
      setReason('');
      await loadDashboard();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to submit leave request.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const activeLoans = useMemo(
    () => (dashboard?.loans ?? []).filter((loan) => loan.status !== 'cancelled'),
    [dashboard?.loans],
  );

  return (
    <div className="panel">
      <div className="section-title">Leave</div>
      <p className="muted">Plot unpaid leave after 3 months of active employment, with at least 14 days advance notice.</p>

      {loading ? <div className="info-box">Loading leave dashboard...</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {message ? <div className="success-box">{message}</div> : null}

      {dashboard?.employee ? (
        <div className="contract-sheet">
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-label">Employee</div>
              <div className="metric-value">{dashboard.employee.employeeName}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Start Date</div>
              <div className="metric-value">{formatDate(dashboard.employee.startDate)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Leave Eligibility</div>
              <div className="metric-value">{dashboard.employee.leaveEligible ? 'Eligible' : 'Not yet'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Loan Access</div>
              <div className="metric-value">{dashboard.loansEnabled ? 'Enabled' : 'Disabled'}</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="contract-sheet">
        <div className="section-title">Plot Unpaid Leave</div>
        <p className="muted">Leave requests must be filed at least 14 days before the requested leave date.</p>
        <div className="inline-stack" style={{ marginTop: '12px' }}>
          <input type="date" value={leaveDate} onChange={(event) => setLeaveDate(event.target.value)} />
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason for leave"
            rows={4}
            style={{ border: '1px solid #d7c9b6', borderRadius: '8px', padding: '10px', font: 'inherit' }}
          />
          <button
            className="secondary-btn"
            type="button"
            disabled={saving || !dashboard?.employee?.leaveEligible}
            onClick={() => void submitLeaveRequest()}
          >
            {saving ? 'Submitting...' : 'Submit Leave Request'}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Leave Date</th>
              <th>Status</th>
              <th>Reason</th>
              <th>Requested</th>
              <th>Review Notes</th>
            </tr>
          </thead>
          <tbody>
            {(dashboard?.leaveRequests ?? []).map((request) => (
              <tr key={request.id}>
                <td>{formatDate(request.leave_date)}</td>
                <td>{request.status}</td>
                <td>{request.reason}</td>
                <td>{formatDateTime(request.requested_at)}</td>
                <td>{request.review_notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dashboard?.loansEnabled ? (
        <div className="contract-sheet">
          <div className="section-title">Loan Tracker</div>
          {!activeLoans.length ? (
            <div className="info-box">No active or historical loans yet.</div>
          ) : (
            activeLoans.map((loan) => (
              <div key={loan.id} style={{ borderBottom: '1px solid #eadfce', padding: '14px 0' }}>
                <strong>{money(loan.principal_amount)}</strong> | Outstanding {money(loan.outstanding_balance)}
                <br />
                Terms: {loan.payment_terms}
                <br />
                Start: {formatDate(loan.start_date)} | Status: {loan.status}
                <br />
                <button className="ghost-btn" type="button" onClick={() => printAgreement(loan)} style={{ marginTop: '8px' }}>
                  Print Agreement
                </button>
                <div className="muted small" style={{ marginTop: '8px' }}>
                  Repayments: {loan.repayments.length ? loan.repayments.map((repayment) => `${money(repayment.amount)} on ${formatDate(repayment.paid_at)}`).join(' | ') : 'No repayments yet'}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
