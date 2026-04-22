import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type PayrollRow = {
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  cutoff_start: string;
  cutoff_end: string;
  payday: string;
  cutoff_label: string;
  completed_sessions: number;
  paid_full_days: number;
  open_sessions: number;
  daily_rate: number;
  gross_regular_pay: number;
  total_payroll_deduction: number;
  total_overtime_pay: number;
  approved_overtime_pay: number;
  overtime_status: 'pending' | 'approved' | 'rejected';
  net_pay: number;
  payroll_status: 'unpaid' | 'paid';
  payment_method: 'cash' | 'gcash' | 'bank_transfer' | null;
  payment_reference: string | null;
  paid_at: string | null;
  payroll_notes?: string | null;
  payslip_stored_at?: string | null;
  payslip_expires_at?: string | null;
};

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

function paymentMethodLabel(value?: PayrollRow['payment_method']) {
  if (value === 'gcash') return 'GCash';
  if (value === 'bank_transfer') return 'Bank transfer';
  if (value === 'cash') return 'Cash';
  return '-';
}

function csvValue(value: string | number | null | undefined) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildPayslipHtml(row: PayrollRow) {
  return `
    <!doctype html>
    <html>
      <head>
        <title>Payslip - ${row.employee_name}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #2c1b10; margin: 32px; }
          .sheet { max-width: 760px; margin: 0 auto; border: 1px solid #d9c8b3; padding: 28px; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          .muted { color: #6f6258; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-top: 20px; }
          .row { display: flex; justify-content: space-between; border-bottom: 1px solid #eadfce; padding: 10px 0; }
          .total { font-size: 20px; font-weight: 700; }
          @media print { button { display: none; } body { margin: 0; } .sheet { border: 0; } }
        </style>
      </head>
      <body>
        <div class="sheet">
          <h1>Cup of Joy Payslip</h1>
          <div class="muted">${row.cutoff_label} | Payday ${formatDateOnly(row.payday)}</div>
          <div class="grid">
            <div><strong>Employee</strong><br>${row.employee_name}</div>
            <div><strong>Employee No.</strong><br>${row.employee_number || '-'}</div>
            <div><strong>Status</strong><br>${row.payroll_status}</div>
            <div><strong>Payment</strong><br>${paymentMethodLabel(row.payment_method)}</div>
            <div><strong>Paid At</strong><br>${formatDateTime(row.paid_at)}</div>
            <div><strong>Reference</strong><br>${row.payment_reference || '-'}</div>
          </div>
          <div style="margin-top: 24px;">
            <div class="row"><span>Completed sessions</span><strong>${row.completed_sessions}</strong></div>
            <div class="row"><span>Paid full days</span><strong>${row.paid_full_days}</strong></div>
            <div class="row"><span>Daily rate</span><strong>${money(row.daily_rate)}</strong></div>
            <div class="row"><span>Gross regular pay</span><strong>${money(row.gross_regular_pay)}</strong></div>
            <div class="row"><span>Overtime status</span><strong>${row.overtime_status}</strong></div>
            <div class="row"><span>Raw overtime pay</span><strong>${money(row.total_overtime_pay)}</strong></div>
            <div class="row"><span>Approved overtime pay</span><strong>${money(row.approved_overtime_pay)}</strong></div>
            <div class="row"><span>Deductions</span><strong>${money(row.total_payroll_deduction)}</strong></div>
            <div class="row total"><span>Net pay</span><strong>${money(row.net_pay)}</strong></div>
          </div>
          <p class="muted">Payslip record expires ${formatDateTime(row.payslip_expires_at)}.</p>
          <button onclick="window.print()">Print payslip</button>
        </div>
      </body>
    </html>
  `;
}

function printPayslip(row: PayrollRow) {
  const popup = window.open('', '_blank', 'width=900,height=720');
  if (!popup) return;
  popup.document.write(buildPayslipHtml(row));
  popup.document.close();
  popup.focus();
}

