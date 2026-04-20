import { ChangeEvent, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
};

type PaymentMethod = 'cash' | 'gcash' | 'paymaya' | 'bank_transfer';

type LastStaffIdentity = {
  employeeId?: string;
  employeeNumber?: string;
  employeeName?: string;
  qrToken?: string;
};

const menuItems: MenuItem[] = [
  { id: 'coffee-americano', name: 'Americano', price: 90, category: 'Coffee' },
  { id: 'coffee-latte', name: 'Latte', price: 95, category: 'Coffee' },
  { id: 'coffee-capuccino', name: 'Capuccino', price: 95, category: 'Coffee' },
  { id: 'coffee-caramel-macchiato', name: 'Caramel Macchiato', price: 100, category: 'Coffee' },
  { id: 'coffee-spanish-latte', name: 'Spanish Latte', price: 100, category: 'Coffee' },
  { id: 'coffee-hazelnut-latte', name: 'Hazelnut Latte', price: 100, category: 'Coffee' },
  { id: 'coffee-sea-salt-latte', name: 'Sea Salt Latte', price: 110, category: 'Coffee' },
  { id: 'coffee-dirty-matcha-latte', name: 'Dirty Matcha Latte', price: 130, category: 'Coffee' },
  { id: 'coffee-biscoff-latte', name: 'Biscoff Latte', price: 145, category: 'Coffee' },
  { id: 'coffee-dirty-matcha-biscoff', name: 'Dirty Matcha Biscoff', price: 155, category: 'Coffee' },

  { id: 'milk-strawberry', name: 'Milky Strawberry', price: 100, category: 'Milk Based' },
  { id: 'milk-blueberry', name: 'Milky Blueberry', price: 100, category: 'Milk Based' },
  { id: 'milk-mango', name: 'Milky Mango', price: 100, category: 'Milk Based' },
  { id: 'milk-green-apple', name: 'Milky Green Apple', price: 100, category: 'Milk Based' },
  { id: 'milk-matcha-latte', name: 'Matcha Latte', price: 110, category: 'Milk Based' },
  { id: 'milk-mango-matcha', name: 'Mango Matcha', price: 130, category: 'Milk Based' },
  { id: 'milk-strawberry-matcha', name: 'Strawberry Matcha', price: 130, category: 'Milk Based' },
  { id: 'milk-blueberry-matcha', name: 'Blueberry Matcha', price: 130, category: 'Milk Based' },
  { id: 'milk-biscoff-matcha', name: 'Biscoff Matcha', price: 145, category: 'Milk Based' },

  { id: 'fruit-peach-mango', name: 'Peach Mango', price: 50, category: 'Fruit Soda Regular' },
  { id: 'fruit-peach', name: 'Peach', price: 50, category: 'Fruit Soda Regular' },
  { id: 'fruit-mango', name: 'Mango', price: 50, category: 'Fruit Soda Regular' },
  { id: 'fruit-lychee', name: 'Lychee', price: 50, category: 'Fruit Soda Regular' },
  { id: 'fruit-grapes', name: 'Grapes', price: 50, category: 'Fruit Soda Regular' },
  { id: 'fruit-green-apple', name: 'Green Apple', price: 50, category: 'Fruit Soda Regular' },
  { id: 'fruit-strawberry', name: 'Strawberry', price: 50, category: 'Fruit Soda Regular' },
  { id: 'fruit-blueberry', name: 'Blueberry', price: 50, category: 'Fruit Soda Regular' },
  { id: 'fruit-lemon', name: 'Lemon', price: 50, category: 'Fruit Soda Regular' },

  { id: 'fruit-yogurt-peach-mango', name: 'Peach Mango', price: 60, category: 'Fruit Soda Yogurt' },
  { id: 'fruit-yogurt-peach', name: 'Peach', price: 60, category: 'Fruit Soda Yogurt' },
  { id: 'fruit-yogurt-mango', name: 'Mango', price: 60, category: 'Fruit Soda Yogurt' },
  { id: 'fruit-yogurt-lychee', name: 'Lychee', price: 60, category: 'Fruit Soda Yogurt' },
  { id: 'fruit-yogurt-grapes', name: 'Grapes', price: 60, category: 'Fruit Soda Yogurt' },
  { id: 'fruit-yogurt-green-apple', name: 'Green Apple', price: 60, category: 'Fruit Soda Yogurt' },
  { id: 'fruit-yogurt-strawberry', name: 'Strawberry', price: 60, category: 'Fruit Soda Yogurt' },
  { id: 'fruit-yogurt-blueberry', name: 'Blueberry', price: 60, category: 'Fruit Soda Yogurt' },
  { id: 'fruit-yogurt-lemon', name: 'Lemon', price: 60, category: 'Fruit Soda Yogurt' },

  { id: 'custom-mix', name: 'Build Your Own 2-Flavor Mix', price: 60, category: 'Custom Mix' },

  { id: 'meal-tapsilog', name: 'Tapsilog', price: 80, category: 'Silog Meals' },
  { id: 'meal-bangsilog', name: 'Bangsilog', price: 80, category: 'Silog Meals' },
  { id: 'meal-longsilog', name: 'Longsilog', price: 80, category: 'Silog Meals' },
  { id: 'meal-chicksilog', name: 'Chicksilog', price: 80, category: 'Silog Meals' },
  { id: 'meal-cornsilog', name: 'Cornsilog', price: 80, category: 'Silog Meals' },
  { id: 'meal-hotsilog', name: 'Hotsilog', price: 80, category: 'Silog Meals' },
  { id: 'meal-hamsilog', name: 'Hamsilog', price: 80, category: 'Silog Meals' },
  { id: 'meal-siosilog', name: 'Siosilog', price: 80, category: 'Silog Meals' },
  { id: 'meal-spamsilog', name: 'Spamsilog', price: 80, category: 'Silog Meals' },
  { id: 'meal-chow-fan', name: 'Chow Fan', price: 70, category: 'Silog Meals' },

  { id: 'snack-siomai', name: 'Siomai', price: 20, category: 'Snacks' },
  { id: 'snack-fishball', name: 'Fishball', price: 20, category: 'Snacks' },
  { id: 'snack-kikiam', name: 'Kikiam', price: 20, category: 'Snacks' },
  { id: 'snack-fries', name: 'Fries', price: 30, category: 'Snacks' },
  { id: 'snack-nachos', name: 'Nachos', price: 50, category: 'Snacks' },
  { id: 'snack-pancit-canton', name: 'Pancit Canton', price: 30, category: 'Snacks' },
  { id: 'snack-beef-noodles', name: 'Beef Noodles', price: 30, category: 'Snacks' },
  { id: 'snack-chicken-noodles', name: 'Chicken Noodles', price: 30, category: 'Snacks' },
  { id: 'snack-seafood-noodles', name: 'Seafood Noodles', price: 35, category: 'Snacks' },
  { id: 'snack-jjampong', name: 'Jjampong', price: 35, category: 'Snacks' },
  { id: 'snack-jin-ramen', name: 'Jin Ramen', price: 70, category: 'Snacks' },
  { id: 'snack-arroz-caldo', name: 'Arroz Caldo', price: 65, category: 'Snacks' },

  { id: 'addon-espresso', name: 'Espresso', price: 15, category: 'Add-ons' },
  { id: 'addon-oat-milk', name: 'Oat Milk', price: 30, category: 'Add-ons' },
  { id: 'addon-yakult', name: 'Yakult', price: 10, category: 'Add-ons' },
  { id: 'addon-nata', name: 'Nata', price: 10, category: 'Add-ons' },
  { id: 'addon-boba', name: 'Boba', price: 15, category: 'Add-ons' },
  { id: 'addon-glitter-potion', name: 'Glitter Potion', price: 20, category: 'Add-ons' },
  { id: 'addon-egg', name: 'Egg', price: 15, category: 'Add-ons' },
];

