import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
  return `₱${Number(value ?? 0).toFixed(2)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SalesAdminPanel() {
  const [sessionRows, setSessionRows] = useState<SalesSessionRow[]>([]);
  const [transactionRows, setTransactionRows] = useState<SalesTransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
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
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (transactionsError) throw transactionsError;

      setSessionRows((sessions ?? []) as SalesSessionRow[]);
      setTransactionRows((transactions ?? []) as SalesTransactionRow[]);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Unable to load sales history.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={wrapStyle}>
      <div className="section-title">Sales History</div>
      <p className="muted">Recent sales sessions and transactions saved by the POS.</p>

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
                  <td style={tdStyle}>{row.employee_name || '—'}</td>
                  <td style={tdStyle}>{row.employee_number || '—'}</td>
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
                <th style={thStyle}>Proof</th>
              </tr>
            </thead>
            <tbody>
              {transactionRows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.transaction_number}</td>
                  <td style={tdStyle}>{formatDateTime(row.created_at)}</td>
                  <td style={tdStyle}>
                    {row.employee_name_snapshot || '—'}
                    <br />
                    <span style={{ opacity: 0.7 }}>{row.employee_number_snapshot || '—'}</span>
                  </td>
                  <td style={tdStyle}>{row.payment_method}</td>
                  <td style={tdStyle}>{money(row.total_amount)}</td>
                  <td style={tdStyle}>{money(row.cash_received)}</td>
                  <td style={tdStyle}>{money(row.change_amount)}</td>
                  <td style={tdStyle}>{row.payment_proof_path ? 'Saved' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}