import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';
import {
  buildContractFilename,
  buildContractPdfBlob,
  ContractInfo,
  openContractPrintView,
} from '../lib/contractDocument';

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
  employee_email?: string | null;
  phone_number?: string | null;
  qr_token_value?: string | null;
  role_name: string | null;
  first_week_daily_rate?: number | null;
  base_daily_rate: number | null;
  work_days?: string[];
  contract_status?: string | null;
  contract_sent_at?: string | null;
  contract_due_at?: string | null;
  contract_signed_at?: string | null;
  contract_document_path?: string | null;
  contract_signed_copy_path?: string | null;
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

type QrPreviewState = {
  employee: EmployeeRow;
  qrImageUrl: string;
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

function formatWorkDays(days: string[], emptyText = 'None selected') {
  if (!days.length) return emptyText;
  return dayOptions
    .filter((day) => days.includes(day.key))
    .map((day) => day.label.slice(0, 3))
    .join(', ');
}

function computeRestDays(workDays: string[]) {
  return dayOptions.map((day) => day.key).filter((day) => !workDays.includes(day));
}

export default function EmployeeAdminPanel() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);

  const [fullName, setFullName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [roleName, setRoleName] = useState('Staff');
  const [firstWeekDailyRate, setFirstWeekDailyRate] = useState('250');
  const [baseDailyRate, setBaseDailyRate] = useState('300');
  const [shiftId, setShiftId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [workDays, setWorkDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdEmployee, setCreatedEmployee] = useState<CreatedEmployeeResult | null>(null);
  const [qrPreview, setQrPreview] = useState<QrPreviewState | null>(null);

  const [editingEmployeeId, setEditingEmployeeId] = useState('');
  const [editFirstWeekDailyRate, setEditFirstWeekDailyRate] = useState('250');
  const [editBaseDailyRate, setEditBaseDailyRate] = useState('300');
  const [editWorkDays, setEditWorkDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const activeEmployees = employees.filter((employee) => employee.is_active);
  const inactiveEmployees = employees.filter((employee) => !employee.is_active);

  useEffect(() => {
    void loadReferenceData();
  }, []);

  useEffect(() => {
    function handlePointerDown() {
      setOpenActionMenuId(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  async function loadReferenceData() {
    try {
      setError('');

      const [{ data: shiftRows, error: shiftError }, { data: employeeRows, error: employeeError }, { data: assignmentRows, error: assignmentError }] =
        await Promise.all([
          supabase
            .from('shifts')
            .select('id, shift_name, scheduled_start, scheduled_end')
            .eq('is_active', true)
            .order('shift_name', { ascending: true }),
          supabase
            .from('employees')
            .select('id, employee_number, full_name, employee_email, phone_number, qr_token_value, role_name, first_week_daily_rate, base_daily_rate, contract_status, contract_sent_at, contract_due_at, contract_signed_at, contract_document_path, contract_signed_copy_path, is_active')
            .order('employee_number', { ascending: true }),
          supabase
            .from('employee_shift_assignments')
            .select('employee_id, work_days, effective_from, effective_to')
            .order('effective_from', { ascending: false }),
        ]);

      if (shiftError) throw shiftError;
      if (employeeError) throw employeeError;
      if (assignmentError) throw assignmentError;

      const assignmentMap = new Map<string, string[]>();
      for (const assignment of assignmentRows ?? []) {
        const employeeId = (assignment as { employee_id: string }).employee_id;
        if (!assignmentMap.has(employeeId)) {
          assignmentMap.set(employeeId, ((assignment as { work_days?: string[] }).work_days ?? []));
        }
      }

      setShifts((shiftRows ?? []) as ShiftRow[]);
      setEmployees(
        ((employeeRows ?? []) as EmployeeRow[]).map((employee) => ({
          ...employee,
          work_days: assignmentMap.get(employee.id) ?? [],
        })),
      );

      if (!shiftId && shiftRows?.length) {
        setShiftId(shiftRows[0].id);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load employee admin data.';
      setError(message);
    }
  }

  async function createEmployee() {
    try {
      setBusy(true);
      setError('');
      setSuccess('');
      setCreatedEmployee(null);

      if (!fullName.trim()) throw new Error('Employee name is required.');
      if (!roleName.trim()) throw new Error('Role is required.');
      if (!Number.isFinite(Number(baseDailyRate)) || Number(baseDailyRate) < 0) {
        throw new Error('Regular daily rate must be a valid amount.');
      }
      if (!Number.isFinite(Number(firstWeekDailyRate)) || Number(firstWeekDailyRate) < 0) {
        throw new Error('First week daily rate must be a valid amount.');
      }
      if (!shiftId) throw new Error('Please select a shift.');
      if (!workDays.length) throw new Error('Please select at least one work day.');
      if (workDays.length > 5) {
        throw new Error('Employees are entitled to 2 rest days. Please choose only 5 work days.');
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
        p_first_week_daily_rate: Number(firstWeekDailyRate),
        p_employee_email: employeeEmail || null,
        p_phone_number: phoneNumber || null,
      });

      if (rpcError) {
        throw new Error(
          rpcError.message || 'Supabase rejected the employee creation request. Make sure the fresh SQL setup was run.',
        );
      }

      const parsedResult =
        typeof result === 'string'
          ? (JSON.parse(result) as CreatedEmployeeResult & { success?: boolean; message?: string })
          : result;

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

      setCreatedEmployee(parsedResult as CreatedEmployeeResult);
      setQrPreview({
        employee: parsedResult.employee,
        qrImageUrl: qrUrl,
      });
      setSuccess(`Employee ${parsedResult.employee.employee_number} created and QR generated successfully.`);

      setFullName('');
      setEmployeeEmail('');
      setPhoneNumber('');
      setRoleName('Staff');
      setFirstWeekDailyRate('250');
      setBaseDailyRate('300');
      setEffectiveFrom('');
      setWorkDays(['mon', 'tue', 'wed', 'thu', 'fri']);

      await loadReferenceData();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Unable to create employee.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function toggleWorkDay(day: string) {
    setWorkDays((currentDays) =>
      currentDays.includes(day)
        ? currentDays.filter((currentDay) => currentDay !== day)
        : currentDays.length >= 5
          ? currentDays
          : [...currentDays, day],
    );
  }

  function toggleEditWorkDay(day: string) {
    setEditWorkDays((currentDays) =>
      currentDays.includes(day)
        ? currentDays.filter((currentDay) => currentDay !== day)
        : currentDays.length >= 5
          ? currentDays
          : [...currentDays, day],
    );
  }

  function openEditEmployee(employee: EmployeeRow) {
    setEditingEmployeeId(employee.id);
    setEditFirstWeekDailyRate(String(Number(employee.first_week_daily_rate ?? 250)));
    setEditBaseDailyRate(String(Number(employee.base_daily_rate ?? 300)));
    setEditWorkDays(employee.work_days?.length ? employee.work_days : ['mon', 'tue', 'wed', 'thu', 'fri']);
    setError('');
    setSuccess('');
  }

  async function saveEmployeeTerms() {
    try {
      setBusy(true);
      setError('');
      setSuccess('');

      if (!editingEmployeeId) throw new Error('Choose an employee to edit.');
      if (!Number.isFinite(Number(editFirstWeekDailyRate)) || Number(editFirstWeekDailyRate) < 0) {
        throw new Error('First week daily rate must be a valid amount.');
      }
      if (!Number.isFinite(Number(editBaseDailyRate)) || Number(editBaseDailyRate) < 0) {
        throw new Error('Regular daily rate must be a valid amount.');
      }
      if (!editWorkDays.length || editWorkDays.length > 5) {
        throw new Error('Choose up to 5 work days so the employee keeps 2 rest days.');
      }

      const { data, error: rpcError } = await supabase.rpc('owner_update_employee_terms', {
        p_employee_id: editingEmployeeId,
        p_first_week_daily_rate: Number(editFirstWeekDailyRate),
        p_base_daily_rate: Number(editBaseDailyRate),
        p_work_days: editWorkDays,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to update employee terms.');

      setSuccess('Employee terms updated successfully.');
      setEditingEmployeeId('');
      await loadReferenceData();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to update employee terms.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function setEmployeeActive(employee: EmployeeRow, nextIsActive: boolean) {
    try {
      setBusy(true);
      setError('');
      setSuccess('');

      if (!nextIsActive) {
        const confirmation = window.prompt(
          `Type the employee number for ${employee.full_name} to confirm deactivation.`,
          '',
        );

        if (confirmation === null) {
          return;
        }

        if ((confirmation || '').trim() !== (employee.employee_number || '').trim()) {
          throw new Error('Deactivation cancelled. Employee number did not match.');
        }
      }

      const { data, error: rpcError } = await supabase.rpc('owner_set_employee_active', {
        p_employee_id: employee.id,
        p_is_active: nextIsActive,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to update employee status.');

      setSuccess(data.message || (nextIsActive ? 'Employee reactivated successfully.' : 'Employee deactivated successfully.'));
      if (!nextIsActive && editingEmployeeId === employee.id) {
        setEditingEmployeeId('');
      }
      await loadReferenceData();
    } catch (statusError) {
      const message = statusError instanceof Error ? statusError.message : 'Unable to update employee status.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function dispatchContract(employee: EmployeeRow) {
    try {
      setBusy(true);
      setError('');
      setSuccess('');

      const email = (employee.employee_email || '').trim();
      if (!email) {
        throw new Error('Add the employee email first before sending the contract.');
      }

      const contract = await fetchOwnerContract(employee.id);
      const contractDocumentPath = await uploadContractDocument(contract);

      const { data, error: rpcError } = await supabase.rpc('owner_dispatch_employee_contract', {
        p_employee_id: employee.id,
        p_employee_email: email,
        p_contract_document_path: contractDocumentPath,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to send contract.');

      setSuccess(
        `Contract prepared for ${employee.full_name}. Download the sent contract file and email it manually. Once the signed copy is returned, mark the contract as signed or upload the signed copy from the employee portal.`,
      );
      await loadReferenceData();
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : 'Unable to send contract.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function fetchOwnerContract(employeeId: string) {
    const { data, error: rpcError } = await supabase.rpc('owner_employee_contract_info', {
      p_employee_id: employeeId,
    });

    if (rpcError) throw rpcError;
    if (!data?.success) throw new Error(data?.message || 'Unable to load employee contract.');
    return data.contract as ContractInfo;
  }

  async function uploadContractDocument(contract: ContractInfo) {
    const path = `contracts/${new Date().toISOString().slice(0, 10)}/${buildContractFilename(contract.employeeName)}.pdf`;
    const blob = buildContractPdfBlob(contract);

    const { error: uploadError } = await supabase.storage
      .from('contract-documents')
      .upload(path, blob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) throw uploadError;
    return path;
  }

  async function createContractSignedUrl(path: string) {
    const { data, error } = await supabase.storage.from('contract-documents').createSignedUrl(path, 60 * 60 * 4);
    if (error || !data?.signedUrl) throw error || new Error('Unable to create contract download link.');
    return data.signedUrl;
  }

  async function openStoredContract(path: string, bucket: 'contract-documents' | 'signed-contracts') {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 30);
    if (error || !data?.signedUrl) {
      throw error || new Error('Unable to open stored contract file.');
    }
    const anchor = document.createElement('a');
    anchor.href = data.signedUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();
  }

  async function setContractSigned(employee: EmployeeRow, signed: boolean) {
    try {
      setBusy(true);
      setError('');
      setSuccess('');

      const { data, error: rpcError } = await supabase.rpc('owner_set_employee_contract_signed', {
        p_employee_id: employee.id,
        p_signed: signed,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to update contract status.');

      setSuccess(data.message || (signed ? 'Contract marked as signed.' : 'Contract marked as awaiting signature.'));
      await loadReferenceData();
    } catch (contractError) {
      const message = contractError instanceof Error ? contractError.message : 'Unable to update contract status.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function openEmployeeQr(employee: EmployeeRow) {
    try {
      setBusy(true);
      setError('');
      setSuccess('');

      let qrToken = employee.qr_token_value || '';

      if (!qrToken) {
        const { data, error: rpcError } = await supabase.rpc('owner_reset_employee_qr', {
          p_employee_id: employee.id,
        });

        if (rpcError) throw rpcError;
        if (!data?.success) throw new Error(data?.message || 'Unable to generate employee QR.');

        qrToken = data.qrToken as string;
        setSuccess(`A new QR was generated for ${employee.full_name}. Please print the updated label for staff login.`);
      }

      const qrImageUrl = await QRCode.toDataURL(qrToken, {
        width: 260,
        margin: 1,
      });

      setQrPreview({
        employee: {
          ...employee,
          qr_token_value: qrToken,
        },
        qrImageUrl,
      });

      await loadReferenceData();
    } catch (qrError) {
      const message = qrError instanceof Error ? qrError.message : 'Unable to open employee QR.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function printQrLabel(employee: EmployeeRow, qrImageUrl: string) {
    const popup = window.open('', '_blank', 'width=720,height=960');
    if (!popup) {
      setError('Pop-up blocked. Please allow pop-ups to print the QR label.');
      return;
    }

    popup.document.write(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${employee.employee_number || 'EMPLOYEE'}_QR_LABEL</title>
          <style>
            body { font-family: Arial, sans-serif; background: #fff; color: #2b1d12; margin: 0; padding: 24px; }
            .sheet { max-width: 680px; margin: 0 auto; }
            .label-card { border: 2px solid #7c4a22; border-radius: 12px; padding: 24px; display: grid; gap: 14px; justify-items: center; }
            .brand { font-size: 28px; font-weight: 800; color: #5a3416; }
            .sub { font-size: 14px; color: #6b7280; }
            .employee { font-size: 22px; font-weight: 700; text-align: center; }
            .meta { font-size: 15px; text-align: center; line-height: 1.7; }
            .scan-note { border-top: 1px dashed #c7b49a; padding-top: 12px; text-align: center; font-size: 14px; }
            img { width: 280px; height: 280px; object-fit: contain; background: #fff; border: 1px solid #eadfce; padding: 10px; border-radius: 10px; }
            @media print {
              body { padding: 0; }
              .sheet { max-width: none; }
              .label-card { border-width: 1px; page-break-inside: avoid; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="label-card">
              <div class="brand">Cup of Joy</div>
              <div class="sub">Employee QR Login Label</div>
              <img src="${qrImageUrl}" alt="Employee QR code" />
              <div class="employee">${employee.full_name}</div>
              <div class="meta">
                Employee No: <strong>${employee.employee_number || '-'}</strong><br />
                Role: <strong>${employee.role_name || 'Staff'}</strong>
              </div>
              <div class="scan-note">
                Scan this code every time you log in for Time In / Time Out.
              </div>
              <button onclick="window.print()">Print Label</button>
            </div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
  }

  async function previewContract(employee: EmployeeRow) {
    try {
      setBusy(true);
      setError('');
      const contract = await fetchOwnerContract(employee.id);
      openContractPrintView(contract);
    } catch (previewError) {
      const message = previewError instanceof Error ? previewError.message : 'Unable to open employee contract.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function formatContractTimestamp(value?: string | null) {
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

  function renderEmployeeActions(employee: EmployeeRow) {
    const isOpen = openActionMenuId === employee.id;
    const contractSigned = employee.contract_status === 'signed';

    return (
      <div
        className="actions-menu"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          className="ghost-btn actions-menu-trigger"
          type="button"
          onClick={() => setOpenActionMenuId(isOpen ? null : employee.id)}
        >
          Actions
        </button>
        {isOpen ? (
          <div className="actions-menu-popover">
            <button className="actions-menu-item" type="button" onClick={() => { setOpenActionMenuId(null); openEditEmployee(employee); }}>
              Edit Terms
            </button>
            <button className="actions-menu-item" type="button" onClick={() => { setOpenActionMenuId(null); void openEmployeeQr(employee); }} disabled={busy}>
              View QR
            </button>
            <button className="actions-menu-item" type="button" onClick={() => { setOpenActionMenuId(null); void previewContract(employee); }} disabled={busy}>
              View Contract
            </button>
            <button className="actions-menu-item" type="button" onClick={() => { setOpenActionMenuId(null); void dispatchContract(employee); }} disabled={busy}>
              Send Contract
            </button>
            <button
              className="actions-menu-item"
              type="button"
              onClick={() => {
                setOpenActionMenuId(null);
                void setContractSigned(employee, !contractSigned);
              }}
              disabled={busy}
            >
              {contractSigned ? 'Mark Awaiting Signature' : 'Mark Contract Signed'}
            </button>
            {employee.contract_document_path ? (
              <button
                className="actions-menu-item"
                type="button"
                onClick={() => {
                  setOpenActionMenuId(null);
                  void openStoredContract(employee.contract_document_path!, 'contract-documents');
                }}
                disabled={busy}
              >
                Open Sent Contract
              </button>
            ) : null}
            {employee.contract_signed_copy_path ? (
              <button
                className="actions-menu-item"
                type="button"
                onClick={() => {
                  setOpenActionMenuId(null);
                  void openStoredContract(employee.contract_signed_copy_path!, 'signed-contracts');
                }}
                disabled={busy}
              >
                Open Signed Copy
              </button>
            ) : null}
            <button
              className="actions-menu-item danger"
              type="button"
              onClick={() => {
                setOpenActionMenuId(null);
                void setEmployeeActive(employee, false);
              }}
              disabled={busy}
            >
              Deactivate Employee
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderInactiveEmployeeActions(employee: EmployeeRow) {
    const isOpen = openActionMenuId === employee.id;

    return (
      <div
        className="actions-menu"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          className="ghost-btn actions-menu-trigger"
          type="button"
          onClick={() => setOpenActionMenuId(isOpen ? null : employee.id)}
        >
          Actions
        </button>
        {isOpen ? (
          <div className="actions-menu-popover">
            <button
              className="actions-menu-item"
              type="button"
              onClick={() => {
                setOpenActionMenuId(null);
                void setEmployeeActive(employee, true);
              }}
              disabled={busy}
            >
              Reactivate Employee
            </button>
            <button
              className="actions-menu-item"
              type="button"
              onClick={() => {
                setOpenActionMenuId(null);
                void openEmployeeQr(employee);
              }}
              disabled={busy}
            >
              View QR
            </button>
            <button
              className="actions-menu-item"
              type="button"
              onClick={() => {
                setOpenActionMenuId(null);
                void previewContract(employee);
              }}
              disabled={busy}
            >
              View Contract
            </button>
            {employee.contract_document_path ? (
              <button
                className="actions-menu-item"
                type="button"
                onClick={() => {
                  setOpenActionMenuId(null);
                  void openStoredContract(employee.contract_document_path!, 'contract-documents');
                }}
                disabled={busy}
              >
                Open Sent Contract
              </button>
            ) : null}
            {employee.contract_signed_copy_path ? (
              <button
                className="actions-menu-item"
                type="button"
                onClick={() => {
                  setOpenActionMenuId(null);
                  void openStoredContract(employee.contract_signed_copy_path!, 'signed-contracts');
                }}
                disabled={busy}
              >
                Open Signed Copy
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
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
          Employee email
          <span style={helpTextStyle}>Required for sending the contract that must be signed and returned within 3 hours.</span>
          <input
            style={inputStyle}
            value={employeeEmail}
            onChange={(event) => setEmployeeEmail(event.target.value)}
            placeholder="Example: staff@email.com"
            type="email"
          />
        </label>

        <label style={fieldLabelStyle}>
          Phone number
          <span style={helpTextStyle}>Used for employee contact records and future portal recovery flows.</span>
          <input
            style={inputStyle}
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="Example: 09171234567"
            type="tel"
          />
        </label>

        <label style={fieldLabelStyle}>
          First week daily rate
          <input
            style={inputStyle}
            value={firstWeekDailyRate}
            onChange={(event) => setFirstWeekDailyRate(event.target.value)}
            placeholder="Example: 250"
            type="number"
          />
        </label>

        <label style={fieldLabelStyle}>
          Regular daily rate
          <input
            style={inputStyle}
            value={baseDailyRate}
            onChange={(event) => setBaseDailyRate(event.target.value)}
            placeholder="Example: 300"
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
        <p className="muted">Select up to 5 work days. The remaining 2 days are the employee's rest days.</p>

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
          Rest days: <strong>{formatWorkDays(computeRestDays(workDays), 'None')}</strong>
        </div>
      </div>

      <div className="action-row wrap" style={{ marginTop: '12px' }}>
        <button className="secondary-btn" type="button" onClick={createEmployee} disabled={busy}>
          {busy ? 'Creating...' : 'Create Employee Number + QR'}
        </button>
      </div>

      <div style={sectionCardStyle}>
        <div className="section-title">Active Employees</div>

        {!activeEmployees.length ? (
          <div className="info-box">No active employees yet.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee No.</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Pay Terms</th>
                  <th>Schedule</th>
                  <th>Contract</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeEmployees.map((employee) => {
                  const employeeWorkDays = employee.work_days ?? [];
                  return (
                    <tr key={employee.id}>
                      <td>{employee.employee_number || '-'}</td>
                      <td>
                        <strong>{employee.full_name}</strong>
                      </td>
                      <td>
                        {employee.employee_email || '-'}
                        <br />
                        <span className="muted small">{employee.phone_number || '-'}</span>
                      </td>
                      <td>{employee.role_name || '-'}</td>
                      <td>
                        Week 1: PHP {Number(employee.first_week_daily_rate ?? 250).toFixed(2)}
                        <br />
                        Regular: PHP {Number(employee.base_daily_rate ?? 0).toFixed(2)}
                      </td>
                      <td>
                        Work: {formatWorkDays(employeeWorkDays)}
                        <br />
                        <span className="muted small">
                          Rest: {formatWorkDays(computeRestDays(employeeWorkDays), 'None')}
                        </span>
                      </td>
                      <td>
                        Status: {employee.contract_status || 'not_sent'}
                        <br />
                        <span className="muted small">
                          Signed: {employee.contract_status === 'signed' ? 'Yes' : 'No'}
                        </span>
                        <br />
                        <span className="muted small">
                          Due: {formatContractTimestamp(employee.contract_due_at)}
                        </span>
                        <br />
                        <span className="muted small">
                          Signed At: {formatContractTimestamp(employee.contract_signed_at)}
                        </span>
                      </td>
                      <td>{renderEmployeeActions(employee)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={sectionCardStyle}>
        <div className="section-title">Inactive Employees</div>
        <p className="muted">Deactivated employees cannot time in, use POS, or appear in the active employee list until reactivated.</p>

        {!inactiveEmployees.length ? (
          <div className="info-box">No inactive employees.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee No.</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Last Work Days</th>
                  <th>Contract</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inactiveEmployees.map((employee) => {
                  const employeeWorkDays = employee.work_days ?? [];
                  return (
                    <tr key={`inactive-${employee.id}`}>
                      <td>{employee.employee_number || '-'}</td>
                      <td>
                        <strong>{employee.full_name}</strong>
                      </td>
                      <td>
                        {employee.employee_email || '-'}
                        <br />
                        <span className="muted small">{employee.phone_number || '-'}</span>
                      </td>
                      <td>{employee.role_name || '-'}</td>
                      <td>{formatWorkDays(employeeWorkDays)}</td>
                      <td>
                        Status: {employee.contract_status || 'not_sent'}
                        <br />
                        <span className="muted small">
                          Signed: {employee.contract_status === 'signed' ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td>{renderInactiveEmployeeActions(employee)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingEmployeeId ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="section-title">Edit Employee Terms</div>
            <p className="muted">Update first-week rate, regular rate, and work days without touching SQL.</p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                marginTop: '12px',
              }}
            >
              <label style={fieldLabelStyle}>
                First week daily rate
                <input
                  style={inputStyle}
                  value={editFirstWeekDailyRate}
                  onChange={(event) => setEditFirstWeekDailyRate(event.target.value)}
                  type="number"
                />
              </label>

              <label style={fieldLabelStyle}>
                Regular daily rate
                <input
                  style={inputStyle}
                  value={editBaseDailyRate}
                  onChange={(event) => setEditBaseDailyRate(event.target.value)}
                  type="number"
                />
              </label>
            </div>

            <div className="toggle-row wrap" style={{ marginTop: '12px' }}>
              {dayOptions.map((day) => (
                <button
                  key={`edit-${day.key}`}
                  className={editWorkDays.includes(day.key) ? 'toggle-btn active' : 'toggle-btn'}
                  type="button"
                  onClick={() => toggleEditWorkDay(day.key)}
                >
                  {day.label}
                </button>
              ))}
            </div>

            <div className="info-box">
              Work days: <strong>{formatWorkDays(editWorkDays)}</strong>
              <br />
              Rest days: <strong>{formatWorkDays(computeRestDays(editWorkDays), 'None')}</strong>
            </div>

            <div className="action-row wrap" style={{ marginTop: '12px' }}>
              <button className="secondary-btn" type="button" onClick={saveEmployeeTerms} disabled={busy}>
                {busy ? 'Saving...' : 'Save Employee Terms'}
              </button>
              <button className="ghost-btn" type="button" onClick={() => setEditingEmployeeId('')} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {qrPreview ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="section-title">Generated QR</div>
            <p className="muted">This QR is ready to print for employee login. Use the label print option before handing it to the employee.</p>
            <div style={{ display: 'grid', gap: '12px', justifyItems: 'center' }}>
              <img
                src={qrPreview.qrImageUrl}
                alt="Generated employee QR"
                style={{
                  width: '220px',
                  height: '220px',
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #eadfce',
                }}
              />
              <div style={{ textAlign: 'center' }}>
                <strong>{qrPreview.employee.full_name}</strong>
                <br />
                Employee No: {qrPreview.employee.employee_number || '-'}
              </div>
              <a
                href={qrPreview.qrImageUrl}
                download={`${qrPreview.employee.employee_number ?? 'employee'}_${qrPreview.employee.full_name.replace(/\s+/g, '_')}_qr.png`}
                style={{ color: '#8d5524', fontWeight: 700 }}
              >
                Download QR PNG
              </a>
              <button className="secondary-btn" type="button" onClick={() => printQrLabel(qrPreview.employee, qrPreview.qrImageUrl)}>
                Print QR Label
              </button>
              <button className="ghost-btn" type="button" onClick={() => setQrPreview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
