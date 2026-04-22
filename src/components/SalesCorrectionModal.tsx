import { useEffect, useMemo, useState } from 'react';

export type SaleCorrectionLog = {
  id: string;
  correctionSource: 'admin' | 'staff';
  adminPinVerified: boolean;
  reason: string;
  createdAt: string;
  requestedByName?: string | null;
  authorizedByName?: string | null;
};

export type SaleTransactionDetail = {
  id: string;
  transaction_number: string;
  payment_method: string;
  total_amount: number;
  cash_received: number | null;
  change_amount: number;
  payment_proof_path: string | null;
  correction_count?: number;
  last_corrected_at?: string | null;
  last_correction_source?: string | null;
  created_at: string;
};

export type SaleCorrectionItem = {
  itemId: string;
  itemName: string;
  category: string;
  unitPrice: number;
  quantity: number;
  lineTotal?: number;
};

type SavePayload = {
  items: SaleCorrectionItem[];
  paymentMethod: string;
  cashReceived: number | null;
  reason: string;
  adminPin?: string;
  paymentProofFile?: File | null;
};

type SalesCorrectionModalProps = {
  title: string;
  detail: SaleTransactionDetail | null;
  items: SaleCorrectionItem[];
  corrections: SaleCorrectionLog[];
  loading: boolean;
  saving: boolean;
  error: string;
  requireAdminPin: boolean;
  onClose: () => void;
  onSave: (payload: SavePayload) => Promise<void>;
};

type EditableRow = {
  id: string;
  itemId: string;
  itemName: string;
  category: string;
  unitPrice: string;
  quantity: string;
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1100,
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '920px',
  maxHeight: '92vh',
  overflowY: 'auto',
  background: '#fffaf2',
  borderRadius: '18px',
  padding: '20px',
  border: '1px solid #e3d6c3',
  boxShadow: '0 18px 36px rgba(0,0,0,0.16)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #d7c9b6',
  boxSizing: 'border-box',
};

function toEditableRows(items: SaleCorrectionItem[]): EditableRow[] {
  return items.map((item, index) => ({
    id: `${item.itemId}-${index}`,
    itemId: item.itemId,
    itemName: item.itemName,
    category: item.category || '',
    unitPrice: String(item.unitPrice ?? ''),
    quantity: String(item.quantity ?? ''),
  }));
}

