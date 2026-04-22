import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type AttendanceSessionRow = {
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  work_date: string | null;
  time_in_id: string;
  time_in_at: string;
  time_out_id: string | null;
  time_out_at: string | null;
  worked_hours: number | null;
  late_minutes: number;
  payroll_deduction: number;
  session_status: 'open' | 'completed';
  correction_count: number;
};

type AttendanceCorrectionRow = {
  id: string;
  employee_id: string;
  employee_number: string | null;
  employee_name: string;
  event_type: 'time_in' | 'time_out';
  correction_type: 'edit_log' | 'manual_time_out' | 'manual_session';
  old_scanned_at: string | null;
  new_scanned_at: string | null;
  reason: string;
  corrected_by_name: string | null;
  corrected_at: string;
};

type EmployeeOption = {
  id: string;
  employee_number: string | null;
  full_name: string;
};

type EditorState =
  | {
      mode: 'edit';
      eventType: 'time_in' | 'time_out';
      attendanceLogId: string;
      employeeName: string;
      value: string;
    }
  | {
      mode: 'close-open-session';
      eventType: 'time_out';
      attendanceLogId: string;
      employeeName: string;
      value: string;
    }
  | null;

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

function money(value?: number | null) {
  return `PHP ${Number(value ?? 0).toFixed(2)}`;
}

