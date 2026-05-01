import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatAPI, orderAPI } from '../utils/api';
import {
  Palette, Package, Clock, CheckCircle, ShoppingCart,
  ChevronDown, ChevronUp, XCircle, Star
} from 'lucide-react';
import useAutoRefresh from '../hooks/useAutoRefresh';
import './MyCustomizations.css';

const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
};

// ── Status config for customization requests ──────────────────────────────────
const requestStatus = (chat) => {
  if (chat.linkedOrderId) return { label: 'Paid & Ordered', cls: 'mc-badge--paid',      icon: <CheckCircle size={13}/> };
  if (chat.confirmedPrice) return { label: 'Ready to Pay',  cls: 'mc-badge--ready',     icon: <ShoppingCart size={13}/> };
  if (chat.status === 'closed') return { label: 'Closed',   cls: 'mc-badge--closed',    icon: <XCircle size={13}/> };
  return                          { label: 'In Review',     cls: 'mc-badge--inreview',  icon: <Clock size={13}/> };
};

// ── Delivery stages (mirrors OrderHistory) ────────────────────────────────────
const DELIVERY_STAGES = ['placed','processing','shipped','delivered'];
const DELIVERY_LABEL  = { placed:'Order Placed', processing:'Processing', shipped:'Shipped', delivered:'Delivered' };
const DELIVERY_BADGE  = {
  placed:     { label:'Order Placed', cls:'badge-blue' },
  processing: { label:'Processing',   cls:'badge-yellow' },
  shipped:    { label:'Shipped',      cls:'badge-purple' },
  delivered:  { label:'Delivered',    cls:'badge-green' },
  cancelled:  { label:'Cancelled',    cls:'badge-red' },
};

