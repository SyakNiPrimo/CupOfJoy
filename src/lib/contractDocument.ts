export type ContractInfo = {
  generatedAt: string;
  employeeNumber: string | null;
  employeeName: string;
  roleName: string | null;
  positionTitle?: string | null;
  businessName?: string | null;
  businessAddress?: string | null;
  employeeAddress?: string | null;
  employmentStatus?: string | null;
  firstWeekDailyRate?: number | null;
  dailyRate: number | null;
  status: string;
  startDate: string;
  primaryWorkLocations?: string | null;
  payrollSchedule?: string | null;
  shiftName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  paidHours: number | null;
  graceMinutes: number | null;
  workDays: string[];
  restDays?: string[];
  overtimeApprovalRule?: string | null;
  cashPosResponsibility?: string | null;
  uniformCompanyPropertyIssued?: string | null;
  emergencyContact?: string | null;
  immediateSupervisor?: string | null;
  loanAccessEnabled?: boolean | null;
  employeeEmail?: string | null;
  phoneNumber?: string | null;
  contractStatus?: string | null;
  contractSentAt?: string | null;
  contractDueAt?: string | null;
  contractSignedAt?: string | null;
  contractDocumentPath?: string | null;
  contractSignedCopyPath?: string | null;
};

const dayLabels: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export function money(value?: number | null) {
  return `PHP ${Number(value ?? 0).toFixed(2)}`;
}

export function formatWorkDays(days?: string[]) {
  if (!days?.length) return '-';
  return days.map((day) => dayLabels[day] ?? day).join(', ');
}

