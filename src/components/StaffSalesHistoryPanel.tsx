import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import SalesCorrectionModal, {
  SaleCorrectionItem,
  SaleCorrectionLog,
  SaleTransactionDetail,
} from './SalesCorrectionModal';

type StaffSalesHistoryPanelProps = {
  qrToken?: string | null;
};

type StaffSale = {
  id: string;
  transaction_number: string;
  payment_method: string;
  total_amount: number;
  cash_received: number | null;
  change_amount: number;
  correction_count?: number;
  last_corrected_at?: string | null;
  last_correction_source?: string | null;
  local_date: string;
  local_time: string;
  created_at: string;
};

function money(value?: number | null) {
  return `PHP ${Number(value ?? 0).toFixed(2)}`;
}

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

export default function StaffSalesHistoryPanel({ qrToken = null }: StaffSalesHistoryPanelProps) {
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<StaffSale[]>([]);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SaleTransactionDetail | null>(null);
  const [detailItems, setDetailItems] = useState<SaleCorrectionItem[]>([]);
  const [detailCorrections, setDetailCorrections] = useState<SaleCorrectionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadSales();
  }, [qrToken]);

  async function loadSales() {
    try {
      setLoading(true);
      setError('');

      const { data, error: rpcError } = await supabase.rpc('staff_sales_history', {
        p_qr_token: qrToken,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to load sales history.');

      setSummary(data.summary ?? null);
      setTransactions((data.transactions ?? []) as StaffSale[]);
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
        p_qr_token: qrToken,
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
    adminPin?: string;
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

      const { data, error: rpcError } = await supabase.rpc('staff_update_sales_transaction', {
        p_transaction_id: detail.id,
        p_qr_token: qrToken,
        p_items: payload.items,
        p_payment_method: payload.paymentMethod,
        p_reason: payload.reason,
        p_admin_pin: payload.adminPin,
        p_cash_received: payload.cashReceived,
        p_payment_proof_path: paymentProofPath,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || 'Unable to update sales transaction.');

      await Promise.all([loadSales(), openEditor(detail.id)]);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to update sales transaction.';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <div className="section-title">Sales History</div>
      <p className="muted">Your current cutoff sales, recent transactions, and correction requests with admin PIN approval.</p>

      {loading ? <div className="info-box">Loading sales...</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      {summary ? (
        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-label">Transactions</div>
            <div className="metric-value">{summary.transactionCount ?? 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Total Sales</div>
            <div className="metric-value">{money(summary.totalSales)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Cash</div>
            <div className="metric-value">{money(summary.cashSales)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Digital</div>
            <div className="metric-value">{money(summary.digitalSales)}</div>
          </div>
        </div>
      ) : null}

      {!transactions.length ? (
        <div className="info-box">No saved transactions yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Date/Time</th>
                <th>Payment</th>
                <th>Total</th>
                <th>Cash Received</th>
                <th>Change</th>
                <th>Corrections</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.transaction_number}</td>
                  <td>{formatDate(transaction.created_at)}</td>
                  <td>{transaction.payment_method.replace('_', ' ')}</td>
                  <td>{money(transaction.total_amount)}</td>
                  <td>{money(transaction.cash_received)}</td>
                  <td>{money(transaction.change_amount)}</td>
                  <td>
                    {transaction.correction_count ?? 0}
                    <br />
                    <span className="muted small">
                      {transaction.last_corrected_at ? formatDate(transaction.last_corrected_at) : 'No edits yet'}
                    </span>
                  </td>
                  <td>
                    <button className="ghost-btn" type="button" onClick={() => void openEditor(transaction.id)}>
                      Edit with Admin PIN
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
          title="Staff Sale Correction"
          detail={detail}
          items={detailItems}
          corrections={detailCorrections}
          loading={detailLoading}
          saving={saving}
          error={error}
          requireAdminPin
          onClose={closeEditor}
          onSave={saveCorrection}
        />
      ) : null}
    </div>
  );
}