// ─────────────────────────────────────────────────────────────────────────────
const MyCustomizations = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [tab,      setTab]      = useState('requests'); // 'requests' | 'orders'
  const [requests, setRequests] = useState([]);
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    loadAll();
  }, [authLoading, user]); // eslint-disable-line

  const loadAll = async () => {
    setLoading(true);
    try {
      const [chatRes, orderRes] = await Promise.all([
        chatAPI.getMyCustomizations(),
        orderAPI.getMyOrders(),
      ]);
      setRequests(chatRes.data.data || []);
      // Filter only custom orders
      setOrders((orderRes.data?.data || []).filter(o => o.isCustomOrder));
    } catch {}
    finally { setLoading(false); }
  };

  useAutoRefresh(loadAll, 30_000);

  const toggleExpand = (id) => setExpanded(prev => prev === id ? null : id);

  if (loading) return <div className="mc-page container">Loading your customizations…</div>;

  return (
    <div className="mc-page container">
      <div className="mc-title-row">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h2 className="mc-title">
          <Palette size={22} className="mc-title-icon"/> My Customizations
        </h2>
      </div>

      {/* ── Tabs ── */}
      <div className="mc-tabs">
        <button className={`mc-tab${tab === 'requests' ? ' mc-tab--active' : ''}`} onClick={() => setTab('requests')}>
          <Clock size={15}/> Requests ({requests.length})
        </button>
        <button className={`mc-tab${tab === 'orders' ? ' mc-tab--active' : ''}`} onClick={() => setTab('orders')}>
          <Package size={15}/> Custom Orders ({orders.length})
        </button>
      </div>

      {/* ══════════════ REQUESTS TAB ══════════════ */}
      {tab === 'requests' && (
        <>
          {requests.length === 0 ? (
            <div className="mc-empty">
              <Palette size={44}/>
              <p>No customization requests yet.</p>
              <Link to="/" className="btn btn-primary">Browse Products</Link>
            </div>
          ) : (
            <div className="mc-list">
              {requests.map(chat => {
                const st       = requestStatus(chat);
                const isOpen   = expanded === chat._id;
                const imgUrl   = getImageUrl(chat.productId?.images?.[0] || '');
                const specs    = (chat.customizationDetails || '').replace('📋 Customization Request:\n\n','').trim();
                const specRows = specs.split('\n').filter(Boolean);

                return (
                  <div key={chat._id} className="mc-card">
                    <div className="mc-card-header" onClick={() => toggleExpand(chat._id)}>
                      {/* Product image */}
                      <div className="mc-img">
                        {imgUrl
                          ? <img src={imgUrl} alt={chat.productName}/>
                          : <div className="mc-img-placeholder"><Palette size={20}/></div>
                        }
                      </div>

                      {/* Info */}
                      <div className="mc-info">
                        <p className="mc-product-name">{chat.productName}</p>
                        <p className="mc-date">
                          Requested {new Date(chat.createdAt).toLocaleDateString('en-NP', { year:'numeric', month:'short', day:'numeric' })}
                        </p>
                        {chat.confirmedPrice && (
                          <p className="mc-confirmed-price">
                            <Star size={13}/> Agreed price: <strong>Rs. {chat.confirmedPrice.toFixed(2)}</strong>
                          </p>
                        )}
                      </div>

                      {/* Right — badge + expand */}
                      <div className="mc-card-right">
                        <span className={`mc-badge ${st.cls}`}>{st.icon} {st.label}</span>
                        <button className="mc-expand-btn">
                          {isOpen ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                        </button>
                      </div>
                    </div>

                    {/* Expanded specs */}
                    {isOpen && (
                      <div className="mc-card-body">
                        <h4 className="mc-specs-title">Customization Specs</h4>
                        <div className="mc-specs-grid">
                          {specRows.map((row, i) => {
                            const [label, ...rest] = row.split(':');
                            return (
                              <div key={i} className="mc-spec-row">
                                <span className="mc-spec-label">{label.trim()}:</span>
                                <span className="mc-spec-value">{rest.join(':').trim() || '—'}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Action buttons */}
                        <div className="mc-card-actions">
                          {/* Pay now — if confirmed but not yet linked to an order */}
                          {chat.confirmedPrice && !chat.linkedOrderId && (
                            <button
                              className="mc-btn-pay"
                              onClick={() => navigate('/checkout', {
                                state: {
                                  customOrderData: {
                                    chatId:            chat._id,
                                    productId:         chat.productId?._id,
                                    productName:       chat.productName,
                                    confirmedPrice:    chat.confirmedPrice,
                                    customizationNote: chat.customizationDetails || '',
                                    image:             chat.productId?.images?.[0] || '',
                                  }
                                }
                              })}
                            >
                              <ShoppingCart size={15}/> Pay Now — Rs. {chat.confirmedPrice.toFixed(2)}
                            </button>
                          )}
                          {/* View order — if already paid */}
                          {chat.linkedOrderId && (
                            <Link to="/orders" className="mc-btn-view-order">
                              <Package size={15}/> View Order
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════ CUSTOM ORDERS TAB ══════════════ */}
      {tab === 'orders' && (
        <>
          {orders.length === 0 ? (
            <div className="mc-empty">
              <Package size={44}/>
              <p>No custom orders placed yet.</p>
              <p className="mc-empty-hint">Once you pay for a confirmed custom request, it will appear here.</p>
            </div>
          ) : (
            <div className="mc-list">
              {orders.map(order => {
                const isOpen      = expanded === `ord-${order._id}`;
                const db          = DELIVERY_BADGE[order.deliveryStatus] || { label: order.deliveryStatus, cls: 'badge-gray' };
                const stageIdx    = DELIVERY_STAGES.indexOf(order.deliveryStatus);
                const isCancelled = order.deliveryStatus === 'cancelled';
                const item        = order.items?.[0];

                return (
                  <div key={order._id} className={`mc-card${isCancelled ? ' mc-card--cancelled' : ''}`}>
                    <div className="mc-card-header" onClick={() => toggleExpand(`ord-${order._id}`)}>
                      {/* Product image */}
                      <div className="mc-img">
                        {item?.image
                          ? <img src={getImageUrl(item.image)} alt={item.name}/>
                          : <div className="mc-img-placeholder"><Palette size={20}/></div>
                        }
                      </div>

                      {/* Info */}
                      <div className="mc-info">
                        <p className="mc-product-name">{item?.name || 'Custom Item'}</p>
                        <p className="mc-date">
                          Placed {new Date(order.createdAt).toLocaleDateString('en-NP', { year:'numeric', month:'short', day:'numeric' })}
                        </p>
                        <p className="mc-order-amount">Rs. {order.totalAmount?.toFixed(2)}</p>
                      </div>

                      {/* Right — badge + expand */}
                      <div className="mc-card-right">
                        <span className={`badge ${db.cls}`}>{db.label}</span>
                        <button className="mc-expand-btn">
                          {isOpen ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                        </button>
                      </div>
                    </div>

                    {/* Expanded order details */}
                    {isOpen && (
                      <div className="mc-card-body">

                        {/* Cancelled banner */}
                        {isCancelled && (
                          <div className="mc-cancelled-banner">
                            <XCircle size={15}/>
                            <span>This order was cancelled.{order.paymentStatus === 'refunded' ? ' Refund will be processed within 5–7 business days.' : ''}</span>
                          </div>
                        )}

                        {/* Delivery Tracker */}
                        {!isCancelled && order.paymentStatus === 'completed' && (
                          <div className="mc-tracker">
                            <h4>Delivery Tracking</h4>
                            <div className="mc-tracker-steps">
                              {DELIVERY_STAGES.map((s, idx) => (
                                <div key={s} className={`mc-step${idx <= stageIdx ? ' mc-step--done' : ''}${idx === stageIdx ? ' mc-step--active' : ''}`}>
                                  <div className="mc-step-dot"/>
                                  {idx < DELIVERY_STAGES.length - 1 && <div className={`mc-step-line${idx < stageIdx ? ' mc-step-line--done' : ''}`}/>}
                                  <span className="mc-step-label">{DELIVERY_LABEL[s]}</span>
                                </div>
                              ))}
                            </div>
                            {order.trackingNumber && <p className="mc-tracking">Tracking No: <strong>{order.trackingNumber}</strong></p>}
                            {order.adminNote && <p className="mc-admin-note">Note: {order.adminNote}</p>}
                          </div>
                        )}

                        {/* Customization specs */}
                        {item?.customizationNote && (
                          <div className="mc-specs-section">
                            <h4 className="mc-specs-title">Customization Specs</h4>
                            <div className="mc-specs-grid">
                              {item.customizationNote
                                .replace('📋 Customization Request:\n\n','')
                                .split('\n')
                                .filter(Boolean)
                                .map((row, i) => {
                                  const [label, ...rest] = row.split(':');
                                  return (
                                    <div key={i} className="mc-spec-row">
                                      <span className="mc-spec-label">{label.trim()}:</span>
                                      <span className="mc-spec-value">{rest.join(':').trim() || '—'}</span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {/* Shipping Address */}
                        {order.shippingAddress?.street && (
                          <div className="mc-addr">
                            <h4>Shipping Address</h4>
                            <p>{order.shippingAddress.name}</p>
                            <p>{order.shippingAddress.phone}</p>
                            <p>{order.shippingAddress.street}, {order.shippingAddress.city}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MyCustomizations;
