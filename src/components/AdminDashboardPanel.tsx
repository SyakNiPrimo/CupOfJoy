import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type CutoffPayrollRow = {
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  cutoff_start: string;
  cutoff_end: string;
  payday: string;
  cutoff_label: string;
  total_sessions: number;
  open_sessions: number;
  late_days: number;
  total_worked_hours: number;
  total_late_minutes: number;
  total_payroll_deduction: number;
  total_overtime_hours: number;
  total_overtime_pay: number;
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: 'auto',
  marginTop: '14px',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '14px',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  borderBottom: '1px solid #dccdb8',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid #eadfce',
  whiteSpace: 'nowrap',
};

function money(value?: number | null) {
  return `PHP ${Number(value ?? 0).toFixed(2)}`;
}

function numberValue(value?: number | null) {
  return Number(value ?? 0);
}

function formatDateOnly(value?: string | null) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminDashboardPanel() {
  const [activeEmployeeCount, setActiveEmployeeCount] = useState(0);
  const [allRows, setAllRows] = useState<CutoffPayrollRow[]>([]);
  const [selectedCutoffKey, setSelectedCutoffKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError('');

      const { count, error: employeeError } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      if (employeeError) throw employeeError;

      const { data: summaries, error: summaryError } = await supabase
        .from('cutoff_payroll_summary')
        .select('*')
        .order('cutoff_start', { ascending: false })
        .order('employee_name', { ascending: true });

      if (summaryError) throw summaryError;

      const rows = (summaries ?? []) as CutoffPayrollRow[];
      setActiveEmployeeCount(count ?? 0);
      setAllRows(rows);

      if (!rows.length) {
        setSelectedCutoffKey('');
        return;
      }

      const firstKey = `${rows[0].cutoff_start}__${rows[0].cutoff_end}`;
      setSelectedCutoffKey((current) => current || firstKey);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load admin dashboard.';
      setError(message);
    } finally {
      setLoading(false);
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

  const totals = useMemo(
    () => ({
      openSessions: rows.reduce((sum, row) => sum + numberValue(row.open_sessions), 0),
      lateDays: rows.reduce((sum, row) => sum + numberValue(row.late_days), 0),
      deductions: rows.reduce((sum, row) => sum + numberValue(row.total_payroll_deduction), 0),
    }),
    [rows],
  );

  return (
    <div className="panel">
      <div className="section-title">Dashboard</div>
      <p className="muted">Current cutoff overview for daily owner review.</p>

      {loading ? <div className="info-box">Loading dashboard...</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      {cutoffOptions.length ? (
        <div className="action-row wrap" style={{ marginTop: '12px' }}>
          <select
            value={selectedCutoffKey}
            onChange={(event) => setSelectedCutoffKey(event.target.value)}
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid #d7c9b6',
              background: '#fff',
              minWidth: '260px',
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

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Employees</div>
          <div className="metric-value">{activeEmployeeCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Open Sessions</div>
          <div className="metric-value">{totals.openSessions}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Late Days</div>
          <div className="metric-value">{totals.lateDays}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Deductions</div>
          <div className="metric-value">{money(totals.deductions)}</div>
        </div>
      </div>

      {!rows.length ? (
        <div className="info-box">No payroll rows yet for this cutoff.</div>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Employee No</th>
                <th style={thStyle}>Employee Name</th>
                <th style={thStyle}>Sessions</th>
                <th style={thStyle}>Worked Hours</th>
                <th style={thStyle}>Late Minutes</th>
                <th style={thStyle}>Deductions</th>
                <th style={thStyle}>OT Hours</th>
                <th style={thStyle}>OT Pay</th>
                <th style={thStyle}>Open Session</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.employee_id}-${row.cutoff_start}`}>
                  <td style={tdStyle}>{row.employee_number || '-'}</td>
                  <td style={tdStyle}>{row.employee_name}</td>
                  <td style={tdStyle}>{numberValue(row.total_sessions)}</td>
                  <td style={tdStyle}>{numberValue(row.total_worked_hours)}</td>
                  <td style={tdStyle}>{numberValue(row.total_late_minutes)}</td>
                  <td style={tdStyle}>{money(row.total_payroll_deduction)}</td>
                  <td style={tdStyle}>{numberValue(row.total_overtime_hours)}</td>
                  <td style={tdStyle}>{money(row.total_overtime_pay)}</td>
                  <td style={tdStyle}>{numberValue(row.open_sessions) > 0 ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
