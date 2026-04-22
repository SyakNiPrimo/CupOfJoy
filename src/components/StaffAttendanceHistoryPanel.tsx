import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type StaffAttendanceHistoryPanelProps = {
  qrToken?: string | null;
};

type StaffSession = {
  employee_id: string;
  work_date: string;
  time_in_at: string;
  time_out_at: string | null;
  worked_hours: number | null;
  late_minutes: number;
  payroll_deduction: number;
  overtime_hours: number;
  overtime_pay: number;
  overtime_qualified?: boolean;
  full_day_paid?: boolean;
  regular_pay?: number;
  session_status: 'completed' | 'open';
};

type PayrollSummary = {
  cutoff_start?: string;
  cutoff_end?: string;
  cutoff_label?: string;
  payday?: string;
  completed_sessions?: number;
  paid_full_days?: number;
  daily_rate?: number;
  gross_regular_pay?: number;
  total_overtime_pay?: number;
  approved_overtime_pay?: number;
  overtime_status?: 'pending' | 'approved' | 'rejected';
  total_payroll_deduction?: number;
  net_pay?: number;
  payroll_status?: 'unpaid' | 'paid';
  payment_method?: 'cash' | 'gcash' | 'bank_transfer' | null;
  payment_reference?: string | null;
  paid_at?: string | null;
  payslip_expires_at?: string | null;
};

