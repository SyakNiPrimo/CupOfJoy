import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';

type ShiftRow = {
  id: string;
  shift_name: string;
  scheduled_start: string;
  scheduled_end: string;
};

type EmployeeRow = {
  id: string;
  employee_number: string | null;
  full_name: string;
  role_name: string | null;
  base_daily_rate: number | null;
  is_active: boolean;
};

type CreatedEmployeeResult = {
  employee: EmployeeRow;
  shift: {
    id: string;
    shift_name: string;
  };
  qrToken: string;
  effectiveFrom: string;
  workDays: string[];
};

const dayOptions = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid #d7c9b6',
  background: '#fffaf2',
  width: '100%',
  boxSizing: 'border-box',
};

const sectionCardStyle: React.CSSProperties = {
  background: '#f7f3ec',
  border: '1px solid #eadfce',
  borderRadius: '16px',
  padding: '14px',
  marginTop: '14px',
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'grid',
  gap: '6px',
  fontWeight: 700,
  color: '#3d2512',
};

const helpTextStyle: React.CSSProperties = {
  fontWeight: 400,
  fontSize: '13px',
  color: '#6b7280',
};

export default function EmployeeAdminPanel() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);

  const [fullName, setFullName] = useState('');
  const [roleName, setRoleName] = useState('Staff');
  const [baseDailyRate, setBaseDailyRate] = useState('200');
  const [shiftId, setShiftId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [workDays, setWorkDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat']);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [qrImageUrl, setQrImageUrl] = useState('');
  const [createdEmployee, setCreatedEmployee] = useState<CreatedEmployeeResult | null>(null);

  useEffect(() => {
    void loadReferenceData();
  }, []);

  async function loadReferenceData() {
    try {
      setError('');

      const { data: shiftRows, error: shiftError } = await supabase
        .from('shifts')
        .select('id, shift_name, scheduled_start, scheduled_end')
        .eq('is_active', true)
        .order('shift_name', { ascending: true });

      if (shiftError) throw shiftError;

      const { data: employeeRows, error: employeeError } = await supabase
        .from('employees')
        .select('id, employee_number, full_name, role_name, base_daily_rate, is_active')
        .eq('is_active', true)
        .order('employee_number', { ascending: true });

      if (employeeError) throw employeeError;

      setShifts((shiftRows ?? []) as ShiftRow[]);
      setEmployees((employeeRows ?? []) as EmployeeRow[]);

      if (!shiftId && shiftRows?.length) {
        setShiftId(shiftRows[0].id);
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Unable to load employee admin data.';
      setError(message);
    }
  }

  async function createEmployee() {
    try {
      setBusy(true);
      setError('');
      setSuccess('');
      setQrImageUrl('');
      setCreatedEmployee(null);

      if (!fullName.trim()) {
        throw new Error('Employee name is required.');
      }

      if (!roleName.trim()) {
        throw new Error('Role is required.');
      }

      if (!Number.isFinite(Number(baseDailyRate)) || Number(baseDailyRate) < 0) {
        throw new Error('Daily rate must be a valid amount.');
      }

      if (!shiftId) {
        throw new Error('Please select a shift.');
      }

      if (!workDays.length) {
        throw new Error('Please select at least one work day.');
      }

      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

if (refreshError || !refreshed.session?.access_token) {
  throw new Error('Owner login required. Please sign in again.');
}

      const { data: result, error: rpcError } = await supabase.rpc('admin_create_employee', {
        p_full_name: fullName,
        p_role_name: roleName,
        p_base_daily_rate: Number(baseDailyRate),
        p_shift_id: shiftId,
        p_effective_from: effectiveFrom || null,
        p_work_days: workDays,
      });

      if (rpcError) {
        throw new Error(
          rpcError.message ||
            'Supabase rejected the employee creation request. Make sure the fresh SQL setup was run.',
        );
      }

      const parsedResult =
        typeof result === 'string' ? (JSON.parse(result) as CreatedEmployeeResult & { success?: boolean; message?: string }) : result;

      if (!parsedResult?.success) {
        throw new Error(
          parsedResult?.message ||
            'Unable to create employee. Make sure you are signed in as the owner and the fresh SQL setup was run.',
        );
      }

      const qrUrl = await QRCode.toDataURL(parsedResult.qrToken, {
        width: 220,
        margin: 1,
      });

      setQrImageUrl(qrUrl);
      setCreatedEmployee(parsedResult as CreatedEmployeeResult);
      setSuccess(`Employee ${parsedResult.employee.employee_number} created and QR generated successfully.`);

      setFullName('');
      setRoleName('Staff');
      setBaseDailyRate('200');
      setEffectiveFrom('');
      setWorkDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat']);

      await loadReferenceData();
    } catch (createError) {
      const message =
        createError instanceof Error ? createError.message : 'Unable to create employee.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function toggleWorkDay(day: string) {
    setWorkDays((currentDays) =>
      currentDays.includes(day)
        ? currentDays.filter((currentDay) => currentDay !== day)
        : [...currentDays, day],
    );
  }

  function formatWorkDays(days: string[], emptyText = 'None selected') {
    if (!days.length) return emptyText;
    return dayOptions
      .filter((day) => days.includes(day.key))
      .map((day) => day.label.slice(0, 3))
      .join(', ');
  }

  return (
    <div style={sectionCardStyle}>
      <div className="section-title">Employee Onboarding</div>
      <p className="muted">
        Add the employee details, shift, and work days. The system creates the employee number and QR automatically.
      </p>

      {error ? <div className="error-box">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginTop: '12px',
        }}
      >
        <label style={fieldLabelStyle}>
          Employee name
          <input
            style={inputStyle}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Example: Juan Dela Cruz"
          />
        </label>

        <label style={fieldLabelStyle}>
          Role
          <input
            style={inputStyle}
            value={roleName}
            onChange={(event) => setRoleName(event.target.value)}
            placeholder="Example: Staff"
          />
        </label>

        <label style={fieldLabelStyle}>
          Daily rate
          <input
            style={inputStyle}
            value={baseDailyRate}
            onChange={(event) => setBaseDailyRate(event.target.value)}
            placeholder="Example: 500"
            type="number"
          />
        </label>

        <label style={fieldLabelStyle}>
          Shift
          <select style={inputStyle} value={shiftId} onChange={(event) => setShiftId(event.target.value)}>
            <option value="">Select shift</option>
            {shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>
                {shift.shift_name} | {shift.scheduled_start} to {shift.scheduled_end}
              </option>
            ))}
          </select>
        </label>

        <label style={fieldLabelStyle}>
          Schedule starts on
          <span style={helpTextStyle}>
            This is not the day off. This is the date when the selected schedule becomes active.
          </span>
          <input
            style={inputStyle}
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            type="date"
          />
        </label>
      </div>

      <div style={sectionCardStyle}>
        <div className="section-title">Work Days / Day Off</div>
        <p className="muted">
          Select the days when this employee has work. Unchecked days are treated as day off.
        </p>

        <div className="toggle-row wrap" style={{ marginTop: '12px' }}>
          {dayOptions.map((day) => (
            <button
              key={day.key}
              className={workDays.includes(day.key) ? 'toggle-btn active' : 'toggle-btn'}
              type="button"
              onClick={() => toggleWorkDay(day.key)}
            >
              {day.label}
            </button>
          ))}
        </div>

        <div className="info-box">
          Work days: <strong>{formatWorkDays(workDays)}</strong>
          <br />
          Day off:{' '}
          <strong>
            {formatWorkDays(
              dayOptions.map((day) => day.key).filter((day) => !workDays.includes(day)),
              'None',
            )}
          </strong>
        </div>
      </div>

      <div className="action-row wrap" style={{ marginTop: '12px' }}>
        <button className="secondary-btn" type="button" onClick={createEmployee} disabled={busy}>
          {busy ? 'Creating...' : 'Create Employee Number + QR'}
        </button>
      </div>

      {createdEmployee && qrImageUrl ? (
        <div style={sectionCardStyle}>
          <div className="section-title">Generated QR</div>
          <p className="muted">
            Save or print this QR for the new employee. This preview is generated from the secure token.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '18px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <img
              src={qrImageUrl}
              alt="Generated employee QR"
              style={{
                width: '220px',
                height: '220px',
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #eadfce',
              }}
            />

            <div>
              <strong>{createdEmployee.employee.full_name}</strong>
              <br />
              Employee No: {createdEmployee.employee.employee_number || '—'}
              <br />
              Role: {createdEmployee.employee.role_name || '—'}
              <br />
              Daily Rate: ₱{Number(createdEmployee.employee.base_daily_rate ?? 0).toFixed(2)}
              <br />
              Shift: {createdEmployee.shift.shift_name}
              <br />
              Effective From: {createdEmployee.effectiveFrom}
              <br />
              Work Days: {formatWorkDays(createdEmployee.workDays ?? [])}
              <br />
              <a
                href={qrImageUrl}
                download={`${createdEmployee.employee.employee_number ?? 'employee'}_${createdEmployee.employee.full_name.replace(/\s+/g, '_')}_qr.png`}
                style={{ display: 'inline-block', marginTop: '10px', color: '#8d5524', fontWeight: 700 }}
              >
                Download QR PNG
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <div style={sectionCardStyle}>
        <div className="section-title">Active Employees</div>

        {!employees.length ? (
          <div className="info-box">No active employees yet.</div>
        ) : (
          employees.map((employee) => (
            <div
              key={employee.id}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid #eadfce',
              }}
            >
              <strong>{employee.full_name}</strong>
              <br />
              Employee No: {employee.employee_number || '—'}
              <br />
              Role: {employee.role_name || '—'}
              <br />
              Daily Rate: ₱{Number(employee.base_daily_rate ?? 0).toFixed(2)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
