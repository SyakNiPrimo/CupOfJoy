import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import SalesCorrectionModal, {
  SaleCorrectionItem,
  SaleCorrectionLog,
  SaleTransactionDetail,
} from './SalesCorrectionModal';

type SalesSessionRow = {
  employee_id: string | null;
  employee_number: string | null;
  employee_name: string | null;
  session_time_in_at: string | null;
  first_sale_at: string | null;
  last_sale_at: string | null;
  transaction_count: number;
  total_sales: number;
  cash_sales: number;
  digital_sales: number;
};

type SalesTransactionRow = {
  id: string;
  transaction_number: string;
  employee_number_snapshot: string | null;
  employee_name_snapshot: string | null;
  session_time_in_at: string | null;
  payment_method: string;
  total_amount: number;
  cash_received: number | null;
  change_amount: number;
  payment_proof_path: string | null;
  local_date: string;
  local_time: string;
  correction_count: number;
  last_corrected_at: string | null;
  last_correction_source: string | null;
  created_at: string;
};

const wrapStyle: React.CSSProperties = {
  background: '#f7f3ec',
  border: '1px solid #eadfce',
  borderRadius: '16px',
  padding: '14px',
  marginTop: '14px',
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: 'auto',
  marginTop: '12px',
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
  verticalAlign: 'top',
  whiteSpace: 'nowrap',
};

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

