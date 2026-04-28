import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
  ShoppingBag, Filter, ChevronDown, ChevronUp,
  TrendingUp, Package, Clock, CheckCircle, Truck
} from 'lucide-react';
import './AdminOrders.css';

const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
  return `${base}${path}`;
};

const DELIVERY_STAGES = ['placed', 'processing', 'shipped', 'delivered'];

const DELIVERY_BADGE = {
  placed:     { label: 'Order Placed', cls: 'badge-blue' },
  processing: { label: 'Processing',   cls: 'badge-yellow' },
  shipped:    { label: 'Shipped',      cls: 'badge-purple' },
  delivered:  { label: 'Delivered',    cls: 'badge-green' },
  cancelled:  { label: 'Cancelled',    cls: 'badge-red' }
};

const PAYMENT_BADGE = {
  completed: { label: 'Paid',       cls: 'badge-green' },
  pending:   { label: 'Pending',    cls: 'badge-yellow' },
  failed:    { label: 'Failed',     cls: 'badge-red' },
  refunded:  { label: 'Refunded',   cls: 'badge-gray' },
  cancelled: { label: 'Cancelled',  cls: 'badge-red' }
};

const AdminOrders = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders]         = useState([]);
  const [stats, setStats]           = useState({ total: 0, totalRevenue: 0 });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [expanded, setExpanded]     = useState(null);
  const [updating, setUpdating]     = useState(null);

  // Filters
  const [paymentFilter, setPaymentFilter]   = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [page, setPage]                     = useState(1);
  const [totalPages, setTotalPages]         = useState(1);

  // Delivery update modal state
  const [updateModal, setUpdateModal]     = useState(null); // { orderId, current }
  const [newStatus, setNewStatus] = useState('');
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin()) { navigate('/'); return; }
  }, [isAdmin, authLoading, navigate]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 15 };
      if (paymentFilter)  params.paymentStatus  = paymentFilter;
      if (deliveryFilter) params.deliveryStatus = deliveryFilter;

      const res = await api.get('/orders/admin/all', { params });
      setOrders(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
      setStats({
        total: res.data.total || 0,
        totalRevenue: res.data.totalRevenue || 0
      });
    } catch {
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [page, paymentFilter, deliveryFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const openUpdateModal = (order) => {
    setUpdateModal({ orderId: order._id, current: order.deliveryStatus });
    setNewStatus(order.deliveryStatus);
    setAdminNote(order.adminNote || '');
  };

  const handleUpdateDelivery = async () => {
    if (!updateModal) return;
    setUpdating(updateModal.orderId);
    try {
      await api.put(`/orders/admin/${updateModal.orderId}/delivery`, {
        deliveryStatus: newStatus,
        adminNote
      });
      setUpdateModal(null);
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setUpdating(null);
    }
  };

  const completedOrders = orders.filter(o => o.paymentStatus === 'completed').length;
  const pendingOrders   = orders.filter(o => o.paymentStatus === 'pending').length;
  const shippedOrders   = orders.filter(o => o.deliveryStatus === 'shipped' || o.deliveryStatus === 'delivered').length;

  return (
    <div className="admin-orders-page container">
      <h2 className="ao-title"><ShoppingBag size={22} /> Order Management</h2>

      {/* ── Stats Cards ── */}
      <div className="ao-stats">
        <div className="stat-card">
          <TrendingUp size={22} className="stat-icon green" />
          <div>
            <p className="stat-num">Rs. {stats.totalRevenue.toLocaleString()}</p>
            <p className="stat-lbl">Total Revenue</p>
          </div>
        </div>
        <div className="stat-card">
          <Package size={22} className="stat-icon blue" />
          <div>
            <p className="stat-num">{stats.total}</p>
            <p className="stat-lbl">Total Orders</p>
          </div>
        </div>
        <div className="stat-card">
          <CheckCircle size={22} className="stat-icon green" />
          <div>
            <p className="stat-num">{completedOrders}</p>
            <p className="stat-lbl">Paid (this page)</p>
          </div>
        </div>
        <div className="stat-card">
          <Clock size={22} className="stat-icon yellow" />
          <div>
            <p className="stat-num">{pendingOrders}</p>
            <p className="stat-lbl">Pending</p>
          </div>
        </div>
        <div className="stat-card">
          <Truck size={22} className="stat-icon purple" />
          <div>
            <p className="stat-num">{shippedOrders}</p>
            <p className="stat-lbl">Shipped/Delivered</p>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="ao-filters">
        <Filter size={16} />
        <select value={paymentFilter} onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}>
          <option value="">All Payment Status</option>
          <option value="completed">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <select value={deliveryFilter} onChange={e => { setDeliveryFilter(e.target.value); setPage(1); }}>
          <option value="">All Delivery Status</option>
          {DELIVERY_STAGES.map(s => <option key={s} value={s}>{DELIVERY_BADGE[s]?.label || s}</option>)}
        </select>
        <button className="btn-reset" onClick={() => { setPaymentFilter(''); setDeliveryFilter(''); setPage(1); }}>
          Reset
        </button>
      </div>

      {error && <div className="ao-error">{error}</div>}

      {/* ── Orders Table ── */}
      {loading ? (
        <p className="ao-loading">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="ao-empty">No orders found.</p>
      ) : (
        <div className="ao-list">
          {orders.map(order => {
            const isOpen = expanded === order._id;
            const pb = PAYMENT_BADGE[order.paymentStatus] || { label: order.paymentStatus, cls: 'badge-gray' };
            const db = DELIVERY_BADGE[order.deliveryStatus] || { label: order.deliveryStatus, cls: 'badge-gray' };

            return (
              <div key={order._id} className="ao-card">
                {/* Header Row */}
                <div className="ao-row">
                  <div className="ao-col ao-user">
                    <p className="ao-user-name">{order.user?.name || 'Unknown'}</p>
                    <p className="ao-user-email">{order.user?.email}</p>
                  </div>
                  <div className="ao-col">
                    <p className="ao-sub-label">Date</p>
                    <p>{new Date(order.createdAt).toLocaleDateString('en-NP', { year:'numeric', month:'short', day:'numeric' })}</p>
                  </div>
                  <div className="ao-col">
                    <p className="ao-sub-label">Amount</p>
                    <p className="ao-amount">Rs. {order.totalAmount?.toFixed(2)}</p>
                  </div>
                  <div className="ao-col ao-col-badges">
                    <span className={`badge ${pb.cls}`}>{pb.label}</span>
                    <span className={`badge ${db.cls}`}>{db.label}</span>
                  </div>
                  <div className="ao-col ao-actions">
                    {order.paymentStatus === 'completed' && order.deliveryStatus !== 'cancelled' && (
                      <button className="btn-update" onClick={() => openUpdateModal(order)}>
                        Update Delivery
                      </button>
                    )}
                    <button className="expand-btn" onClick={() => setExpanded(isOpen ? null : order._id)}>
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* ── Expanded Details ── */}
                {isOpen && (
                  <div className="ao-details">
                    {/* Items */}
                    <div className="ao-section">
                      <h5>Products Ordered</h5>
                      {order.items.map(item => (
                        <div key={item._id} className="ao-item">
                          <div className="ao-item-img">
                            {item.image
                              ? <img src={getImageUrl(item.image)} alt={item.name} />
                              : <div className="ao-img-ph" />}
                          </div>
                          <div className="ao-item-info">
                            <p className="ao-item-name">{item.name}</p>
                            {item.selectedColor  && <span className="ao-variant">Color: {item.selectedColor}</span>}
                            {item.selectedSize   && <span className="ao-variant">Size: {item.selectedSize}</span>}
                            {item.selectedFabric && <span className="ao-variant">Fabric: {item.selectedFabric}</span>}
                          </div>
                          <div className="ao-item-pricing">
                            <span>× {item.quantity}</span>
                            <strong>Rs. {(item.price * item.quantity).toFixed(2)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Billing & Address */}
                    <div className="ao-billing-grid">
                      <div className="ao-section">
                        <h5>Shipping Address</h5>
                        <p>{order.shippingAddress?.name} — {order.shippingAddress?.phone}</p>
                        <p>{order.shippingAddress?.street}, {order.shippingAddress?.city}</p>
                        {order.shippingAddress?.state && <p>{order.shippingAddress.state}</p>}
                        <p>{order.shippingAddress?.country}</p>
                      </div>
                      <div className="ao-section">
                        <h5>Bill Summary</h5>
                        <div className="ao-bill-row"><span>Subtotal</span><span>Rs. {order.subtotal?.toFixed(2)}</span></div>
                        <div className="ao-bill-row"><span>Delivery</span><span>Rs. {order.deliveryCharge?.toFixed(2)}</span></div>
                        <div className="ao-bill-row ao-bill-total"><span>Total</span><span>Rs. {order.totalAmount?.toFixed(2)}</span></div>
                        {order.khaltiTransactionId && <div className="ao-bill-row"><span>Khalti Txn ID</span><span className="txn-ref">{order.khaltiTransactionId}</span></div>}
                        {order.adminNote && <div className="ao-bill-row"><span>Admin Note</span><span>{order.adminNote}</span></div>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="ao-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {/* ── Update Delivery Modal ── */}
      {updateModal && (
        <div className="modal-overlay" onClick={() => setUpdateModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Update Delivery Status</h3>
            <p className="modal-sub">Order: <strong>{updateModal.orderId.slice(-10).toUpperCase()}</strong></p>

            <div className="modal-field">
              <label>Delivery Status</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                {DELIVERY_STAGES.map(s => (
                  <option key={s} value={s}>{DELIVERY_BADGE[s]?.label || s}</option>
                ))}
              </select>
            </div>

            <div className="modal-field">
              <label>Admin Note (optional)</label>
              <input value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="e.g. Out for delivery today" />
            </div>

            <div className="modal-actions">
              <button className="btn-save" onClick={handleUpdateDelivery} disabled={!!updating}>
                {updating ? 'Saving…' : 'Save Changes'}
              </button>
              <button className="btn-cancel" onClick={() => setUpdateModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
