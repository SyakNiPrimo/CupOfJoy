import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  downloadContractPdf,
  ContractInfo,
  formatClockTime,
  formatDate,
  formatDateTime,
  formatWorkDays,
  money,
} from '../lib/contractDocument';

type StaffContractPanelProps = {
  qrToken?: string | null;
};

type TerminationRequest = {
  id: string;
  requested_at: string;
  notice_days: number;
  requested_last_working_date: string;
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  reviewed_at: string | null;
  review_notes: string | null;
};

async function uploadSignedContract(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
  const path = `signed-contracts/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('signed-contracts')
    .upload(path, file, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    });

  if (uploadError) throw uploadError;
  return path;
}

export default function StaffContractPanel({ qrToken = null }: StaffContractPanelProps) {
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [terminationRequests, setTerminationRequests] = useState<TerminationRequest[]>([]);
  const [requestedLastWorkingDate, setRequestedLastWorkingDate] = useState('');
  const [terminationReason, setTerminationReason] = useState('');
  const [signedContractFile, setSignedContractFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadContract();
  }, [qrToken]);

  async function loadContract() {
    try {
      setLoading(true);
      setError('');
      setMessage('');

      const [{ data, error: rpcError }, { data: terminationData, error: terminationError }] = await Promise.all([
        supabase.rpc('staff_contract_info', {
          p_qr_token: qrToken,
        }),
        supabase.rpc('staff_termination_dashboard', {
          p_qr_token: qrToken,
        }),
      ]);

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to load contract information.');
      if (terminationError) throw terminationError;
      if (!terminationData?.success) throw new Error(terminationData?.message || 'Unable to load termination requests.');

      setContract(data.contract as ContractInfo);
      setTerminationRequests((terminationData.requests ?? []) as TerminationRequest[]);
    } catch (loadError) {
      const nextMessage = loadError instanceof Error ? loadError.message : 'Unable to load contract information.';
      setError(nextMessage);
    } finally {
      setLoading(false);
    }
  }

  async function submitTerminationRequest() {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const { data, error: rpcError } = await supabase.rpc('submit_termination_request', {
        p_qr_token: qrToken,
        p_requested_last_working_date: requestedLastWorkingDate || null,
        p_reason: terminationReason,
        p_notice_days: 14,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to submit termination request.');

      setRequestedLastWorkingDate('');
      setTerminationReason('');
      setMessage('Termination request submitted with 14-day notice.');
      await loadContract();
    } catch (submitError) {
      const nextMessage = submitError instanceof Error ? submitError.message : 'Unable to submit termination request.';
      setError(nextMessage);
    } finally {
      setSaving(false);
    }
  }

  async function submitSignedContract() {
    if (!signedContractFile) {
      setError('Please choose the signed contract file first.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const signedCopyPath = await uploadSignedContract(signedContractFile);
      const { data, error: rpcError } = await supabase.rpc('staff_submit_signed_contract', {
        p_qr_token: qrToken,
        p_signed_copy_path: signedCopyPath,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to submit signed contract.');

      setSignedContractFile(null);
      setMessage('Signed contract submitted successfully.');
      await loadContract();
    } catch (submitError) {
      const nextMessage = submitError instanceof Error ? submitError.message : 'Unable to submit signed contract.';
      setError(nextMessage);
    } finally {
      setSaving(false);
    }
  }

  const annexRows = useMemo(() => {
    if (!contract) return [];
    return [
      ['Employee No.', contract.employeeNumber || '-'],
      ['Immediate Supervisor', contract.immediateSupervisor || 'Cup of Joy Owner / Management'],
      ['Rest Day(s)', formatWorkDays(contract.restDays)],
      [
        'Work Days / Shift',
        `${formatWorkDays(contract.workDays)} / ${contract.shiftName || '-'} / ${formatClockTime(contract.scheduledStart)} to ${formatClockTime(contract.scheduledEnd)}`,
      ],
      ['Overtime Approval Rule', contract.overtimeApprovalRule || 'Owner approval required'],
      ['Cash / POS Responsibility', contract.cashPosResponsibility || 'Yes, if assigned to POS or cash handling duties'],
      ['Uniform / Company Property Issued', contract.uniformCompanyPropertyIssued || 'To be listed by management if issued'],
      ['Emergency Contact', contract.emergencyContact || 'To be completed during onboarding'],
    ];
  }, [contract]);

  function handleDownloadContractPdf() {
    if (!contract) return;

    try {
      downloadContractPdf(contract);
    } catch (downloadError) {
      const nextMessage = downloadError instanceof Error ? downloadError.message : 'Unable to download the contract PDF.';
      setError(nextMessage);
    }
  }

  return (
    <div className="panel">
      <div className="section-title">Contract Information</div>
      <p className="muted">This contract now follows the main Cup of Joy draft and maps the current employee record into the contract clauses and annex.</p>

      {loading ? <div className="info-box">Loading contract...</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {message ? <div className="success-box">{message}</div> : null}

      {!contract ? (
        <div className="info-box">No contract information loaded yet.</div>
      ) : (
        <>
          <div className="contract-sheet">
            <div className="section-title">Staff Employment Contract</div>
            <p className="muted">Main contract template based on your approved draft.</p>

            <div className="contract-grid">
              <div>
                <strong>Business / Employer</strong>
                <br />
                {contract.businessName || 'Cup of Joy'}
              </div>
              <div>
                <strong>Employee</strong>
                <br />
                {contract.employeeName}
              </div>
              <div>
                <strong>Employee Number</strong>
                <br />
                {contract.employeeNumber || '-'}
              </div>
              <div>
                <strong>Position / Role</strong>
                <br />
                {contract.positionTitle || contract.roleName || 'Staff'}
              </div>
              <div>
                <strong>Employment Status</strong>
                <br />
                {contract.employmentStatus || contract.status}
              </div>
              <div>
                <strong>Contract Start Date</strong>
                <br />
                {formatDate(contract.startDate)}
              </div>
              <div>
                <strong>First Week Daily Rate</strong>
                <br />
                {money(contract.firstWeekDailyRate)}
              </div>
              <div>
                <strong>Regular Daily Rate</strong>
                <br />
                {money(contract.dailyRate)}
              </div>
              <div>
                <strong>Shift</strong>
                <br />
                {contract.shiftName || '-'}
              </div>
              <div>
                <strong>Shift Schedule</strong>
                <br />
                {formatClockTime(contract.scheduledStart)} to {formatClockTime(contract.scheduledEnd)}
              </div>
              <div>
                <strong>Work Days</strong>
                <br />
                {formatWorkDays(contract.workDays)}
              </div>
              <div>
                <strong>Rest Days</strong>
                <br />
                {formatWorkDays(contract.restDays)}
              </div>
            </div>

            <div className="info-box">
              <strong>Mapped clauses in this contract:</strong>
              <br />
              Appointment and duties, place of work and schedule, first-week and regular pay rules, payroll cutoff rules,
              full-day pay rule, owner-approved overtime, attendance and POS accountability, leave eligibility, loan access,
              confidentiality clauses, separation notice, and Annex A employee snapshot.
            </div>

            <div className="contract-sheet" style={{ marginTop: '16px', background: '#fffdf8' }}>
              <div className="section-title">Contract Snapshot</div>
              <p>
                This employee is engaged by <strong>{contract.businessName || 'Cup of Joy'}</strong> as{' '}
                <strong>{contract.positionTitle || contract.roleName || 'Staff'}</strong>, starting on{' '}
                <strong>{formatDate(contract.startDate)}</strong>, assigned at{' '}
                <strong>{contract.primaryWorkLocations || 'Cup of Joy assigned work site'}</strong>.
              </p>
              <p>
                The employee receives <strong>{money(contract.firstWeekDailyRate)}</strong> per day for the first 7 calendar
                days from contract start, then <strong>{money(contract.dailyRate)}</strong> per day from week 2 onward unless
                management updates the employee terms.
              </p>
              <p>
                Schedule is <strong>{contract.shiftName || '-'}</strong> from{' '}
                <strong>{formatClockTime(contract.scheduledStart)}</strong> to{' '}
                <strong>{formatClockTime(contract.scheduledEnd)}</strong>, with work days on{' '}
                <strong>{formatWorkDays(contract.workDays)}</strong> and rest days on{' '}
                <strong>{formatWorkDays(contract.restDays)}</strong>.
              </p>
              <p>
                Grace period before late deduction starts: <strong>{contract.graceMinutes ?? 0} minute(s)</strong>. Payroll
                follows <strong>{contract.payrollSchedule || 'the standard Cup of Joy cutoff schedule'}</strong>.
              </p>
            </div>

            <div className="contract-sheet" style={{ marginTop: '16px' }}>
              <div className="section-title">Contract Signature Status</div>
              <div className="info-box">
                Status: <strong>{contract.contractStatus || 'not_sent'}</strong>
                <br />
                Sent At: <strong>{formatDateTime(contract.contractSentAt)}</strong>
                <br />
                Due At: <strong>{formatDateTime(contract.contractDueAt)}</strong>
                <br />
                Signed At: <strong>{formatDateTime(contract.contractSignedAt)}</strong>
                <br />
                Email: <strong>{contract.employeeEmail || '-'}</strong>
              </div>

              {contract.contractStatus === 'pending_signature' ? (
                <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
                  <div className="info-box">
                    Sign the downloaded contract and upload the signed copy within 3 hours after receiving it.
                  </div>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(event) => setSignedContractFile(event.target.files?.[0] ?? null)}
                  />
                  {signedContractFile ? (
                    <div className="success-box">Selected signed contract: {signedContractFile.name}</div>
                  ) : null}
                  <button className="secondary-btn" type="button" onClick={() => void submitSignedContract()} disabled={saving}>
                    {saving ? 'Submitting...' : 'Upload Signed Contract'}
                  </button>
                </div>
              ) : null}

              {contract.contractStatus === 'expired' ? (
                <div className="error-box">The 3-hour signature window has expired. Ask the owner to resend the contract.</div>
              ) : null}
            </div>

            <div className="table-wrap" style={{ marginTop: '16px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Annex A Field</th>
                    <th>Mapped Value</th>
                  </tr>
                </thead>
                <tbody>
                  {annexRows.map(([label, value]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="secondary-btn" type="button" onClick={handleDownloadContractPdf}>
              Download Contract PDF
            </button>
            <p className="muted small" style={{ marginTop: '8px' }}>
              This downloads the current contract as a PDF with signature lines so it is ready to sign and return.
            </p>
          </div>

          <div className="contract-sheet">
            <div className="section-title">Request Contract Termination</div>
            <p className="muted">Minimum notice is 14 days so Cup of Joy has time to complete handover and final clearances.</p>

            <div className="inline-stack" style={{ marginTop: '12px' }}>
              <input
                type="date"
                value={requestedLastWorkingDate}
                onChange={(event) => setRequestedLastWorkingDate(event.target.value)}
              />
              <textarea
                value={terminationReason}
                onChange={(event) => setTerminationReason(event.target.value)}
                placeholder="Reason for termination request"
                rows={4}
                style={{ border: '1px solid #d7c9b6', borderRadius: '8px', padding: '10px', font: 'inherit' }}
              />
              <button className="secondary-btn" type="button" onClick={() => void submitTerminationRequest()} disabled={saving}>
                {saving ? 'Submitting...' : 'Submit Termination Request'}
              </button>
            </div>

            {!terminationRequests.length ? (
              <div className="info-box">No termination requests yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Requested</th>
                      <th>Last Working Day</th>
                      <th>Status</th>
                      <th>Reason</th>
                      <th>Review Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {terminationRequests.map((request) => (
                      <tr key={request.id}>
                        <td>{formatDateTime(request.requested_at)}</td>
                        <td>{formatDate(request.requested_last_working_date)}</td>
                        <td>{request.status}</td>
                        <td>{request.reason}</td>
                        <td>{request.review_notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
