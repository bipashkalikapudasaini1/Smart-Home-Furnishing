import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFestival } from '../context/FestivalContext';
import api from '../utils/api';
import { ShoppingBag, MapPin, CreditCard, Package, Zap } from 'lucide-react';
import './Checkout.css';

const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
  return `${base}${path}`;
};

const DELIVERY_CHARGE = 180;

const Checkout = () => {
  const { user, loading: authLoading } = useAuth();
  const { getFestivalDiscount }        = useFestival();
  const navigate    = useNavigate();
  const location    = useLocation();

  // Buy Now item passed via navigate state (no cart needed)
  const buyNow = location.state?.buyNow || null;
  // Custom Order from live-chat confirmation
  const customOrderData = location.state?.customOrderData || null;

  const [cart,       setCart]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const [address, setAddress] = useState({
    name: '', phone: '', street: '', city: '', state: '', zipCode: '', country: 'Nepal'
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    if (user.name)  setAddress(prev => ({ ...prev, name:  user.name }));
    if (user.phone) setAddress(prev => ({ ...prev, phone: user.phone }));

    if (customOrderData || buyNow) {
      // Custom Order or Buy Now mode — no cart needed
      setLoading(false);
      return;
    }

    // Normal cart mode
    api.get('/cart').then(res => {
      const items = res.data?.data || [];
      if (items.length === 0) { navigate('/cart'); return; }
      setCart(items);
    }).catch(() => setError('Failed to load cart')).finally(() => setLoading(false));
  }, [user, authLoading, navigate, buyNow, customOrderData]);

  // Subtotal: Custom Order = confirmed price, Buy Now = single item, normal = all cart items
  const subtotal = useMemo(() => {
    if (customOrderData) return Number(customOrderData.confirmedPrice) || 0;
    if (buyNow) return buyNow.price * buyNow.quantity;
    return cart.reduce((sum, item) => {
      const festDiscount = getFestivalDiscount(item?.product?._id);
      const discount     = festDiscount > 0 ? festDiscount : (item?.product?.discount || 0);
      const price        = discount
        ? Math.round(item.product.price - (item.product.price * discount) / 100)
        : item?.product?.price || 0;
      return sum + price * (item.quantity || 0);
    }, 0);
  }, [customOrderData, buyNow, cart, getFestivalDiscount]);

  const total = subtotal + DELIVERY_CHARGE;

  const handleChange = (e) =>
    setAddress(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!address.name || !address.phone || !address.street || !address.city) {
      setError('Please fill in all required fields (Name, Phone, Street, City).');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { shippingAddress: address };
      if (customOrderData) {
        payload.customOrderData = customOrderData; // live-chat confirmed custom order
      } else if (buyNow) {
        payload.buyNowItem = buyNow; // tell backend to skip cart
      }
      const res = await api.post('/orders', payload);
      const { khaltiPaymentUrl } = res.data.data;
      window.location.href = khaltiPaymentUrl;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate payment. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) return <div className="checkout-page container">Loading…</div>;

  return (
    <div className="checkout-page container">
      <button className="back-btn" onClick={() => customOrderData ? navigate('/my-customizations') : navigate('/cart')}>
        ← Back
      </button>
      <h2 className="checkout-title">
        {customOrderData
          ? <><CreditCard size={22} /> Custom Order Checkout</>
          : buyNow
          ? <><Zap size={22} /> Quick Checkout</>
          : <><ShoppingBag size={22} /> Checkout</>
        }
      </h2>
      {customOrderData && (
        <div className="buynow-badge custom-order-badge">
          🎨 Custom Order — confirmed via Live Chat
        </div>
      )}
      {buyNow && !customOrderData && (
        <div className="buynow-badge">⚡ Buy Now — purchasing 1 item directly</div>
      )}
      {error && <div className="checkout-error">{error}</div>}

      <div className="checkout-grid">
        <div className="checkout-left">
          <div className="checkout-card">
            <h3><MapPin size={18} /> Shipping Address</h3>
            <form id="checkout-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name <span className="req">*</span></label>
                  <input name="name" value={address.name} onChange={handleChange} placeholder="Your full name" required />
                </div>
                <div className="form-group">
                  <label>Phone <span className="req">*</span></label>
                  <input name="phone" value={address.phone} onChange={handleChange} placeholder="98XXXXXXXX" required />
                </div>
              </div>
              <div className="form-group">
                <label>Street Address <span className="req">*</span></label>
                <input name="street" value={address.street} onChange={handleChange} placeholder="House no., Street, Locality" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City <span className="req">*</span></label>
                  <input name="city" value={address.city} onChange={handleChange} placeholder="e.g. Kathmandu" required />
                </div>
                <div className="form-group">
                  <label>State / Province</label>
                  <input name="state" value={address.state} onChange={handleChange} placeholder="e.g. Bagmati" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>ZIP Code</label>
                  <input name="zipCode" value={address.zipCode} onChange={handleChange} placeholder="44600" />
                </div>
                <div className="form-group">
                  <label>Country</label>
                  <input name="country" value={address.country} readOnly />
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="checkout-right">
          <div className="checkout-card">
            <h3><Package size={18} /> Order Summary</h3>
            <div className="checkout-items">
              {customOrderData ? (
                // ── Custom Order from Live Chat ──
                <div className="checkout-item">
                  <div className="checkout-item-img">
                    {customOrderData.image
                      ? <img src={getImageUrl(customOrderData.image)} alt={customOrderData.productName} />
                      : <div className="img-placeholder" />}
                  </div>
                  <div className="checkout-item-info">
                    <p className="item-name">{customOrderData.productName}</p>
                    <span className="item-variant custom-order-tag">🎨 Custom Order</span>
                    {customOrderData.customizationNote && (
                      <details className="custom-note-details">
                        <summary className="custom-note-summary">View customization specs</summary>
                        <pre className="custom-note-pre">{customOrderData.customizationNote}</pre>
                      </details>
                    )}
                    <p className="item-qty">Qty: 1</p>
                  </div>
                  <div className="checkout-item-price">Rs. {Number(customOrderData.confirmedPrice).toFixed(2)}</div>
                </div>
              ) : buyNow ? (
                // ── Buy Now: single item ──
                <div className="checkout-item">
                  <div className="checkout-item-img">
                    {buyNow.image
                      ? <img src={getImageUrl(buyNow.image)} alt={buyNow.name} />
                      : <div className="img-placeholder" />}
                  </div>
                  <div className="checkout-item-info">
                    <p className="item-name">{buyNow.name}</p>
                    <p className="item-qty">Qty: {buyNow.quantity}</p>
                  </div>
                  <div className="checkout-item-price">Rs. {(buyNow.price * buyNow.quantity).toFixed(2)}</div>
                </div>
              ) : (
                // ── Cart items ──
                cart.map(item => {
                  const price = item?.product?.discount
                    ? item.product.price - (item.product.price * item.product.discount) / 100
                    : item?.product?.price || 0;
                  return (
                    <div key={item._id} className="checkout-item">
                      <div className="checkout-item-img">
                        {item.product?.images?.[0]
                          ? <img src={getImageUrl(item.product.images[0])} alt={item.product.name} />
                          : <div className="img-placeholder" />}
                      </div>
                      <div className="checkout-item-info">
                        <p className="item-name">{item.product?.name}</p>
                        {item.selectedColor  && <span className="item-variant">Color: {item.selectedColor}</span>}
                        {item.selectedSize   && <span className="item-variant">Size: {item.selectedSize}</span>}
                        {item.selectedFabric && <span className="item-variant">Fabric: {item.selectedFabric}</span>}
                        <p className="item-qty">Qty: {item.quantity}</p>
                      </div>
                      <div className="checkout-item-price">Rs. {(price * item.quantity).toFixed(2)}</div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="checkout-totals">
              <div className="total-row"><span>Subtotal</span><span>Rs. {subtotal.toFixed(2)}</span></div>
              <div className="total-row"><span>Delivery Charge</span><span>Rs. {DELIVERY_CHARGE.toFixed(2)}</span></div>
              <div className="total-row grand-total"><span>Total</span><span>Rs. {total.toFixed(2)}</span></div>
            </div>
            <button type="submit" form="checkout-form" className="btn-khalti" disabled={submitting}>
              <CreditCard size={20} />
              {submitting ? 'Redirecting to Khalti…' : `Pay Rs. ${total.toFixed(2)} with Khalti`}
            </button>
            <p className="khalti-note">You will be redirected to Khalti's secure payment page.</p>
            <div className="khalti-badge">
              <span className="khalti-logo-pill">K</span>
              <span>Secured by Khalti</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