function toManilaDateTimeLocal(value?: string | null) {
  if (!value) return '';

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

function toRpcTimestamp(value: string) {
  return `${value}:00+08:00`;
}

const emptyManualEntry = {
  employeeId: '',
  timeInAt: '',
  timeOutAt: '',
  reason: '',
};

export default function AdminAttendancePanel() {
  const [sessions, setSessions] = useState<AttendanceSessionRow[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrectionRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editor, setEditor] = useState<EditorState>(null);
  const [reason, setReason] = useState('');
  const [manualEntry, setManualEntry] = useState(emptyManualEntry);

  useEffect(() => {
    void Promise.all([loadAttendance(), loadEmployees()]);
  }, []);

  async function loadEmployees() {
    try {
      const { data, error: queryError } = await supabase
        .from('employees')
        .select('id, employee_number, full_name')
        .eq('is_active', true)
        .order('employee_number', { ascending: true, nullsFirst: false });

      if (queryError) throw queryError;
      setEmployees((data ?? []) as EmployeeOption[]);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load employees for manual attendance.';
      setError(message);
    }
  }

  async function loadAttendance() {
    try {
      setLoading(true);
      setError('');

      const { data, error: rpcError } = await supabase.rpc('owner_attendance_dashboard');
      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to load attendance corrections.');

      setSessions((data.sessions ?? []) as AttendanceSessionRow[]);
      setCorrections((data.corrections ?? []) as AttendanceCorrectionRow[]);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load attendance corrections.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function beginEdit(mode: EditorState) {
    setEditor(mode);
    setReason('');
    setError('');
    setSuccess('');
  }

  function cancelEdit() {
    setEditor(null);
    setReason('');
  }

  async function saveCorrection() {
    if (!editor) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      if (!editor.value) throw new Error('Choose the corrected date and time first.');
      if (reason.trim().length < 5) throw new Error('Please enter a clear correction reason.');

      if (editor.mode === 'edit') {
        const { data, error: rpcError } = await supabase.rpc('owner_update_attendance_log', {
          p_attendance_log_id: editor.attendanceLogId,
          p_corrected_scanned_at: toRpcTimestamp(editor.value),
          p_reason: reason.trim(),
        });

        if (rpcError) throw rpcError;
        if (!data?.success) throw new Error(data?.message || 'Unable to update attendance log.');
        setSuccess(data.message || 'Attendance log updated successfully.');
      } else {
        const { data, error: rpcError } = await supabase.rpc('owner_close_open_attendance_session', {
          p_time_in_log_id: editor.attendanceLogId,
          p_time_out_at: toRpcTimestamp(editor.value),
          p_reason: reason.trim(),
        });

        if (rpcError) throw rpcError;
        if (!data?.success) throw new Error(data?.message || 'Unable to add manual time out.');
        setSuccess(data.message || 'Manual time out recorded successfully.');
      }

      cancelEdit();
      await loadAttendance();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save attendance correction.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function saveManualAttendance() {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      if (!manualEntry.employeeId) {
        throw new Error('Choose the employee first.');
      }

      if (!manualEntry.timeInAt) {
        throw new Error('Enter the manual time in first.');
      }

      if (manualEntry.reason.trim().length < 5) {
        throw new Error('Please enter a clear reason for the manual attendance entry.');
      }

      const { data, error: rpcError } = await supabase.rpc('owner_create_manual_attendance_session', {
        p_employee_id: manualEntry.employeeId,
        p_time_in_at: toRpcTimestamp(manualEntry.timeInAt),
        p_time_out_at: manualEntry.timeOutAt ? toRpcTimestamp(manualEntry.timeOutAt) : null,
        p_reason: manualEntry.reason.trim(),
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to create manual attendance.');

      setSuccess(data.message || 'Manual attendance recorded successfully.');
      setManualEntry(emptyManualEntry);
      await loadAttendance();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to create manual attendance.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const openSessions = sessions.filter((session) => session.session_status === 'open');
  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === manualEntry.employeeId) ?? null,
    [employees, manualEntry.employeeId],
  );

  return (
    <div className="panel">
      <div className="section-title">Attendance Corrections</div>
      <p className="muted">Owner-only tools for fixing missed or incorrect time in and time out records.</p>

      {loading ? <div className="info-box">Loading attendance corrections...</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Open Sessions</div>
          <div className="metric-value">{openSessions.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Recent Sessions</div>
          <div className="metric-value">{sessions.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Audit Entries</div>
          <div className="metric-value">{corrections.length}</div>
        </div>
      </div>

      <div className="contract-sheet">
        <div className="section-title">Add Attendance for Employee</div>
        <p className="muted">
          Use this when a new employee already worked a shift and you need to encode the attendance manually from the
          owner side.
        </p>

        <div
          style={{
            display: 'grid',
            gap: '12px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            marginTop: '12px',
          }}
        >
          <label className="inline-stack">
            <span>Employee</span>
            <select
              value={manualEntry.employeeId}
              onChange={(event) => setManualEntry((current) => ({ ...current, employeeId: event.target.value }))}
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employee_number ? `${employee.employee_number} - ` : ''}
                  {employee.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-stack">
            <span>Manual time in</span>
            <input
              type="datetime-local"
              value={manualEntry.timeInAt}
              onChange={(event) => setManualEntry((current) => ({ ...current, timeInAt: event.target.value }))}
            />
          </label>

          <label className="inline-stack">
            <span>Manual time out (optional)</span>
            <input
              type="datetime-local"
              value={manualEntry.timeOutAt}
              onChange={(event) => setManualEntry((current) => ({ ...current, timeOutAt: event.target.value }))}
            />
          </label>
        </div>

        <label className="inline-stack" style={{ marginTop: '12px' }}>
          <span>Reason</span>
          <input
            type="text"
            value={manualEntry.reason}
            onChange={(event) => setManualEntry((current) => ({ ...current, reason: event.target.value }))}
            placeholder="Example: First day training shift was completed before QR label was printed."
          />
        </label>

        {selectedEmployee ? (
          <div className="info-box" style={{ marginTop: '12px' }}>
            Adding attendance for {selectedEmployee.full_name}
            {selectedEmployee.employee_number ? ` (${selectedEmployee.employee_number})` : ''}.
            {manualEntry.timeOutAt ? ' Both time in and time out will be saved.' : ' Only time in will be created for now.'}
          </div>
        ) : null}

        <div className="action-row wrap" style={{ marginTop: '12px' }}>
          <button className="secondary-btn" type="button" onClick={() => void saveManualAttendance()} disabled={saving}>
            {saving ? 'Saving...' : 'Add Attendance'}
          </button>
          <button className="ghost-btn" type="button" onClick={() => setManualEntry(emptyManualEntry)} disabled={saving}>
            Clear
          </button>
        </div>
      </div>

      {editor ? (
        <div className="contract-sheet">
          <div className="section-title">
            {editor.mode === 'edit'
              ? `Edit ${editor.eventType === 'time_in' ? 'Time In' : 'Time Out'}`
              : 'Add Missing Time Out'}
          </div>
          <p className="muted">{editor.employeeName}</p>

          <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
            <label className="inline-stack">
              <span>Corrected date and time</span>
              <input
                type="datetime-local"
                value={editor.value}
                onChange={(event) => setEditor({ ...editor, value: event.target.value })}
              />
            </label>

            <label className="inline-stack">
              <span>Reason for correction</span>
              <input
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Example: Staff forgot to time out after closing shift."
              />
            </label>
          </div>

          <div className="action-row wrap" style={{ marginTop: '12px' }}>
            <button className="secondary-btn" type="button" onClick={() => void saveCorrection()} disabled={saving}>
              {saving ? 'Saving...' : 'Save Correction'}
            </button>
            <button className="ghost-btn" type="button" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="contract-sheet">
        <div className="section-title">Recent Sessions</div>
        <p className="muted">Use this when a staff member scanned at the wrong time or forgot to time out.</p>

        {!sessions.length ? (
          <div className="info-box">No attendance sessions found yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee No</th>
                  <th>Employee</th>
                  <th>Work Date</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Worked Hours</th>
                  <th>Late</th>
                  <th>Deduction</th>
                  <th>Status</th>
                  <th>Corrections</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.time_in_id}>
                    <td>{session.employee_number || '-'}</td>
                    <td>{session.employee_name}</td>
                    <td>{session.work_date || '-'}</td>
                    <td>{formatDateTime(session.time_in_at)}</td>
                    <td>{formatDateTime(session.time_out_at)}</td>
                    <td>{Number(session.worked_hours ?? 0).toFixed(2)}</td>
                    <td>{session.late_minutes ?? 0}</td>
                    <td>{money(session.payroll_deduction)}</td>
                    <td>{session.session_status}</td>
                    <td>{session.correction_count ?? 0}</td>
                    <td>
                      <div className="action-row wrap">
                        <button
                          className="ghost-btn"
                          type="button"
                          onClick={() =>
                            beginEdit({
                              mode: 'edit',
                              eventType: 'time_in',
                              attendanceLogId: session.time_in_id,
                              employeeName: session.employee_name,
                              value: toManilaDateTimeLocal(session.time_in_at),
                            })
                          }
                        >
                          Edit Time In
                        </button>
                        {session.time_out_id ? (
                          <button
                            className="ghost-btn"
                            type="button"
                            onClick={() =>
                              beginEdit({
                                mode: 'edit',
                                eventType: 'time_out',
                                attendanceLogId: session.time_out_id!,
                                employeeName: session.employee_name,
                                value: toManilaDateTimeLocal(session.time_out_at),
                              })
                            }
                          >
                            Edit Time Out
                          </button>
                        ) : (
                          <button
                            className="secondary-btn"
                            type="button"
                            onClick={() =>
                              beginEdit({
                                mode: 'close-open-session',
                                eventType: 'time_out',
                                attendanceLogId: session.time_in_id,
                                employeeName: session.employee_name,
                                value: toManilaDateTimeLocal(session.time_in_at),
                              })
                            }
                          >
                            Add Time Out
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="contract-sheet">
        <div className="section-title">Recent Audit Trail</div>
        <p className="muted">Shows who changed the record, what changed, and when the correction happened.</p>

        {!corrections.length ? (
          <div className="info-box">No attendance corrections yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Corrected By</th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((correction) => (
                  <tr key={correction.id}>
                    <td>{formatDateTime(correction.corrected_at)}</td>
                    <td>
                      {correction.employee_name}
                      <br />
                      <span className="muted small">{correction.employee_number || '-'}</span>
                    </td>
                    <td>
                      {correction.correction_type === 'manual_time_out'
                        ? 'Manual Time Out'
                        : correction.correction_type === 'manual_session'
                          ? 'Manual Session'
                          : 'Edited Log'}
                      <br />
                      <span className="muted small">{correction.event_type}</span>
                    </td>
                    <td>{formatDateTime(correction.old_scanned_at)}</td>
                    <td>{formatDateTime(correction.new_scanned_at)}</td>
                    <td>{correction.reason}</td>
                    <td>{correction.corrected_by_name || 'Owner'}</td>
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
