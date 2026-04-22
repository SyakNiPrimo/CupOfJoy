import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type EmployeeRow = {
  id: string;
  employee_number: string | null;
  full_name: string;
  loan_feature_enabled?: boolean;
};

type LeaveRequest = {
  id: string;
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  leave_date: string;
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled';
  unpaid: boolean;
  requested_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
};

type TerminationRequest = {
  id: string;
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  requested_at: string;
  notice_days: number;
  requested_last_working_date: string;
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  reviewed_at: string | null;
  review_notes: string | null;
};

type LoanRow = {
  id: string;
  employee_id: string;
  principal_amount: number;
  outstanding_balance: number;
  payment_terms: string;
  agreement_html: string;
  start_date: string;
  status: 'active' | 'settled' | 'cancelled';
  issued_at: string;
  notes: string | null;
  employees?: {
    employee_number: string | null;
    full_name: string;
  } | null;
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

function printAgreement(loan: LoanRow) {
  const popup = window.open('', '_blank', 'width=960,height=720');
  if (!popup) return;
  popup.document.write(loan.agreement_html);
  popup.document.close();
  popup.focus();
  popup.print();
}

export default function AdminPeopleOpsPanel() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [terminationRequests, setTerminationRequests] = useState<TerminationRequest[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [loanStartDate, setLoanStartDate] = useState('');
  const [loanNotes, setLoanNotes] = useState('');
  const [repaymentAmounts, setRepaymentAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError('');

      const [{ data: leaveData, error: leaveError }, { data: terminationData, error: terminationError }, { data: employeeRows, error: employeeError }, { data: loanRows, error: loanError }] =
        await Promise.all([
          supabase.rpc('owner_leave_dashboard'),
          supabase.rpc('owner_termination_dashboard'),
          supabase.from('employees').select('id, employee_number, full_name, loan_feature_enabled').eq('is_active', true).order('employee_number', { ascending: true }),
          supabase.from('employee_loans').select('id, employee_id, principal_amount, outstanding_balance, payment_terms, agreement_html, start_date, status, issued_at, notes, employees(employee_number, full_name)').order('issued_at', { ascending: false }),
        ]);

      if (leaveError) throw leaveError;
      if (!leaveData?.success) throw new Error(leaveData?.message || 'Unable to load leave requests.');
      if (terminationError) throw terminationError;
      if (!terminationData?.success) throw new Error(terminationData?.message || 'Unable to load termination requests.');
      if (employeeError) throw employeeError;
      if (loanError) throw loanError;

      setLeaveRequests((leaveData.requests ?? []) as LeaveRequest[]);
      setTerminationRequests((terminationData.requests ?? []) as TerminationRequest[]);
      setEmployees((employeeRows ?? []) as EmployeeRow[]);
      setLoans((loanRows ?? []) as unknown as LoanRow[]);

      if (!selectedEmployeeId && employeeRows?.length) {
        setSelectedEmployeeId(employeeRows[0].id);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load people operations.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleEmployeeLoanEnabled(employee: EmployeeRow) {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const { data, error: rpcError } = await supabase.rpc('owner_set_employee_loan_enabled', {
        p_employee_id: employee.id,
        p_enabled: !employee.loan_feature_enabled,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to update loan setting.');

      setMessage(`Loan feature ${employee.loan_feature_enabled ? 'disabled' : 'enabled'} for ${employee.full_name}.`);
      await loadData();
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : 'Unable to update loan setting.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function reviewLeaveRequest(requestId: string, status: 'approved' | 'rejected') {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const { data, error: rpcError } = await supabase.rpc('owner_review_leave_request', {
        p_leave_request_id: requestId,
        p_status: status,
        p_review_notes: null,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to review leave request.');

      setMessage(`Leave request ${status}.`);
      await loadData();
    } catch (reviewError) {
      const message = reviewError instanceof Error ? reviewError.message : 'Unable to review leave request.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function reviewTerminationRequest(requestId: string, status: 'approved' | 'rejected' | 'completed') {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const { data, error: rpcError } = await supabase.rpc('owner_review_termination_request', {
        p_termination_request_id: requestId,
        p_status: status,
        p_review_notes: null,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to review termination request.');

      setMessage(`Termination request ${status}.`);
      await loadData();
    } catch (reviewError) {
      const message = reviewError instanceof Error ? reviewError.message : 'Unable to review termination request.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function issueLoan() {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const { data, error: rpcError } = await supabase.rpc('owner_issue_employee_loan', {
        p_employee_id: selectedEmployeeId,
        p_principal_amount: Number(loanAmount),
        p_payment_terms: paymentTerms,
        p_start_date: loanStartDate || null,
        p_notes: loanNotes || null,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to issue employee loan.');

      setMessage('Employee loan created.');
      setLoanAmount('');
      setPaymentTerms('');
      setLoanStartDate('');
      setLoanNotes('');
      await loadData();
    } catch (loanError) {
      const message = loanError instanceof Error ? loanError.message : 'Unable to issue employee loan.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function recordRepayment(loanId: string) {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const { data, error: rpcError } = await supabase.rpc('owner_record_loan_repayment', {
        p_loan_id: loanId,
        p_amount: Number(repaymentAmounts[loanId] ?? 0),
        p_notes: null,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to record loan repayment.');

      setMessage('Loan repayment recorded.');
      setRepaymentAmounts((current) => ({ ...current, [loanId]: '' }));
      await loadData();
    } catch (repaymentError) {
      const message = repaymentError instanceof Error ? repaymentError.message : 'Unable to record loan repayment.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="section-title">People Ops</div>
      <p className="muted">Owner controls for unpaid leave and staff loans.</p>

      {loading ? <div className="info-box">Loading people ops...</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {message ? <div className="success-box">{message}</div> : null}

      <div className="contract-sheet">
        <div className="section-title">Loan Access by Staff</div>
        <p className="muted">Enable the loan feature only for the specific staff members who are allowed to use it.</p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Loan Access</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.full_name}<br /><span className="muted small">{employee.employee_number || '-'}</span></td>
                  <td>{employee.loan_feature_enabled ? 'Enabled' : 'Disabled'}</td>
                  <td>
                    <button className="secondary-btn" type="button" onClick={() => void toggleEmployeeLoanEnabled(employee)} disabled={saving}>
                      {employee.loan_feature_enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="contract-sheet">
        <div className="section-title">Leave Requests</div>
        {!leaveRequests.length ? (
          <div className="info-box">No leave requests yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Requested</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.employee_name}<br /><span className="muted small">{request.employee_number || '-'}</span></td>
                    <td>{formatDate(request.leave_date)}</td>
                    <td>{request.status}</td>
                    <td>{request.reason}</td>
                    <td>{formatDateTime(request.requested_at)}</td>
                    <td>
                      {request.status === 'requested' ? (
                        <div className="action-row wrap">
                          <button className="ghost-btn" type="button" onClick={() => void reviewLeaveRequest(request.id, 'approved')} disabled={saving}>
                            Approve
                          </button>
                          <button className="ghost-btn" type="button" onClick={() => void reviewLeaveRequest(request.id, 'rejected')} disabled={saving}>
                            Reject
                          </button>
                        </div>
                      ) : (
                        request.review_notes || '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="contract-sheet">
        <div className="section-title">Termination Requests</div>
        {!terminationRequests.length ? (
          <div className="info-box">No termination requests yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Requested</th>
                  <th>Last Working Day</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {terminationRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.employee_name}<br /><span className="muted small">{request.employee_number || '-'}</span></td>
                    <td>{formatDateTime(request.requested_at)}</td>
                    <td>{formatDate(request.requested_last_working_date)}</td>
                    <td>{request.status}</td>
                    <td>{request.reason}</td>
                    <td>
                      {request.status === 'requested' ? (
                        <div className="action-row wrap">
                          <button className="ghost-btn" type="button" onClick={() => void reviewTerminationRequest(request.id, 'approved')} disabled={saving}>
                            Approve
                          </button>
                          <button className="ghost-btn" type="button" onClick={() => void reviewTerminationRequest(request.id, 'rejected')} disabled={saving}>
                            Reject
                          </button>
                        </div>
                      ) : request.status === 'approved' ? (
                        <button className="secondary-btn" type="button" onClick={() => void reviewTerminationRequest(request.id, 'completed')} disabled={saving}>
                          Mark Completed
                        </button>
                      ) : (
                        request.review_notes || '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="contract-sheet">
        <div className="section-title">Issue Staff Loan</div>
        <div className="inline-stack" style={{ marginTop: '12px' }}>
          <select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)}>
            <option value="">Select employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employee_number || '-'} | {employee.full_name}
              </option>
            ))}
          </select>
          <input type="number" value={loanAmount} onChange={(event) => setLoanAmount(event.target.value)} placeholder="Loan amount" />
          <input type="date" value={loanStartDate} onChange={(event) => setLoanStartDate(event.target.value)} />
          <textarea
            value={paymentTerms}
            onChange={(event) => setPaymentTerms(event.target.value)}
            placeholder="Payment terms"
            rows={4}
            style={{ border: '1px solid #d7c9b6', borderRadius: '8px', padding: '10px', font: 'inherit' }}
          />
          <textarea
            value={loanNotes}
            onChange={(event) => setLoanNotes(event.target.value)}
            placeholder="Agreement notes"
            rows={3}
            style={{ border: '1px solid #d7c9b6', borderRadius: '8px', padding: '10px', font: 'inherit' }}
          />
          <button className="secondary-btn" type="button" onClick={() => void issueLoan()} disabled={saving || !employees.find((employee) => employee.id === selectedEmployeeId)?.loan_feature_enabled}>
            {saving ? 'Saving...' : 'Create Loan Agreement'}
          </button>
        </div>
      </div>

      <div className="contract-sheet">
        <div className="section-title">Loan Tracker</div>
        {!loans.length ? (
          <div className="info-box">No employee loans yet.</div>
        ) : (
          loans.map((loan) => (
            <div key={loan.id} style={{ borderBottom: '1px solid #eadfce', padding: '14px 0' }}>
              <strong>{loan.employees?.full_name || 'Employee'}</strong> ({loan.employees?.employee_number || '-'})
              <br />
              Principal: {money(loan.principal_amount)} | Outstanding: {money(loan.outstanding_balance)}
              <br />
              Terms: {loan.payment_terms}
              <br />
              Start: {formatDate(loan.start_date)} | Status: {loan.status}
              <br />
              <div className="action-row wrap" style={{ marginTop: '8px' }}>
                <button className="ghost-btn" type="button" onClick={() => printAgreement(loan)}>
                  Print Agreement
                </button>
                <input
                  type="number"
                  value={repaymentAmounts[loan.id] ?? ''}
                  onChange={(event) => setRepaymentAmounts((current) => ({ ...current, [loan.id]: event.target.value }))}
                  placeholder="Repayment amount"
                  style={{ width: '180px', border: '1px solid #d7c9b6', borderRadius: '8px', padding: '8px 10px' }}
                />
                <button className="secondary-btn" type="button" onClick={() => void recordRepayment(loan.id)} disabled={saving}>
                  Record Repayment
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