export default function AdminPayrollPanel() {
  const [allRows, setAllRows] = useState<PayrollRow[]>([]);
  const [selectedCutoffKey, setSelectedCutoffKey] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<Record<string, 'cash' | 'gcash' | 'bank_transfer'>>({});
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});
  const [historyEmployeeFilter, setHistoryEmployeeFilter] = useState('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState<'all' | 'cash' | 'gcash' | 'bank_transfer' | 'unassigned'>('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatingKey, setUpdatingKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadPayroll();
  }, []);

  async function loadPayroll() {
    try {
      setLoading(true);
      setError('');

      const { data, error: payrollError } = await supabase
        .from('cutoff_payroll_summary')
        .select('*')
        .order('cutoff_start', { ascending: false })
        .order('employee_name', { ascending: true });

      if (payrollError) throw payrollError;

      const rows = (data ?? []) as PayrollRow[];
      setAllRows(rows);

      if (!rows.length) {
        setSelectedCutoffKey('');
        return;
      }

      setSelectedCutoffKey((current) => current || `${rows[0].cutoff_start}__${rows[0].cutoff_end}`);
    } catch (loadError) {
      const errorMessage = loadError instanceof Error ? loadError.message : 'Unable to load payroll.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function setPayrollStatus(row: PayrollRow, status: 'unpaid' | 'paid') {
    const key = `${row.employee_id}-${row.cutoff_start}`;
    const paymentMethod = paymentMethods[key] ?? row.payment_method ?? 'cash';
    const paymentReference = paymentReferences[key] ?? row.payment_reference ?? '';

    try {
      setUpdatingKey(key);
      setError('');
      setMessage('');

      const { data, error: rpcError } = await supabase.rpc('admin_set_payroll_status', {
        p_employee_id: row.employee_id,
        p_cutoff_start: row.cutoff_start,
        p_cutoff_end: row.cutoff_end,
        p_status: status,
        p_payment_method: status === 'paid' ? paymentMethod : null,
        p_payment_reference: status === 'paid' ? paymentReference : null,
        p_notes: null,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to update payroll status.');

      setMessage(`${row.employee_name} marked as ${status}.`);
      await loadPayroll();
    } catch (updateError) {
      const errorMessage = updateError instanceof Error ? updateError.message : 'Unable to update payroll status.';
      setError(errorMessage);
    } finally {
      setUpdatingKey('');
    }
  }

  async function setOvertimeStatus(row: PayrollRow, status: 'pending' | 'approved' | 'rejected') {
    const key = `ot-${row.employee_id}-${row.cutoff_start}`;

    try {
      setUpdatingKey(key);
      setError('');
      setMessage('');

      const { data, error: rpcError } = await supabase.rpc('owner_set_overtime_status', {
        p_employee_id: row.employee_id,
        p_cutoff_start: row.cutoff_start,
        p_cutoff_end: row.cutoff_end,
        p_status: status,
        p_notes: null,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to update overtime approval.');

      setMessage(`${row.employee_name} overtime marked as ${status}.`);
      await loadPayroll();
    } catch (updateError) {
      const errorMessage = updateError instanceof Error ? updateError.message : 'Unable to update overtime approval.';
      setError(errorMessage);
    } finally {
      setUpdatingKey('');
    }
  }

  const cutoffOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; payday: string }>();

    for (const row of allRows) {
      const key = `${row.cutoff_start}__${row.cutoff_end}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: row.cutoff_label,
          payday: row.payday,
        });
      }
    }

    return Array.from(map.values());
  }, [allRows]);

  const rows = useMemo(() => {
    if (!selectedCutoffKey) return [];
    const [cutoffStart, cutoffEnd] = selectedCutoffKey.split('__');
    return allRows.filter((row) => row.cutoff_start === cutoffStart && row.cutoff_end === cutoffEnd);
  }, [allRows, selectedCutoffKey]);

  const historyEmployeeOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const row of allRows) {
      if (!map.has(row.employee_id)) {
        map.set(row.employee_id, {
          id: row.employee_id,
          label: `${row.employee_name} (${row.employee_number || '-'})`,
        });
      }
    }
    return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label));
  }, [allRows]);

  const payrollHistoryRows = useMemo(() => {
    return allRows.filter((row) => {
      if (historyEmployeeFilter !== 'all' && row.employee_id !== historyEmployeeFilter) {
        return false;
      }

      if (historyStatusFilter !== 'all' && row.payroll_status !== historyStatusFilter) {
        return false;
      }

      if (historyPaymentFilter !== 'all') {
        if (historyPaymentFilter === 'unassigned') {
          if (row.payment_method !== null) {
            return false;
          }
        } else if (row.payment_method !== historyPaymentFilter) {
          return false;
        }
      }

      if (historyDateFrom && row.payday < historyDateFrom) {
        return false;
      }

      if (historyDateTo && row.payday > historyDateTo) {
        return false;
      }

      return true;
    });
  }, [
    allRows,
    historyDateFrom,
    historyDateTo,
    historyEmployeeFilter,
    historyPaymentFilter,
    historyStatusFilter,
  ]);

  const historyTotals = useMemo(() => {
    return payrollHistoryRows.reduce(
      (totals, row) => {
        totals.count += 1;
        totals.netPay += Number(row.net_pay ?? 0);
        totals.grossPay += Number(row.gross_regular_pay ?? 0);
        totals.deductions += Number(row.total_payroll_deduction ?? 0);
        totals.approvedOt += Number(row.approved_overtime_pay ?? 0);
        return totals;
      },
      { count: 0, netPay: 0, grossPay: 0, deductions: 0, approvedOt: 0 },
    );
  }, [payrollHistoryRows]);

  function applyQuickFilter(type: 'this-month' | 'paid-only' | 'gcash-only') {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    if (type === 'this-month') {
      setHistoryDateFrom(`${year}-${month}-01`);
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      setHistoryDateTo(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
      return;
    }

    if (type === 'paid-only') {
      setHistoryStatusFilter('paid');
      return;
    }

    setHistoryPaymentFilter('gcash');
  }

  function exportPayrollHistoryCsv() {
    if (!payrollHistoryRows.length) {
      setError('No payroll history matched the selected filters.');
      return;
    }

    const rows = [
      [
        'Cutoff',
        'Employee Number',
        'Employee Name',
        'Payday',
        'Payroll Status',
        'Payment Method',
        'Payment Reference',
        'Paid At',
        'Paid Full Days',
        'Completed Sessions',
        'Gross Pay',
        'Approved OT',
        'Deductions',
        'Net Pay',
      ].join(','),
      ...payrollHistoryRows.map((row) =>
        [
          csvValue(row.cutoff_label),
          csvValue(row.employee_number),
          csvValue(row.employee_name),
          csvValue(row.payday),
          csvValue(row.payroll_status),
          csvValue(paymentMethodLabel(row.payment_method)),
          csvValue(row.payment_reference),
          csvValue(formatDateTime(row.paid_at)),
          csvValue(row.paid_full_days),
          csvValue(row.completed_sessions),
          csvValue(Number(row.gross_regular_pay ?? 0).toFixed(2)),
          csvValue(Number(row.approved_overtime_pay ?? 0).toFixed(2)),
          csvValue(Number(row.total_payroll_deduction ?? 0).toFixed(2)),
          csvValue(Number(row.net_pay ?? 0).toFixed(2)),
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cup_of_joy_payroll_history_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="panel">
      <div className="section-title">Payroll</div>
      <p className="muted">Review employee payroll invoices, mark each cutoff as paid or unpaid, and keep a running payroll ledger.</p>

      {loading ? <div className="info-box">Loading payroll...</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {message ? <div className="success-box">{message}</div> : null}

      {cutoffOptions.length ? (
        <div className="action-row wrap" style={{ marginTop: '12px' }}>
          <select
            value={selectedCutoffKey}
            onChange={(event) => setSelectedCutoffKey(event.target.value)}
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid #d7c9b6',
              minWidth: '260px',
              background: '#fff',
            }}
          >
            {cutoffOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label} | Payday {formatDateOnly(option.payday)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!rows.length ? (
        <div className="info-box">No payroll rows yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Payday</th>
                <th>Paid Days</th>
                <th>Gross</th>
                <th>OT Review</th>
                <th>OT Pay</th>
                <th>Deductions</th>
                <th>Net Pay</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Paid At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = `${row.employee_id}-${row.cutoff_start}`;
                return (
                  <tr key={key}>
                    <td>
                      {row.employee_name}
                      <br />
                      <span className="muted small">{row.employee_number || '-'}</span>
                    </td>
                    <td>{formatDateOnly(row.payday)}</td>
                    <td>
                      {row.paid_full_days}
                      <br />
                      <span className="muted small">{row.completed_sessions} completed</span>
                    </td>
                    <td>{money(row.gross_regular_pay)}</td>
                    <td>
                      <div>{row.overtime_status}</div>
                      <div className="action-row wrap" style={{ marginTop: '6px' }}>
                        <button
                          className="ghost-btn"
                          onClick={() => void setOvertimeStatus(row, 'approved')}
                          type="button"
                          disabled={updatingKey === `ot-${row.employee_id}-${row.cutoff_start}`}
                        >
                          Approve
                        </button>
                        <button
                          className="ghost-btn"
                          onClick={() => void setOvertimeStatus(row, 'rejected')}
                          type="button"
                          disabled={updatingKey === `ot-${row.employee_id}-${row.cutoff_start}`}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                    <td>
                      {money(row.approved_overtime_pay)}
                      <br />
                      <span className="muted small">raw {money(row.total_overtime_pay)}</span>
                    </td>
                    <td>{money(row.total_payroll_deduction)}</td>
                    <td><strong>{money(row.net_pay)}</strong></td>
                    <td>{row.payroll_status}</td>
                    <td>
                      {row.payroll_status === 'paid' ? (
                        <>
                          {paymentMethodLabel(row.payment_method)}
                          {row.payment_reference ? (
                            <>
                              <br />
                              <span className="muted small">{row.payment_reference}</span>
                            </>
                          ) : null}
                        </>
                      ) : (
                        <div className="inline-stack">
                          <select
                            value={paymentMethods[key] ?? row.payment_method ?? 'cash'}
                            onChange={(event) =>
                              setPaymentMethods((current) => ({
                                ...current,
                                [key]: event.target.value as 'cash' | 'gcash' | 'bank_transfer',
                              }))
                            }
                          >
                            <option value="cash">Cash</option>
                            <option value="gcash">GCash</option>
                            <option value="bank_transfer">Bank transfer</option>
                          </select>
                          <input
                            value={paymentReferences[key] ?? row.payment_reference ?? ''}
                            onChange={(event) =>
                              setPaymentReferences((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }))
                            }
                            placeholder="Reference optional"
                          />
                        </div>
                      )}
                    </td>
                    <td>{formatDateTime(row.paid_at)}</td>
                    <td>
                      {row.payroll_status === 'paid' ? (
                        <div className="action-row wrap">
                          <button
                            className="ghost-btn"
                            onClick={() => void setPayrollStatus(row, 'unpaid')}
                            type="button"
                            disabled={updatingKey === key}
                          >
                            Mark Unpaid
                          </button>
                          <button className="secondary-btn" onClick={() => printPayslip(row)} type="button">
                            Print
                          </button>
                        </div>
                      ) : (
                        <div className="action-row wrap">
                          <button
                            className="secondary-btn"
                            onClick={() => void setPayrollStatus(row, 'paid')}
                            type="button"
                            disabled={updatingKey === key}
                          >
                            Mark Paid
                          </button>
                          <button className="ghost-btn" onClick={() => printPayslip(row)} type="button">
                            Print
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="contract-sheet" style={{ marginTop: '18px' }}>
        <div className="section-title">Payroll History</div>
        <p className="muted">Every recorded cutoff appears here, including status, payment method, and paid date.</p>

        <div className="action-row wrap" style={{ marginTop: '12px' }}>
          <button className="ghost-btn" type="button" onClick={() => applyQuickFilter('this-month')}>
            This Month
          </button>
          <button className="ghost-btn" type="button" onClick={() => applyQuickFilter('paid-only')}>
            Paid Only
          </button>
          <button className="ghost-btn" type="button" onClick={() => applyQuickFilter('gcash-only')}>
            GCash Only
          </button>
          <button className="secondary-btn" type="button" onClick={exportPayrollHistoryCsv}>
            Export CSV
          </button>
        </div>

        <div
          className="contract-grid"
          style={{ marginTop: '12px' }}
        >
          <label className="inline-stack">
            <span className="muted small">Employee</span>
            <select value={historyEmployeeFilter} onChange={(event) => setHistoryEmployeeFilter(event.target.value)}>
              <option value="all">All employees</option>
              {historyEmployeeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-stack">
            <span className="muted small">Date from</span>
            <input type="date" value={historyDateFrom} onChange={(event) => setHistoryDateFrom(event.target.value)} />
          </label>

          <label className="inline-stack">
            <span className="muted small">Date to</span>
            <input type="date" value={historyDateTo} onChange={(event) => setHistoryDateTo(event.target.value)} />
          </label>

          <label className="inline-stack">
            <span className="muted small">Paid / Unpaid</span>
            <select
              value={historyStatusFilter}
              onChange={(event) => setHistoryStatusFilter(event.target.value as 'all' | 'paid' | 'unpaid')}
            >
              <option value="all">All statuses</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </label>

          <label className="inline-stack">
            <span className="muted small">Payment method</span>
            <select
              value={historyPaymentFilter}
              onChange={(event) =>
                setHistoryPaymentFilter(
                  event.target.value as 'all' | 'cash' | 'gcash' | 'bank_transfer' | 'unassigned',
                )
              }
            >
              <option value="all">All methods</option>
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="unassigned">No payment method yet</option>
            </select>
          </label>

          <div className="inline-stack" style={{ alignSelf: 'end' }}>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => {
                setHistoryEmployeeFilter('all');
                setHistoryDateFrom('');
                setHistoryDateTo('');
                setHistoryStatusFilter('all');
                setHistoryPaymentFilter('all');
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>

        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-label">Filtered Records</div>
            <div className="metric-value">{historyTotals.count}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Gross Pay Total</div>
            <div className="metric-value">{money(historyTotals.grossPay)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Approved OT Total</div>
            <div className="metric-value">{money(historyTotals.approvedOt)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Deductions Total</div>
            <div className="metric-value">{money(historyTotals.deductions)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Net Pay Total</div>
            <div className="metric-value">{money(historyTotals.netPay)}</div>
          </div>
        </div>

        {!payrollHistoryRows.length ? (
          <div className="info-box">No payroll history matched the selected filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cutoff</th>
                  <th>Employee</th>
                  <th>Payday</th>
                  <th>Net Pay</th>
                  <th>Status</th>
                  <th>Payment Method</th>
                  <th>Reference</th>
                  <th>Paid At</th>
                  <th>Payslip</th>
                </tr>
              </thead>
              <tbody>
                {payrollHistoryRows.map((row) => (
                  <tr key={`history-${row.employee_id}-${row.cutoff_start}-${row.cutoff_end}`}>
                    <td>{row.cutoff_label}</td>
                    <td>
                      {row.employee_name}
                      <br />
                      <span className="muted small">{row.employee_number || '-'}</span>
                    </td>
                    <td>{formatDateOnly(row.payday)}</td>
                    <td><strong>{money(row.net_pay)}</strong></td>
                    <td>{row.payroll_status}</td>
                    <td>{paymentMethodLabel(row.payment_method)}</td>
                    <td>{row.payment_reference || '-'}</td>
                    <td>{formatDateTime(row.paid_at)}</td>
                    <td>
                      <button className="ghost-btn" onClick={() => printPayslip(row)} type="button">
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