export function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(value?: string | null) {
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

export function formatClockTime(value?: string | null) {
  if (!value) return '-';
  const [hours = '0', minutes = '0'] = value.split(':');
  const sample = new Date();
  sample.setHours(Number(hours), Number(minutes), 0, 0);
  return sample.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildContractFilename(employeeName: string) {
  const normalized = employeeName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toUpperCase();

  return `${normalized || 'EMPLOYEE'}_CUPOFJOYCONTRACT`;
}

function lineHtml(label: string, value: string) {
  return `<div class="line-row"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`;
}

function paragraphHtml(text: string) {
  return `<p>${escapeHtml(text)}</p>`;
}

function listHtml(items: string[]) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export function buildContractHtml(contract: ContractInfo) {
  const documentTitle = buildContractFilename(contract.employeeName);
  const businessName = contract.businessName || 'Cup of Joy';
  const positionTitle = contract.positionTitle || contract.roleName || 'Staff';
  const startDate = formatDate(contract.startDate);
  const schedule = `${formatClockTime(contract.scheduledStart)} to ${formatClockTime(contract.scheduledEnd)}`;
  const workDays = formatWorkDays(contract.workDays);
  const restDays = formatWorkDays(contract.restDays);
  const loanLine = contract.loanAccessEnabled
    ? 'Loan access may be extended to this employee only when explicitly enabled by the owner, subject to a separate written agreement.'
    : 'Loan access is not automatic and remains unavailable unless later enabled by the owner and supported by a separate written agreement.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(documentTitle)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; color: #2b1d12; background: #fffdf8; }
      .page { width: 816px; margin: 0 auto; padding: 40px 48px 56px; box-sizing: border-box; }
      h1, h2, h3 { margin: 0 0 12px; color: #6f3f16; }
      h1 { font-size: 28px; text-align: center; }
      h2 { font-size: 18px; margin-top: 24px; }
      h3 { font-size: 15px; margin-top: 18px; }
      p, li { font-size: 13px; line-height: 1.65; }
      ul { margin: 8px 0 8px 20px; padding: 0; }
      .meta { border: 1px solid #dbcab5; border-radius: 10px; padding: 14px 16px; background: #fff; }
      .line-row { display: flex; gap: 12px; margin-bottom: 8px; font-size: 13px; }
      .label { min-width: 210px; font-weight: 700; }
      .value { flex: 1; border-bottom: 1px solid #cdb8a0; padding-bottom: 2px; }
      .annex-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      .annex-table th, .annex-table td { border: 1px solid #cdb8a0; padding: 8px 10px; font-size: 12px; text-align: left; vertical-align: top; }
      .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 36px; }
      .signature-block { padding-top: 40px; }
      .signature-line { border-top: 1px solid #2b1d12; padding-top: 8px; font-size: 12px; }
      .muted { color: #7b6a57; font-size: 12px; }
      @media print { body { background: white; } .page { width: auto; margin: 0; padding: 22mm 16mm; } }
    </style>
  </head>
  <body>
    <div class="page">
      <h1>STAFF EMPLOYMENT CONTRACT</h1>
      ${paragraphHtml(`This Staff Employment Contract is made between ${businessName} and ${contract.employeeName}. This document serves as the main contract for the employee record currently active in the Cup of Joy internal system.`)}
      <div class="meta">
        ${lineHtml('Business / Employer', businessName)}
        ${lineHtml('Business Address', contract.businessAddress || 'To be completed by management')}
        ${lineHtml('Employee Full Name', contract.employeeName)}
        ${lineHtml('Employee Number', contract.employeeNumber || '-')}
        ${lineHtml('Employee Address', contract.employeeAddress || 'To be completed during onboarding')}
        ${lineHtml('Position / Role', positionTitle)}
        ${lineHtml('Employment Status', contract.employmentStatus || contract.status)}
        ${lineHtml('Contract Start Date', startDate)}
        ${lineHtml('Primary Work Location(s)', contract.primaryWorkLocations || 'Cup of Joy assigned work site')}
        ${lineHtml('Immediate Supervisor', contract.immediateSupervisor || 'Cup of Joy Owner / Management')}
      </div>
      <h2>1. Appointment and Duties</h2>
      ${paragraphHtml(`The Employee is appointed as ${positionTitle}. The Employee agrees to perform assigned duties honestly, diligently, and in a manner consistent with Cup of Joy operating standards, customer service expectations, sanitation rules, and business policies.`)}
      ${listHtml(['Follow lawful instructions from management and immediate supervisors.','Protect company cash, inventory, passwords, recipes, supplier information, and other sensitive business materials.','Handle attendance, shift turnover, and assigned POS activities with accuracy and accountability.'])}
      <h2>2. Place of Work and Schedule</h2>
      ${paragraphHtml(`The Employee may be assigned to work at ${contract.primaryWorkLocations || 'Cup of Joy locations'} or at other Cup of Joy business locations when business needs require it.`)}
      ${listHtml([`Assigned shift: ${contract.shiftName || '-'} (${schedule})`,`Paid shift hours: ${contract.paidHours ?? '-'} hour(s)`,`Regular work days: ${workDays}`,`Rest days: ${restDays}`,'Every employee is entitled to 2 rest days each week.'])}
      <h2>3. Compensation, Payroll, and Lawful Deductions</h2>
      ${paragraphHtml(`The Employee receives PHP 250.00 per day for the first 7 calendar days from the contract start date, and ${money(contract.dailyRate)} per day starting on week 2 unless management later updates the regular daily rate in the employee record.`)}
      ${listHtml([`First-week daily rate: ${money(contract.firstWeekDailyRate)}`,`Regular daily rate after week 1: ${money(contract.dailyRate)}`,`Payroll schedule: ${contract.payrollSchedule || 'Cutoff 26-10 paid on the 15th; cutoff 11-25 paid on the 30th'}`,'Regular day pay is zero if the employee does not complete the full paid shift for that workday.','Overtime pay applies only when the employee reports on time, works more than one hour beyond the paid shift, and the overtime is approved by the owner.','Only lawful deductions, approved shortages, or signed obligations may be deducted from pay.'])}
      <h2>4. Attendance, Timekeeping, and POS Accountability</h2>
      ${paragraphHtml('The Employee must follow the company attendance flow, including QR code verification, location validation, and selfie capture when required by the system.')}
      ${listHtml([`Grace minutes before late marking begins: ${String(contract.graceMinutes ?? 0)} minute(s)`,'Time-out must follow the same authorized attendance process required by management.',`${contract.cashPosResponsibility || 'Cash and POS accountability applies when assigned to cash handling duties.'}`,'False attendance entries, buddy punching, missing cash, and misuse of the POS are serious violations and may lead to disciplinary action.'])}
      <h2>5. Employment Status and Evaluation</h2>
      ${paragraphHtml(`The Employee's current status in the system is ${contract.employmentStatus || contract.status}. Management may evaluate performance, attendance, conduct, and business-fit during the employment relationship and may update work assignments when needed.`)}
      <h2>6. Benefits, Leave, Rest Days, and Loans</h2>
      ${listHtml(['The Employee is entitled to 2 rest days every week based on the assigned work days.','Unpaid leave may be requested only after the employee has completed at least 3 months of service.','Any leave request must be filed at least 14 days before the requested leave date.',loanLine])}
      <h2>7. Confidentiality, Recipe Protection, Non-Solicitation, and Limited Non-Compete</h2>
      ${paragraphHtml('The Employee acknowledges that recipes, costing data, supplier details, customer information, internal processes, pricing strategy, and operating methods are confidential business assets of Cup of Joy and must not be copied, disclosed, or used for unauthorized purposes.')}
      ${listHtml(['No unauthorized sharing of recipes, costing sheets, or supplier contacts.','No solicitation of co-workers or active customers for competing business activities during employment.','Any limited non-compete restriction, if enforced, applies only to the extent allowed by law and must protect legitimate business interests.'])}
      <h2>8. Conduct, Discipline, and Loss Prevention</h2>
      ${listHtml(['The Employee must act respectfully toward customers, co-workers, and management.','The Employee must protect company property, equipment, login credentials, and issued materials.',`Uniform / company property issued: ${contract.uniformCompanyPropertyIssued || 'To be listed by management if issued'}`])}
      <h2>9. Separation from Employment</h2>
      ${paragraphHtml('If the Employee wishes to resign or request contract termination, the request must be filed through the company process with at least 14 days notice to allow handover, scheduling adjustments, cash and inventory reconciliation, and final payroll processing.')}
      <h2>10. Data Privacy and Consent</h2>
      ${paragraphHtml('The Employee consents to the collection and use of personal and attendance data reasonably required for payroll, scheduling, operational security, company recordkeeping, and lawful compliance.')}
      <h2>11. Entire Agreement</h2>
      ${paragraphHtml('This contract, together with the employee record stored in the Cup of Joy system and any lawful written company policies referenced by management, represents the working agreement between the parties unless later amended in writing.')}
      <h2>Annex A - Employee Record Snapshot</h2>
      <table class="annex-table"><thead><tr><th>Field</th><th>Current System Value</th></tr></thead><tbody>
      <tr><td>Employee No.</td><td>${escapeHtml(contract.employeeNumber || '-')}</td></tr>
      <tr><td>Immediate Supervisor</td><td>${escapeHtml(contract.immediateSupervisor || 'Cup of Joy Owner / Management')}</td></tr>
      <tr><td>Rest Day(s)</td><td>${escapeHtml(restDays)}</td></tr>
      <tr><td>Work Days / Shift</td><td>${escapeHtml(`${workDays} / ${contract.shiftName || '-'} / ${schedule}`)}</td></tr>
      <tr><td>Overtime Approval Rule</td><td>${escapeHtml(contract.overtimeApprovalRule || 'Owner approval required')}</td></tr>
      <tr><td>Cash / POS Responsibility</td><td>${escapeHtml(contract.cashPosResponsibility || 'Yes, if assigned to POS or cash handling duties')}</td></tr>
      <tr><td>Uniform / Company Property Issued</td><td>${escapeHtml(contract.uniformCompanyPropertyIssued || 'To be listed by management if issued')}</td></tr>
      <tr><td>Emergency Contact</td><td>${escapeHtml(contract.emergencyContact || 'To be completed during onboarding')}</td></tr>
      </tbody></table>
      <div class="signatures">
        <div class="signature-block"><div class="signature-line">${escapeHtml(contract.employeeName)}</div><div class="muted">Employee Signature / Name</div></div>
        <div class="signature-block"><div class="signature-line">${escapeHtml(contract.immediateSupervisor || 'Cup of Joy Owner / Management')}</div><div class="muted">Employer / Authorized Representative</div></div>
      </div>
    </div>
  </body>
</html>`;
}

export function openContractPrintView(contract: ContractInfo) {
  const printWindow = window.open('', '_blank', 'width=900,height=1100');
  if (!printWindow) {
    throw new Error('Pop-up blocked. Please allow pop-ups to download the contract PDF.');
  }
  const html = buildContractHtml(contract);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
}

type PdfTextLine = {
  kind: 'text';
  text: string;
  size: number;
  bold?: boolean;
  align?: 'left' | 'center';
  indent?: number;
  gapAfter?: number;
};

type PdfSpacer = {
  kind: 'spacer';
  height: number;
};

type PdfElement = PdfTextLine | PdfSpacer;

const PDF_PAGE_WIDTH = 595;
const PDF_PAGE_HEIGHT = 842;
const PDF_MARGIN_X = 48;
const PDF_MARGIN_TOP = 64;
const PDF_MARGIN_BOTTOM = 56;

function sanitizePdfText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?');
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function approximateTextWidth(text: string, size: number) {
  return text.length * size * 0.5;
}

function wrapPdfText(text: string, size: number, maxWidth: number) {
  const normalized = normalizeText(text);
  if (!normalized) return [''];

  const words = normalized.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (approximateTextWidth(candidate, size) <= maxWidth) {
      currentLine = candidate;
    } else if (!currentLine) {
      lines.push(word);
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function addWrappedText(
  elements: PdfElement[],
  text: string,
  options: {
    size?: number;
    bold?: boolean;
    align?: 'left' | 'center';
    indent?: number;
    gapAfter?: number;
    bullet?: boolean;
  } = {},
) {
  const size = options.size ?? 11;
  const indent = options.indent ?? 0;
  const bulletPrefix = options.bullet ? '- ' : '';
  const firstLinePrefix = bulletPrefix;
  const nextLinePrefix = options.bullet ? '  ' : '';
  const availableWidth = PDF_PAGE_WIDTH - PDF_MARGIN_X * 2 - indent;
  const wrapped = wrapPdfText(`${firstLinePrefix}${text}`, size, availableWidth);

  wrapped.forEach((line, index) => {
    const lineText = index === 0 || !options.bullet ? line : `${nextLinePrefix}${line}`;
    elements.push({
      kind: 'text',
      text: lineText,
      size,
      bold: options.bold,
      align: options.align,
      indent,
      gapAfter: index === wrapped.length - 1 ? options.gapAfter : 0,
    });
  });
}

function addSpacer(elements: PdfElement[], height: number) {
  elements.push({ kind: 'spacer', height });
}

function buildPdfElements(contract: ContractInfo) {
  const elements: PdfElement[] = [];
  const businessName = contract.businessName || 'Cup of Joy';
  const positionTitle = contract.positionTitle || contract.roleName || 'Staff';
  const schedule = `${formatClockTime(contract.scheduledStart)} to ${formatClockTime(contract.scheduledEnd)}`;
  const workDays = formatWorkDays(contract.workDays);
  const restDays = formatWorkDays(contract.restDays);
  const payrollSchedule =
    contract.payrollSchedule || 'Cutoff 26-10 paid on the 15th; cutoff 11-25 paid on the 30th';
  const loanLine = contract.loanAccessEnabled
    ? 'Loan access may be extended to this employee only when explicitly enabled by the owner, subject to a separate written agreement.'
    : 'Loan access is not automatic and remains unavailable unless later enabled by the owner and supported by a separate written agreement.';

  addWrappedText(elements, 'STAFF EMPLOYMENT CONTRACT', {
    size: 18,
    bold: true,
    align: 'center',
    gapAfter: 10,
  });
  addWrappedText(
    elements,
    `This Staff Employment Contract is made between ${businessName} and ${contract.employeeName}. This document serves as the main contract for the employee record currently active in the Cup of Joy internal system.`,
    { gapAfter: 12 },
  );

  const metaRows = [
    ['Business / Employer', businessName],
    ['Business Address', contract.businessAddress || 'To be completed by management'],
    ['Employee Full Name', contract.employeeName],
    ['Employee Number', contract.employeeNumber || '-'],
    ['Employee Address', contract.employeeAddress || 'To be completed during onboarding'],
    ['Position / Role', positionTitle],
    ['Employment Status', contract.employmentStatus || contract.status],
    ['Contract Start Date', formatDate(contract.startDate)],
    ['Primary Work Location(s)', contract.primaryWorkLocations || 'Cup of Joy assigned work site'],
    ['Immediate Supervisor', contract.immediateSupervisor || 'Cup of Joy Owner / Management'],
  ];

  metaRows.forEach(([label, value]) => {
    addWrappedText(elements, `${label}: ${value}`, { size: 10.5, gapAfter: 2 });
  });
  addSpacer(elements, 10);

  addWrappedText(elements, '1. Appointment and Duties', { size: 13, bold: true, gapAfter: 4 });
  addWrappedText(
    elements,
    `The Employee is appointed as ${positionTitle}. The Employee agrees to perform assigned duties honestly, diligently, and in a manner consistent with Cup of Joy operating standards, customer service expectations, sanitation rules, and business policies.`,
    { gapAfter: 4 },
  );
  [
    'Follow lawful instructions from management and immediate supervisors.',
    'Protect company cash, inventory, passwords, recipes, supplier information, and other sensitive business materials.',
    'Handle attendance, shift turnover, and assigned POS activities with accuracy and accountability.',
  ].forEach((item) => addWrappedText(elements, item, { bullet: true, gapAfter: 2 }));
  addSpacer(elements, 4);

  addWrappedText(elements, '2. Place of Work and Schedule', { size: 13, bold: true, gapAfter: 4 });
  addWrappedText(
    elements,
    `The Employee may be assigned to work at ${contract.primaryWorkLocations || 'Cup of Joy locations'} or at other Cup of Joy business locations when business needs require it.`,
    { gapAfter: 4 },
  );
  [
    `Assigned shift: ${contract.shiftName || '-'} (${schedule})`,
    `Paid shift hours: ${contract.paidHours ?? '-'} hour(s)`,
    `Regular work days: ${workDays}`,
    `Rest days: ${restDays}`,
    'Every employee is entitled to 2 rest days each week.',
  ].forEach((item) => addWrappedText(elements, item, { bullet: true, gapAfter: 2 }));
  addSpacer(elements, 4);

  addWrappedText(elements, '3. Compensation, Payroll, and Lawful Deductions', {
    size: 13,
    bold: true,
    gapAfter: 4,
  });
  addWrappedText(
    elements,
    `The Employee receives PHP 250.00 per day for the first 7 calendar days from the contract start date, and ${money(contract.dailyRate)} per day starting on week 2 unless management later updates the regular daily rate in the employee record.`,
    { gapAfter: 4 },
  );
  [
    `First-week daily rate: ${money(contract.firstWeekDailyRate)}`,
    `Regular daily rate after week 1: ${money(contract.dailyRate)}`,
    `Payroll schedule: ${payrollSchedule}`,
    'Regular day pay is zero if the employee does not complete the full paid shift for that workday.',
    'Overtime pay applies only when the employee reports on time, works more than one hour beyond the paid shift, and the overtime is approved by the owner.',
    'Only lawful deductions, approved shortages, or signed obligations may be deducted from pay.',
  ].forEach((item) => addWrappedText(elements, item, { bullet: true, gapAfter: 2 }));
  addSpacer(elements, 4);

  addWrappedText(elements, '4. Attendance, Timekeeping, and POS Accountability', {
    size: 13,
    bold: true,
    gapAfter: 4,
  });
  addWrappedText(
    elements,
    'The Employee must follow the company attendance flow, including QR code verification, location validation, and selfie capture when required by the system.',
    { gapAfter: 4 },
  );
  [
    `Grace minutes before late marking begins: ${String(contract.graceMinutes ?? 0)} minute(s)`,
    'Time-out must follow the same authorized attendance process required by management.',
    contract.cashPosResponsibility || 'Cash and POS accountability applies when assigned to cash handling duties.',
    'False attendance entries, buddy punching, missing cash, and misuse of the POS are serious violations and may lead to disciplinary action.',
  ].forEach((item) => addWrappedText(elements, item, { bullet: true, gapAfter: 2 }));
  addSpacer(elements, 4);

  addWrappedText(elements, '5. Employment Status and Evaluation', { size: 13, bold: true, gapAfter: 4 });
  addWrappedText(
    elements,
    `The Employee's current status in the system is ${contract.employmentStatus || contract.status}. Management may evaluate performance, attendance, conduct, and business-fit during the employment relationship and may update work assignments when needed.`,
    { gapAfter: 8 },
  );

  addWrappedText(elements, '6. Benefits, Leave, Rest Days, and Loans', { size: 13, bold: true, gapAfter: 4 });
  [
    'The Employee is entitled to 2 rest days every week based on the assigned work days.',
    'Unpaid leave may be requested only after the employee has completed at least 3 months of service.',
    'Any leave request must be filed at least 14 days before the requested leave date.',
    loanLine,
  ].forEach((item) => addWrappedText(elements, item, { bullet: true, gapAfter: 2 }));
  addSpacer(elements, 4);

  addWrappedText(elements, '7. Confidentiality, Recipe Protection, Non-Solicitation, and Limited Non-Compete', {
    size: 13,
    bold: true,
    gapAfter: 4,
  });
  addWrappedText(
    elements,
    'The Employee acknowledges that recipes, costing data, supplier details, customer information, internal processes, pricing strategy, and operating methods are confidential business assets of Cup of Joy and must not be copied, disclosed, or used for unauthorized purposes.',
    { gapAfter: 4 },
  );
  [
    'No unauthorized sharing of recipes, costing sheets, or supplier contacts.',
    'No solicitation of co-workers or active customers for competing business activities during employment.',
    'Any limited non-compete restriction, if enforced, applies only to the extent allowed by law and must protect legitimate business interests.',
  ].forEach((item) => addWrappedText(elements, item, { bullet: true, gapAfter: 2 }));
  addSpacer(elements, 4);

  addWrappedText(elements, '8. Conduct, Discipline, and Loss Prevention', { size: 13, bold: true, gapAfter: 4 });
  [
    'The Employee must act respectfully toward customers, co-workers, and management.',
    'The Employee must protect company property, equipment, login credentials, and issued materials.',
    `Uniform / company property issued: ${contract.uniformCompanyPropertyIssued || 'To be listed by management if issued'}`,
  ].forEach((item) => addWrappedText(elements, item, { bullet: true, gapAfter: 2 }));
  addSpacer(elements, 4);

  addWrappedText(elements, '9. Separation from Employment', { size: 13, bold: true, gapAfter: 4 });
  addWrappedText(
    elements,
    'If the Employee wishes to resign or request contract termination, the request must be filed through the company process with at least 14 days notice to allow handover, scheduling adjustments, cash and inventory reconciliation, and final payroll processing.',
    { gapAfter: 8 },
  );

  addWrappedText(elements, '10. Data Privacy and Consent', { size: 13, bold: true, gapAfter: 4 });
  addWrappedText(
    elements,
    'The Employee consents to the collection and use of personal and attendance data reasonably required for payroll, scheduling, operational security, company recordkeeping, and lawful compliance.',
    { gapAfter: 8 },
  );

  addWrappedText(elements, '11. Entire Agreement', { size: 13, bold: true, gapAfter: 4 });
  addWrappedText(
    elements,
    'This contract, together with the employee record stored in the Cup of Joy system and any lawful written company policies referenced by management, represents the working agreement between the parties unless later amended in writing.',
    { gapAfter: 8 },
  );

  addWrappedText(elements, 'Annex A - Employee Record Snapshot', { size: 13, bold: true, gapAfter: 4 });
  [
    `Employee No.: ${contract.employeeNumber || '-'}`,
    `Immediate Supervisor: ${contract.immediateSupervisor || 'Cup of Joy Owner / Management'}`,
    `Rest Day(s): ${restDays}`,
    `Work Days / Shift: ${workDays} / ${contract.shiftName || '-'} / ${schedule}`,
    `Overtime Approval Rule: ${contract.overtimeApprovalRule || 'Owner approval required'}`,
    `Cash / POS Responsibility: ${contract.cashPosResponsibility || 'Yes, if assigned to POS or cash handling duties'}`,
    `Uniform / Company Property Issued: ${contract.uniformCompanyPropertyIssued || 'To be listed by management if issued'}`,
    `Emergency Contact: ${contract.emergencyContact || 'To be completed during onboarding'}`,
  ].forEach((item) => addWrappedText(elements, item, { bullet: true, gapAfter: 2 }));
  addSpacer(elements, 18);

  addWrappedText(elements, `Employee Signature: ______________________________________________`, {
    size: 11,
    gapAfter: 2,
  });
  addWrappedText(elements, contract.employeeName, { size: 10, gapAfter: 12 });
  addWrappedText(elements, `Employer / Authorized Representative: _____________________________`, {
    size: 11,
    gapAfter: 2,
  });
  addWrappedText(elements, contract.immediateSupervisor || 'Cup of Joy Owner / Management', {
    size: 10,
    gapAfter: 0,
  });

  return elements;
}

function renderPdfPages(elements: PdfElement[]) {
  const pages: string[] = [];
  let currentPage: string[] = [];
  let cursorY = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP;

  const pushPage = () => {
    pages.push(currentPage.join('\n'));
    currentPage = [];
    cursorY = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP;
  };

  for (const element of elements) {
    if (element.kind === 'spacer') {
      if (cursorY - element.height < PDF_MARGIN_BOTTOM) {
        pushPage();
      } else {
        cursorY -= element.height;
      }
      continue;
    }

    const lineHeight = element.size + 4;
    if (cursorY - lineHeight < PDF_MARGIN_BOTTOM) {
      pushPage();
    }

    const indent = element.indent ?? 0;
    const textWidth = approximateTextWidth(element.text, element.size);
    const x =
      element.align === 'center'
        ? Math.max(PDF_MARGIN_X, (PDF_PAGE_WIDTH - textWidth) / 2)
        : PDF_MARGIN_X + indent;

    currentPage.push(
      `BT /${element.bold ? 'F2' : 'F1'} ${element.size} Tf 1 0 0 1 ${x.toFixed(2)} ${cursorY.toFixed(2)} Tm (${sanitizePdfText(
        element.text,
      )}) Tj ET`,
    );
    cursorY -= lineHeight + (element.gapAfter ?? 0);
  }

  if (currentPage.length || !pages.length) {
    pages.push(currentPage.join('\n'));
  }

  return pages;
}

function buildPdfDocument(streams: string[]) {
  const objectCount = 4 + streams.length * 2;
  const objects = new Array<string>(objectCount + 1);

  objects[1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

  const contentStartRef = 3;
  const pageStartRef = 4;
  const pagesRootRef = 3 + streams.length * 2;
  const catalogRef = pagesRootRef + 1;

  const pageRefs: string[] = [];

  streams.forEach((stream, index) => {
    const contentRef = contentStartRef + index * 2;
    const pageRef = pageStartRef + index * 2;
    const byteLength = new TextEncoder().encode(stream).length;

    objects[contentRef] = `<< /Length ${byteLength} >>\nstream\n${stream}\nendstream`;
    objects[pageRef] =
      `<< /Type /Page /Parent ${pagesRootRef} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 1 0 R /F2 2 0 R >> >> /Contents ${contentRef} 0 R >>`;
    pageRefs.push(`${pageRef} 0 R`);
  });

  objects[pagesRootRef] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${streams.length} >>`;
  objects[catalogRef] = `<< /Type /Catalog /Pages ${pagesRootRef} 0 R >>`;

  let pdf = '%PDF-1.4\n%\xC7\xEC\x8F\xA2\n';
  const offsets: number[] = new Array(objectCount + 1).fill(0);

  for (let index = 1; index <= objectCount; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objectCount + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= objectCount; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objectCount + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

export function buildContractPdfBlob(contract: ContractInfo) {
  const pages = renderPdfPages(buildPdfElements(contract));
  const pdf = buildPdfDocument(pages);
  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadContractPdf(contract: ContractInfo) {
  const blob = buildContractPdfBlob(contract);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${buildContractFilename(contract.employeeName)}.pdf`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