async function uploadPaymentProof(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `payment-proofs/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('payment-proofs')
    .upload(path, file, {
      contentType: file.type || (extension === 'png' ? 'image/png' : 'image/jpeg'),
      upsert: false,
    });

  if (uploadError) throw uploadError;
  return path;
}

export default function SalesAdminPanel() {
  const [sessionRows, setSessionRows] = useState<SalesSessionRow[]>([]);
  const [transactionRows, setTransactionRows] = useState<SalesTransactionRow[]>([]);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SaleTransactionDetail | null>(null);
  const [detailItems, setDetailItems] = useState<SaleCorrectionItem[]>([]);
  const [detailCorrections, setDetailCorrections] = useState<SaleCorrectionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadSalesHistory();
  }, []);

  async function loadSalesHistory() {
    try {
      setLoading(true);
      setError('');

      const { data: sessions, error: sessionsError } = await supabase
        .from('sales_session_summary')
        .select('*')
        .order('last_sale_at', { ascending: false })
        .limit(20);

      if (sessionsError) throw sessionsError;

      const { data: transactions, error: transactionsError } = await supabase
        .from('sales_transactions')
        .select(
          'id, transaction_number, employee_number_snapshot, employee_name_snapshot, session_time_in_at, payment_method, total_amount, cash_received, change_amount, payment_proof_path, local_date, local_time, correction_count, last_corrected_at, last_correction_source, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(30);

      if (transactionsError) throw transactionsError;

      setSessionRows((sessions ?? []) as SalesSessionRow[]);
      setTransactionRows((transactions ?? []) as SalesTransactionRow[]);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Unable to load sales history.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function openEditor(transactionId: string) {
    try {
      setSelectedTransactionId(transactionId);
      setDetailLoading(true);
      setError('');

      const { data, error: rpcError } = await supabase.rpc('sales_transaction_detail', {
        p_transaction_id: transactionId,
        p_qr_token: null,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to load transaction detail.');

      setDetail(data.transaction as SaleTransactionDetail);
      setDetailItems((data.items ?? []) as SaleCorrectionItem[]);
      setDetailCorrections((data.corrections ?? []) as SaleCorrectionLog[]);
    } catch (detailError) {
      const message = detailError instanceof Error ? detailError.message : 'Unable to load transaction detail.';
      setError(message);
      setSelectedTransactionId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeEditor() {
    setSelectedTransactionId(null);
    setDetail(null);
    setDetailItems([]);
    setDetailCorrections([]);
  }

  async function saveCorrection(payload: {
    items: SaleCorrectionItem[];
    paymentMethod: string;
    cashReceived: number | null;
    reason: string;
    paymentProofFile?: File | null;
  }) {
    if (!detail) return;

    try {
      setSaving(true);
      setError('');

      const paymentProofPath =
        payload.paymentMethod === 'cash'
          ? null
          : payload.paymentProofFile
            ? await uploadPaymentProof(payload.paymentProofFile)
            : detail.payment_proof_path;

      const { data, error: rpcError } = await supabase.rpc('owner_update_sales_transaction', {
        p_transaction_id: detail.id,
        p_items: payload.items,
        p_payment_method: payload.paymentMethod,
        p_reason: payload.reason,
        p_cash_received: payload.cashReceived,
        p_payment_proof_path: paymentProofPath,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to update sales transaction.');

      await Promise.all([loadSalesHistory(), openEditor(detail.id)]);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to update sales transaction.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={wrapStyle}>
      <div className="section-title">Sales History</div>
      <p className="muted">Recent sales sessions, transactions, and correction controls.</p>

      {loading ? <div className="info-box">Loading sales history...</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      <div className="section-title" style={{ marginTop: '18px' }}>
        Sales by Staff Session
      </div>

      {!sessionRows.length ? (
        <div className="info-box">No saved sales sessions yet.</div>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Cashier</th>
                <th style={thStyle}>Employee No</th>
                <th style={thStyle}>Session Time In</th>
                <th style={thStyle}>Transactions</th>
                <th style={thStyle}>Total Sales</th>
                <th style={thStyle}>Cash</th>
                <th style={thStyle}>Digital</th>
                <th style={thStyle}>Last Sale</th>
              </tr>
            </thead>
            <tbody>
              {sessionRows.map((row, index) => (
                <tr key={`${row.employee_id ?? 'none'}-${row.session_time_in_at ?? index}`}>
                  <td style={tdStyle}>{row.employee_name || '-'}</td>
                  <td style={tdStyle}>{row.employee_number || '-'}</td>
                  <td style={tdStyle}>{formatDateTime(row.session_time_in_at)}</td>
                  <td style={tdStyle}>{row.transaction_count}</td>
                  <td style={tdStyle}>{money(row.total_sales)}</td>
                  <td style={tdStyle}>{money(row.cash_sales)}</td>
                  <td style={tdStyle}>{money(row.digital_sales)}</td>
                  <td style={tdStyle}>{formatDateTime(row.last_sale_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section-title" style={{ marginTop: '18px' }}>
        Recent Transactions
      </div>

      {!transactionRows.length ? (
        <div className="info-box">No saved transactions yet.</div>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Transaction No</th>
                <th style={thStyle}>Date/Time</th>
                <th style={thStyle}>Cashier</th>
                <th style={thStyle}>Payment</th>
                <th style={thStyle}>Total</th>
                <th style={thStyle}>Cash Received</th>
                <th style={thStyle}>Change</th>
                <th style={thStyle}>Corrections</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactionRows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.transaction_number}</td>
                  <td style={tdStyle}>{formatDateTime(row.created_at)}</td>
                  <td style={tdStyle}>
                    {row.employee_name_snapshot || '-'}
                    <br />
                    <span style={{ opacity: 0.7 }}>{row.employee_number_snapshot || '-'}</span>
                  </td>
                  <td style={tdStyle}>{row.payment_method.replace('_', ' ')}</td>
                  <td style={tdStyle}>{money(row.total_amount)}</td>
                  <td style={tdStyle}>{money(row.cash_received)}</td>
                  <td style={tdStyle}>{money(row.change_amount)}</td>
                  <td style={tdStyle}>
                    {row.correction_count || 0}
                    <br />
                    <span style={{ opacity: 0.7 }}>
                      {row.last_corrected_at ? formatDateTime(row.last_corrected_at) : 'No edits yet'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button className="secondary-btn" type="button" onClick={() => void openEditor(row.id)}>
                      Edit Sale
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedTransactionId ? (
        <SalesCorrectionModal
          title="Admin Sale Correction"
          detail={detail}
          items={detailItems}
          corrections={detailCorrections}
          loading={detailLoading}
          saving={saving}
          error={error}
          requireAdminPin={false}
          onClose={closeEditor}
          onSave={saveCorrection}
        />
      ) : null}
    </div>
  );
}
