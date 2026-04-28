import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Package, ChevronDown, ChevronUp, ShoppingBag, XCircle, Star } from 'lucide-react';
import './OrderHistory.css';

const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
  return `${base}${path}`;
};

const DELIVERY_STAGES = [
  { key: 'placed',     label: 'Order Placed' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped',    label: 'Shipped' },
  { key: 'delivered',  label: 'Delivered' }
];

const PAYMENT_BADGE = {
  completed: { label: 'Paid',       cls: 'badge-green' },
  pending:   { label: 'Pending',    cls: 'badge-yellow' },
  failed:    { label: 'Failed',     cls: 'badge-red' },
  refunded:  { label: 'Refunded',   cls: 'badge-gray' },
  cancelled: { label: 'Cancelled',  cls: 'badge-red' }
};

const DELIVERY_BADGE = {
  placed:     { label: 'Order Placed', cls: 'badge-blue' },
  processing: { label: 'Processing',   cls: 'badge-yellow' },
  shipped:    { label: 'Shipped',      cls: 'badge-purple' },
  delivered:  { label: 'Delivered',    cls: 'badge-green' },
  cancelled:  { label: 'Cancelled',    cls: 'badge-red' }
};

// An order can be cancelled if it hasn't shipped/delivered/already cancelled
const canCancel = (order) => {
  if (order.deliveryStatus === 'shipped')   return false;
  if (order.deliveryStatus === 'delivered') return false;
  if (order.deliveryStatus === 'cancelled') return false;
  return true;
};

const OrderHistory = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders,        setOrders]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [expanded,      setExpanded]      = useState(null);
  const [rewardPoints,  setRewardPoints]  = useState(0);

  // Cancel modal state
  const [cancelModal,   setCancelModal]   = useState(null); // orderId
  const [cancelReason,  setCancelReason]  = useState('');
  const [cancelling,    setCancelling]    = useState(false);
  const [cancelError,   setCancelError]   = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    fetchOrders();
    // Fetch live reward points balance
    api.get('/auth/me').then(res => {
      setRewardPoints(res.data?.data?.rewardPoints || 0);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, navigate]);

  const fetchOrders = () => {
    api.get('/orders/my')
      .then(res => setOrders(res.data?.data || []))
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false));
  };

  const toggleExpand = (id) => setExpanded(prev => prev === id ? null : id);
  const getStageIndex = (status) => DELIVERY_STAGES.findIndex(s => s.key === status);

  const openCancelModal = (orderId) => {
    setCancelModal(orderId);
    setCancelReason('');
    setCancelError('');
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    setCancelling(true);
    setCancelError('');
    try {
      await api.put(`/orders/${cancelModal}/cancel`, { reason: cancelReason || 'Cancelled by user' });
      setCancelModal(null);
      // Refresh list and reward points (backend restores points on cancel)
      const [ordersRes, meRes] = await Promise.all([
        api.get('/orders/my'),
        api.get('/auth/me')
      ]);
      setOrders(ordersRes.data?.data || []);
      setRewardPoints(meRes.data?.data?.rewardPoints || 0);
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Failed to cancel order. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="orders-page container">Loading orders…</div>;
  if (error)   return <div className="orders-page container orders-error">{error}</div>;

  // Compute totals from orders
  const totalEarned   = orders.reduce((s, o) => s + (o.rewardPointsEarned   || 0), 0);
  const totalRedeemed = orders.reduce((s, o) => s + (o.rewardPointsRedeemed || 0), 0);

  return (
    <div className="orders-page container">
      <h2 className="orders-title"><Package size={22} /> My Orders</h2>

      {/* ── Reward Points Summary Card ── */}
      <div className="rp-summary-card">
        <div className="rp-summary-header">
          <Star size={20} className="rp-summary-star" />
          <span className="rp-summary-title">My Reward Points</span>
        </div>
        <div className="rp-summary-stats">
          <div className="rp-stat">
            <span className="rp-stat-value rp-balance">{rewardPoints}</span>
            <span className="rp-stat-label">Current Balance</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat">
            <span className="rp-stat-value rp-earned">+{totalEarned}</span>
            <span className="rp-stat-label">Total Earned</span>
          </div>
          <div className="rp-stat-divider" />
          <div className="rp-stat">
            <span className="rp-stat-value rp-redeemed">−{totalRedeemed}</span>
            <span className="rp-stat-label">Total Redeemed</span>
          </div>
        </div>
        <p className="rp-summary-hint">
          🎁 Earn <strong>1 point per Rs. 5</strong> spent · Redeem <strong>1 point = Rs. 1</strong> off · Min 50 points to redeem
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="orders-empty">
          <ShoppingBag size={40} />
          <p>You haven't placed any orders yet.</p>
          <Link to="/" className="btn btn-primary">Start Shopping</Link>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => {
            const isOpen   = expanded === order._id;
            const pb       = PAYMENT_BADGE[order.paymentStatus]  || { label: order.paymentStatus,  cls: 'badge-gray' };
            const db       = DELIVERY_BADGE[order.deliveryStatus] || { label: order.deliveryStatus, cls: 'badge-gray' };
            const stageIdx = getStageIndex(order.deliveryStatus);
            const isCancelled = order.deliveryStatus === 'cancelled';

            return (
              <div key={order._id} className={`order-card${isCancelled ? ' order-cancelled' : ''}`}>
                {/* ── Card Header ── */}
                <div className="order-header" onClick={() => toggleExpand(order._id)}>
                  <div className="order-meta">
                    <div className="order-id">
                      <span className="meta-label">Order ID</span>
                      <span className="meta-val">{order._id.slice(-10).toUpperCase()}</span>
                    </div>
                    <div className="order-date">
                      <span className="meta-label">Placed On</span>
                      <span className="meta-val">{new Date(order.createdAt).toLocaleDateString('en-NP', { year:'numeric', month:'short', day:'numeric' })}</span>
                    </div>
                    <div className="order-amount">
                      <span className="meta-label">Total</span>
                      <span className="meta-val amount-val">Rs. {order.totalAmount?.toFixed(2)}</span>
                    </div>
                    <div className="order-badges">
                      <span className={`badge ${pb.cls}`}>{pb.label}</span>
                      <span className={`badge ${db.cls}`}>{db.label}</span>
                    </div>
                  </div>
                  <div className="order-header-actions">
                    {canCancel(order) && (
                      <button
                        className="btn-cancel-order"
                        onClick={e => { e.stopPropagation(); openCancelModal(order._id); }}
                        title="Cancel this order"
                      >
                        <XCircle size={15} /> Cancel
                      </button>
                    )}
                    <button className="expand-btn">
                      {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {/* ── Expanded Details ── */}
                {isOpen && (
                  <div className="order-details">

                    {/* Cancelled banner */}
                    {isCancelled && (
                      <div className="cancelled-banner">
                        <XCircle size={16} />
                        <span>
                          This order was cancelled
                          {order.cancelledAt ? ` on ${new Date(order.cancelledAt).toLocaleDateString('en-NP', { year:'numeric', month:'short', day:'numeric' })}` : ''}.
                          {order.paymentStatus === 'refunded' ? ' Refund will be processed within 5–7 business days.' : ''}
                        </span>
                      </div>
                    )}

                    {/* Delivery Tracker — only for non-cancelled paid orders */}
                    {order.paymentStatus === 'completed' && !isCancelled && (
                      <div className="delivery-tracker">
                        <h4>Delivery Tracking</h4>
                        <div className="tracker-steps">
                          {DELIVERY_STAGES.map((stage, idx) => (
                            <div key={stage.key} className={`tracker-step ${idx <= stageIdx ? 'done' : ''} ${idx === stageIdx ? 'active' : ''}`}>
                              <div className="step-dot" />
                              {idx < DELIVERY_STAGES.length - 1 && <div className="step-line" />}
                              <span className="step-label">{stage.label}</span>
                            </div>
                          ))}
                        </div>
                        {order.trackingNumber && (
                          <p className="tracking-num">Tracking No: <strong>{order.trackingNumber}</strong></p>
                        )}
                        {order.adminNote && (
                          <p className="admin-note">Note: {order.adminNote}</p>
                        )}
                      </div>
                    )}

                    {/* Items */}
                    <div className="order-items-section">
                      <h4>Items Ordered</h4>
                      {order.items.map(item => (
                        <div key={item._id} className="order-item-row">
                          <div className="oi-img">
                            {item.image
                              ? <img src={getImageUrl(item.image)} alt={item.name} />
                              : <div className="oi-img-placeholder" />}
                          </div>
                          <div className="oi-info">
                            <p className="oi-name">{item.name}</p>
                            {order.isCustomOrder && (
                              <span className="oi-variant oi-custom-tag">🎨 Custom Order</span>
                            )}
                            {item.selectedColor  && <span className="oi-variant">Color: {item.selectedColor}</span>}
                            {item.selectedSize   && <span className="oi-variant">Size: {item.selectedSize}</span>}
                            {item.selectedFabric && <span className="oi-variant">Fabric: {item.selectedFabric}</span>}
                            {item.customizationNote && (
                              <details className="oi-custom-note-details">
                                <summary className="oi-custom-note-summary">View customization specs</summary>
                                <pre className="oi-custom-note-pre">{item.customizationNote}</pre>
                              </details>
                            )}
                          </div>
                          <div className="oi-pricing">
                            <span className="oi-qty">× {item.quantity}</span>
                            <span className="oi-price">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Billing Summary */}
                    <div className="billing-section">
                      <div className="billing-grid">
                        <div className="billing-addr">
                          <h4>Shipping Address</h4>
                          <p>{order.shippingAddress?.name}</p>
                          <p>{order.shippingAddress?.phone}</p>
                          <p>{order.shippingAddress?.street}</p>
                          <p>{order.shippingAddress?.city}{order.shippingAddress?.state ? `, ${order.shippingAddress.state}` : ''}</p>
                          <p>{order.shippingAddress?.country}</p>
                        </div>
                        <div className="billing-totals">
                          <h4>Bill Summary</h4>
                          <div className="bill-row"><span>Subtotal</span><span>Rs. {order.subtotal?.toFixed(2)}</span></div>
                          <div className="bill-row"><span>Delivery Charge</span><span>Rs. {order.deliveryCharge?.toFixed(2)}</span></div>
                          {order.rewardDiscount > 0 && (
                            <div className="bill-row reward-discount-bill">
                              <span>🎁 Reward Discount</span>
                              <span>− Rs. {order.rewardDiscount?.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="bill-row bill-total"><span>Total Paid</span><span>Rs. {order.totalAmount?.toFixed(2)}</span></div>
                          {order.khaltiTransactionId && (
                            <div className="bill-row"><span>Khalti Txn ID</span><span className="ref-id">{order.khaltiTransactionId}</span></div>
                          )}
                          {order.rewardPointsEarned > 0 && (
                            <div className="bill-row reward-earned-bill">
                              <span><Star size={13} style={{color:'#f59e0b', verticalAlign:'middle', marginRight:3}}/>Points Earned</span>
                              <span>+{order.rewardPointsEarned} pts</span>
                            </div>
                          )}
                          {order.rewardPointsRedeemed > 0 && (
                            <div className="bill-row reward-redeemed-bill">
                              <span>Points Redeemed</span>
                              <span>−{order.rewardPointsRedeemed} pts</span>
                            </div>
                          )}
                          <div className="bill-row">
                            <span>Payment</span>
                            <span className={`badge ${pb.cls}`}>{pb.label}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Cancel Confirmation Modal ── */}
      {cancelModal && (
        <div className="modal-overlay" onClick={() => !cancelling && setCancelModal(null)}>
          <div className="cancel-modal" onClick={e => e.stopPropagation()}>
            <div className="cancel-modal-header">
              <XCircle size={26} className="cancel-modal-icon" />
              <h3>Cancel Order</h3>
            </div>
            <p className="cancel-modal-sub">
              Are you sure you want to cancel this order? This action cannot be undone.
            </p>
            <div className="cancel-modal-field">
              <label>Reason (optional)</label>
              <input
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="e.g. Changed my mind, ordered wrong item…"
                disabled={cancelling}
              />
            </div>
            {cancelError && <p className="cancel-modal-error">{cancelError}</p>}
            <div className="cancel-modal-actions">
              <button className="btn-confirm-cancel" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Yes, Cancel Order'}
              </button>
              <button className="btn-keep-order" onClick={() => setCancelModal(null)} disabled={cancelling}>
                Keep Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