function money(value?: number | null) {
  return `PHP ${Number(value ?? 0).toFixed(2)}`;
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

export default function SalesCorrectionModal({
  title,
  detail,
  items,
  corrections,
  loading,
  saving,
  error,
  requireAdminPin,
  onClose,
  onSave,
}: SalesCorrectionModalProps) {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [reason, setReason] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);

  useEffect(() => {
    if (!detail) return;
    setRows(toEditableRows(items));
    setPaymentMethod(detail.payment_method || 'cash');
    setCashReceived(detail.cash_received != null ? String(detail.cash_received) : '');
    setReason('');
    setAdminPin('');
    setPaymentProofFile(null);
  }, [detail, items]);

  const normalizedItems = useMemo(
    () =>
      rows.map((row) => ({
        itemId: row.itemId.trim(),
        itemName: row.itemName.trim(),
        category: row.category.trim(),
        unitPrice: Number(row.unitPrice || 0),
        quantity: Number(row.quantity || 0),
      })),
    [rows],
  );

  const totalAmount = useMemo(
    () => normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [normalizedItems],
  );

  const cashReceivedNumber = Number(cashReceived || 0);
  const changeAmount = useMemo(() => {
    if (paymentMethod !== 'cash') return 0;
    return Math.max(0, cashReceivedNumber - totalAmount);
  }, [cashReceivedNumber, paymentMethod, totalAmount]);

  function updateRow(id: string, field: keyof EditableRow, value: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        itemId: '',
        itemName: '',
        category: '',
        unitPrice: '',
        quantity: '1',
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  async function submit() {
    await onSave({
      items: normalizedItems,
      paymentMethod,
      cashReceived: paymentMethod === 'cash' ? cashReceivedNumber : null,
      reason,
      adminPin: requireAdminPin ? adminPin : undefined,
      paymentProofFile,
    });
  }

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div className="section-title">{title}</div>
        {detail ? (
          <p className="muted">
            Editing {detail.transaction_number} from {formatDateTime(detail.created_at)}. Corrections already logged:{' '}
            <strong>{detail.correction_count ?? 0}</strong>
          </p>
        ) : null}

        {loading ? <div className="info-box">Loading transaction details...</div> : null}
        {error ? <div className="error-box">{error}</div> : null}

        {!loading && detail ? (
          <>
            <div className="metric-grid">
              <div className="metric-card">
                <div className="metric-label">Current Total</div>
                <div className="metric-value">{money(detail.total_amount)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Edited Total</div>
                <div className="metric-value">{money(totalAmount)}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Payment Method</div>
                <div className="metric-value">{paymentMethod.replace('_', ' ')}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Change</div>
                <div className="metric-value">{money(changeAmount)}</div>
              </div>
            </div>

            <div className="contract-sheet">
              <div className="section-title">Corrected Line Items</div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {rows.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1.4fr 1fr 0.8fr 0.8fr auto',
                      gap: '8px',
                      alignItems: 'end',
                    }}
                  >
                    <input
                      value={row.itemId}
                      onChange={(event) => updateRow(row.id, 'itemId', event.target.value)}
                      placeholder="Item ID"
                      style={inputStyle}
                    />
                    <input
                      value={row.itemName}
                      onChange={(event) => updateRow(row.id, 'itemName', event.target.value)}
                      placeholder="Item name"
                      style={inputStyle}
                    />
                    <input
                      value={row.category}
                      onChange={(event) => updateRow(row.id, 'category', event.target.value)}
                      placeholder="Category"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unitPrice}
                      onChange={(event) => updateRow(row.id, 'unitPrice', event.target.value)}
                      placeholder="Price"
                      style={inputStyle}
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(event) => updateRow(row.id, 'quantity', event.target.value)}
                      placeholder="Qty"
                      style={inputStyle}
                    />
                    <button className="ghost-btn" type="button" onClick={() => removeRow(row.id)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="action-row wrap" style={{ marginTop: '12px' }}>
                <button className="ghost-btn" type="button" onClick={addRow}>
                  Add Item
                </button>
              </div>
            </div>

            <div className="contract-sheet">
              <div className="section-title">Payment Correction</div>
              <div style={{ display: 'grid', gap: '10px' }}>
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} style={inputStyle}>
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="paymaya">PayMaya</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>

                {paymentMethod === 'cash' ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder="Corrected cash received"
                    style={inputStyle}
                  />
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setPaymentProofFile(event.target.files?.[0] ?? null)}
                      style={inputStyle}
                    />
                    <div className="info-box">
                      {paymentProofFile
                        ? `New payment proof selected: ${paymentProofFile.name}`
                        : detail.payment_proof_path
                          ? 'Existing payment proof will be kept unless you upload a replacement.'
                          : 'Upload a payment proof for this corrected digital transaction.'}
                    </div>
                  </>
                )}

                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Reason for correction"
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />

                {requireAdminPin ? (
                  <input
                    type="password"
                    value={adminPin}
                    onChange={(event) => setAdminPin(event.target.value)}
                    placeholder="Admin PIN"
                    style={inputStyle}
                  />
                ) : null}
              </div>
            </div>

            <div className="contract-sheet">
              <div className="section-title">Correction Log</div>
              {!corrections.length ? (
                <div className="info-box">No corrections logged yet.</div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Source</th>
                        <th>Requested By</th>
                        <th>Authorized By</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corrections.map((correction) => (
                        <tr key={correction.id}>
                          <td>{formatDateTime(correction.createdAt)}</td>
                          <td>
                            {correction.correctionSource}
                            {correction.adminPinVerified ? ' (PIN)' : ''}
                          </td>
                          <td>{correction.requestedByName || '-'}</td>
                          <td>{correction.authorizedByName || '-'}</td>
                          <td>{correction.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}

        <div className="action-row wrap" style={{ marginTop: '16px' }}>
          <button className="ghost-btn" type="button" onClick={onClose}>
            Close
          </button>
          <button className="secondary-btn" type="button" onClick={() => void submit()} disabled={saving || loading || !detail}>
            {saving ? 'Saving...' : 'Save Correction'}
          </button>
        </div>
      </div>
    </div>
  );
}