function formatDate(value?: string | null) {
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

function money(value?: number | null) {
  return `PHP ${Number(value ?? 0).toFixed(2)}`;
}

function formatDateOnly(value?: string | null) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function paymentMethodLabel(value?: PayrollSummary['payment_method']) {
  if (value === 'gcash') return 'GCash';
  if (value === 'bank_transfer') return 'Bank transfer';
  if (value === 'cash') return 'Cash';
  return '-';
}

function printPayslip(summary: PayrollSummary) {
  const popup = window.open('', '_blank', 'width=900,height=720');
  if (!popup) return;

  popup.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Cup of Joy Payslip</title>
        <style>
          body { font-family: Arial, sans-serif; color: #2c1b10; margin: 32px; }
          .sheet { max-width: 760px; margin: 0 auto; border: 1px solid #d9c8b3; padding: 28px; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          .muted { color: #6f6258; }
          .row { display: flex; justify-content: space-between; border-bottom: 1px solid #eadfce; padding: 10px 0; }
          .total { font-size: 20px; font-weight: 700; }
          @media print { button { display: none; } body { margin: 0; } .sheet { border: 0; } }
        </style>
      </head>
      <body>
        <div class="sheet">
          <h1>Cup of Joy Payslip</h1>
          <div class="muted">${summary.cutoff_label || 'Current cutoff'} | Payday ${formatDateOnly(summary.payday)}</div>
          <div style="margin-top: 18px;">
            <div class="row"><span>Status</span><strong>${summary.payroll_status || 'unpaid'}</strong></div>
            <div class="row"><span>Payment method</span><strong>${paymentMethodLabel(summary.payment_method)}</strong></div>
            <div class="row"><span>Payment reference</span><strong>${summary.payment_reference || '-'}</strong></div>
            <div class="row"><span>Paid at</span><strong>${formatDate(summary.paid_at)}</strong></div>
            <div class="row"><span>Completed sessions</span><strong>${summary.completed_sessions ?? 0}</strong></div>
            <div class="row"><span>Paid full days</span><strong>${summary.paid_full_days ?? 0}</strong></div>
            <div class="row"><span>Daily rate</span><strong>${money(summary.daily_rate)}</strong></div>
            <div class="row"><span>Gross regular pay</span><strong>${money(summary.gross_regular_pay)}</strong></div>
            <div class="row"><span>Overtime status</span><strong>${summary.overtime_status || 'pending'}</strong></div>
            <div class="row"><span>Approved overtime pay</span><strong>${money(summary.approved_overtime_pay)}</strong></div>
            <div class="row"><span>Raw overtime pay</span><strong>${money(summary.total_overtime_pay)}</strong></div>
            <div class="row"><span>Deductions</span><strong>${money(summary.total_payroll_deduction)}</strong></div>
            <div class="row total"><span>Net pay</span><strong>${money(summary.net_pay)}</strong></div>
          </div>
          <p class="muted">Payslip record expires ${formatDate(summary.payslip_expires_at)}.</p>
          <button onclick="window.print()">Print payslip</button>
        </div>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
}

export default function StaffAttendanceHistoryPanel({ qrToken = null }: StaffAttendanceHistoryPanelProps) {
  const [sessions, setSessions] = useState<StaffSession[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [payrollHistory, setPayrollHistory] = useState<PayrollSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadAttendance();
  }, [qrToken]);

  async function loadAttendance() {
    try {
      setLoading(true);
      setError('');

      const { data, error: rpcError } = await supabase.rpc('staff_dashboard', {
        p_qr_token: qrToken,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to load attendance history.');

      setSummary(data.currentSummary ?? null);
      setSessions((data.sessions ?? []) as StaffSession[]);
      setPayrollHistory((data.payrollHistory ?? []) as PayrollSummary[]);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load attendance history.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="section-title">Attendance History</div>
      <p className="muted">Current cutoff attendance and payroll details.</p>

      {loading ? <div className="info-box">Loading attendance...</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      {summary ? (
        <div className="contract-sheet">
          <div className="section-title">Payroll Invoice</div>
          <p className="muted">
            {summary.cutoff_label || 'Current cutoff'} | Payday {summary.payday || '-'}
          </p>

          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-label">Status</div>
              <div className="metric-value">{summary.payroll_status || 'unpaid'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Payment</div>
              <div className="metric-value">{paymentMethodLabel(summary.payment_method)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Paid Full Days</div>
              <div className="metric-value">{summary.paid_full_days ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Completed Sessions</div>
              <div className="metric-value">{summary.completed_sessions ?? 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Gross Pay</div>
              <div className="metric-value">{money(summary.gross_regular_pay)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">OT Status</div>
              <div className="metric-value">{summary.overtime_status || 'pending'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Approved OT</div>
              <div className="metric-value">{money(summary.approved_overtime_pay)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Deductions</div>
              <div className="metric-value">{money(summary.total_payroll_deduction)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Net Pay</div>
              <div className="metric-value">{money(summary.net_pay)}</div>
            </div>
          </div>

          {summary.payment_reference ? (
            <p className="muted small">Payment reference: {summary.payment_reference}</p>
          ) : null}

          <button className="secondary-btn" type="button" onClick={() => printPayslip(summary)}>
            Print payslip
          </button>
        </div>
      ) : null}

      {!sessions.length ? (
        <div className="info-box">No attendance history yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Worked Hours</th>
                <th>Paid Day</th>
                <th>Late</th>
                <th>Deduction</th>
                <th>OT Hours</th>
                <th>OT Pay</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={`${session.employee_id}-${session.time_in_at}`}>
                  <td>{session.work_date}</td>
                  <td>{formatDate(session.time_in_at)}</td>
                  <td>{session.time_out_at ? formatDate(session.time_out_at) : 'Open'}</td>
                  <td>{session.worked_hours ?? 0}</td>
                  <td>{session.full_day_paid ? money(session.regular_pay) : '-'}</td>
                  <td>{session.late_minutes ?? 0}</td>
                  <td>{money(session.payroll_deduction)}</td>
                  <td>{session.overtime_hours ?? 0}</td>
                  <td>{money(session.overtime_pay)}</td>
                  <td>{session.session_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="contract-sheet" style={{ marginTop: '18px' }}>
        <div className="section-title">Payroll History</div>
        <p className="muted">Your previous cutoff records, including how each payroll was paid.</p>

        {!payrollHistory.length ? (
          <div className="info-box">No payroll history yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cutoff</th>
                  <th>Payday</th>
                  <th>Status</th>
                  <th>Payment Method</th>
                  <th>Reference</th>
                  <th>Paid At</th>
                  <th>Net Pay</th>
                  <th>Payslip</th>
                </tr>
              </thead>
              <tbody>
                {payrollHistory.map((row) => (
                  <tr key={`payroll-history-${row.cutoff_start}-${row.cutoff_end}`}>
                    <td>{row.cutoff_label || '-'}</td>
                    <td>{formatDateOnly(row.payday)}</td>
                    <td>{row.payroll_status || 'unpaid'}</td>
                    <td>{paymentMethodLabel(row.payment_method)}</td>
                    <td>{row.payment_reference || '-'}</td>
                    <td>{formatDate(row.paid_at)}</td>
                    <td><strong>{money(row.net_pay)}</strong></td>
                    <td>
                      <button className="ghost-btn" type="button" onClick={() => printPayslip(row)}>
                        Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