const customMixFlavors = [
  'Peach',
  'Mango',
  'Lychee',
  'Grapes',
  'Green Apple',
  'Strawberry',
  'Blueberry',
  'Lemon',
];

const categories = [
  'Coffee',
  'Milk Based',
  'Fruit Soda Regular',
  'Fruit Soda Yogurt',
  'Custom Mix',
  'Silog Meals',
  'Snacks',
  'Add-ons',
];

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1000,
};

const modalCardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '560px',
  background: '#fffaf2',
  borderRadius: '20px',
  padding: '20px',
  border: '1px solid #e3d6c3',
  boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
};

const fieldStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid #d7c9b6',
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box',
};

function readLastStaff(): LastStaffIdentity | null {
  try {
    const raw = localStorage.getItem('coj_last_staff');
    if (!raw) return null;
    return JSON.parse(raw) as LastStaffIdentity;
  } catch {
    return null;
  }
}

export default function POSPanel() {
  const [selectedCategory, setSelectedCategory] = useState('Coffee');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const [showCustomMixModal, setShowCustomMixModal] = useState(false);
  const [mixFlavor1, setMixFlavor1] = useState('');
  const [mixFlavor2, setMixFlavor2] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [paymentProofName, setPaymentProofName] = useState('');
  const [paymentProofDataUrl, setPaymentProofDataUrl] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [lastSaleMessage, setLastSaleMessage] = useState('');

  const lastStaff = useMemo(() => readLastStaff(), []);

  const filteredItems = useMemo(
    () => menuItems.filter((item) => item.category === selectedCategory),
    [selectedCategory],
  );

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const cashReceivedNumber = Number(cashReceived || 0);
  const change = useMemo(() => {
    if (paymentMethod !== 'cash') return 0;
    return Math.max(0, cashReceivedNumber - total);
  }, [cashReceivedNumber, paymentMethod, total]);

  function resetCheckoutState() {
    setPaymentMethod('cash');
    setCashReceived('');
    setPaymentProofName('');
    setPaymentProofDataUrl('');
    setCheckoutError('');
  }

  function addToCart(item: MenuItem) {
    if (item.id === 'custom-mix') {
      setMixFlavor1('');
      setMixFlavor2('');
      setShowCustomMixModal(true);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === item.id);

      if (existing) {
        return prev.map((cartItem) =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        );
      }

      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          category: item.category,
        },
      ];
    });
  }

  function addCustomMixToCart() {
    if (!mixFlavor1 || !mixFlavor2) {
      alert('Please choose 2 flavors.');
      return;
    }

    if (mixFlavor1 === mixFlavor2) {
      alert('Please choose 2 different flavors.');
      return;
    }

    const name = `Custom Mix: ${mixFlavor1} + ${mixFlavor2}`;
    const id = `custom-mix-${mixFlavor1}-${mixFlavor2}`;

    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === id);

      if (existing) {
        return prev.map((cartItem) =>
          cartItem.id === id
            ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem,
        );
      }

      return [
        ...prev,
        {
          id,
          name,
          price: 60,
          quantity: 1,
          category: 'Custom Mix',
        },
      ];
    });

    setShowCustomMixModal(false);
  }

  function increaseQty(id: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    );
  }

  function decreaseQty(id: string) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function clearOrder() {
    setCart([]);
    setShowCheckoutModal(false);
    resetCheckoutState();
  }

  function openCheckout() {
    if (!cart.length) {
      alert('No items in the order yet.');
      return;
    }

    if (!lastStaff?.qrToken) {
      alert('No active staff session found. Please time in first.');
      return;
    }

    resetCheckoutState();
    setShowCheckoutModal(true);
  }

  async function handleProofUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPaymentProofName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setPaymentProofDataUrl(String(reader.result ?? ''));
    };
    reader.readAsDataURL(file);
  }

  async function completeSale() {
    try {
      setCheckoutError('');
      setCheckoutBusy(true);

      if (!lastStaff?.qrToken) {
        throw new Error('No active staff session found. Please time in first.');
      }

      if (paymentMethod === 'cash') {
        if (!cashReceived) {
          throw new Error('Enter the cash received first.');
        }

        if (cashReceivedNumber < total) {
          throw new Error('Cash received is lower than the order total.');
        }
      } else {
        if (!paymentProofDataUrl) {
          throw new Error('Please upload the successful transaction screenshot.');
        }
      }

      const paymentProofPath =
        paymentMethod === 'cash' ? null : await uploadPaymentProof(paymentProofDataUrl, paymentProofName);

      const { data: result, error: rpcError } = await supabase.rpc('pos_checkout', {
        p_qr_token: lastStaff.qrToken,
        p_items: cart,
        p_payment_method: paymentMethod,
        p_cash_received: paymentMethod === 'cash' ? cashReceivedNumber : null,
        p_payment_proof_path: paymentProofPath,
        p_source_label: 'web-pos',
      });

      if (rpcError) throw rpcError;

      if (!result.success) {
        throw new Error(result.message || 'Unable to save sale.');
      }

      setLastSaleMessage(
        paymentMethod === 'cash'
          ? `Saved ${result.transactionNumber} | Change ₱${Number(result.changeAmount ?? 0).toFixed(2)}`
          : `Saved ${result.transactionNumber} | ${paymentMethod.replace('_', ' ')} payment recorded`,
      );

      setCart([]);
      setShowCheckoutModal(false);
      resetCheckoutState();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save sale.';
      setCheckoutError(message);
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function uploadPaymentProof(dataUrl: string, fileName: string) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const extension = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `payment-proofs/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(path, blob, {
        contentType: extension === 'png' ? 'image/png' : 'image/jpeg',
        upsert: false,
      });

    if (uploadError) throw uploadError;
    return path;
  }

  return (
    <>
      <div className="grid-two">
        <div className="panel">
          <div className="section-title">Point of Sale</div>
          <p className="muted">Real Cup of Joy menu is now mapped in the POS starter.</p>

          {lastStaff?.employeeName ? (
            <div className="info-box">
              Cashier: <strong>{lastStaff.employeeName}</strong>
              <br />
              Employee No: {lastStaff.employeeNumber || '—'}
            </div>
          ) : null}

          {lastSaleMessage ? <div className="success-box">{lastSaleMessage}</div> : null}

          <div className="toggle-row" style={{ flexWrap: 'wrap' }}>
            {categories.map((category) => (
              <button
                key={category}
                className={selectedCategory === category ? 'toggle-btn active' : 'toggle-btn'}
                onClick={() => setSelectedCategory(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginTop: '16px',
            }}
          >
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addToCart(item)}
                style={{
                  textAlign: 'left',
                  background: '#f7f1e7',
                  border: '1px solid #d9c8b1',
                  borderRadius: '16px',
                  padding: '16px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '16px' }}>{item.name}</div>
                <div style={{ marginTop: '8px', color: '#8d5524', fontWeight: 700 }}>
                  ₱{item.price.toFixed(2)}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-title">Current Order</div>

          {!cart.length ? (
            <p className="muted">No items yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {cart.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: '#f7f1e7',
                    border: '1px solid #e3d6c3',
                    borderRadius: '16px',
                    padding: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                    <div style={{ color: '#8d5524' }}>₱{item.price.toFixed(2)} each</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button className="ghost-btn" type="button" onClick={() => decreaseQty(item.id)}>
                      -
                    </button>
                    <div style={{ minWidth: '20px', textAlign: 'center' }}>{item.quantity}</div>
                    <button className="ghost-btn" type="button" onClick={() => increaseQty(item.id)}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: '16px',
              background: '#f7f1e7',
              borderRadius: '16px',
              padding: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            <span>Total</span>
            <span>₱{total.toFixed(2)}</span>
          </div>

          <div className="action-row" style={{ marginTop: '14px' }}>
            <button className="ghost-btn" type="button" onClick={clearOrder}>
              Clear Order
            </button>
            <button className="secondary-btn" type="button" onClick={openCheckout}>
              Checkout
            </button>
          </div>
        </div>
      </div>

      {showCustomMixModal ? (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <div className="section-title">Build Your Own 2-Flavor Mix</div>
            <p className="muted">Choose any 2 flavors. Total price stays at ₱60.</p>

            <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
              <select value={mixFlavor1} onChange={(event) => setMixFlavor1(event.target.value)} style={fieldStyle}>
                <option value="">Select first flavor</option>
                {customMixFlavors.map((flavor) => (
                  <option key={`flavor-1-${flavor}`} value={flavor}>
                    {flavor}
                  </option>
                ))}
              </select>

              <select value={mixFlavor2} onChange={(event) => setMixFlavor2(event.target.value)} style={fieldStyle}>
                <option value="">Select second flavor</option>
                {customMixFlavors.map((flavor) => (
                  <option key={`flavor-2-${flavor}`} value={flavor}>
                    {flavor}
                  </option>
                ))}
              </select>
            </div>

            <div className="action-row" style={{ marginTop: '16px' }}>
              <button className="ghost-btn" type="button" onClick={() => setShowCustomMixModal(false)}>
                Cancel
              </button>
              <button className="secondary-btn" type="button" onClick={addCustomMixToCart}>
                Add Mix
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCheckoutModal ? (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <div className="section-title">Checkout</div>
            <p className="muted">Review the order and complete payment.</p>

            <div style={{ display: 'grid', gap: '10px', marginTop: '16px' }}>
              {cart.map((item) => (
                <div
                  key={`checkout-${item.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    borderBottom: '1px solid #eadfce',
                    paddingBottom: '8px',
                  }}
                >
                  <div>
                    {item.name} x {item.quantity}
                  </div>
                  <div>₱{(item.price * item.quantity).toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: '16px',
                background: '#f7f1e7',
                borderRadius: '14px',
                padding: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: '18px',
              }}
            >
              <span>Total</span>
              <span>₱{total.toFixed(2)}</span>
            </div>

            <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
              <select
                value={paymentMethod}
                onChange={(event) => {
                  setPaymentMethod(event.target.value as PaymentMethod);
                  setCheckoutError('');
                  setCashReceived('');
                  setPaymentProofName('');
                  setPaymentProofDataUrl('');
                }}
                style={fieldStyle}
              >
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="paymaya">PayMaya</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>

              {paymentMethod === 'cash' ? (
                <>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder="Cash received"
                    style={fieldStyle}
                  />

                  <div
                    style={{
                      background: '#f7f1e7',
                      borderRadius: '14px',
                      padding: '14px',
                      display: 'grid',
                      gap: '6px',
                    }}
                  >
                    <div>
                      Cash Received: <strong>₱{cashReceivedNumber.toFixed(2)}</strong>
                    </div>
                    <div>
                      Change: <strong>₱{change.toFixed(2)}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="info-box">
                    Upload or take a picture of the successful {paymentMethod.replace('_', ' ')} transaction screen.
                  </div>

                  <input type="file" accept="image/*" onChange={handleProofUpload} style={fieldStyle} />

                  {paymentProofName ? (
                    <div className="success-box">Payment proof selected: {paymentProofName}</div>
                  ) : null}

                  {paymentProofDataUrl ? (
                    <img
                      src={paymentProofDataUrl}
                      alt="Payment proof preview"
                      style={{
                        width: '100%',
                        maxHeight: '220px',
                        objectFit: 'contain',
                        background: '#fff',
                        borderRadius: '12px',
                        border: '1px solid #eadfce',
                      }}
                    />
                  ) : null}
                </>
              )}

              {checkoutError ? <div className="error-box">{checkoutError}</div> : null}
            </div>

            <div className="action-row" style={{ marginTop: '16px' }}>
              <button className="ghost-btn" type="button" onClick={() => setShowCheckoutModal(false)}>
                Back
              </button>
              <button className="secondary-btn" type="button" onClick={completeSale} disabled={checkoutBusy}>
                {checkoutBusy ? 'Saving Sale...' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
