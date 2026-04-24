import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Users, Search, ChevronDown, ChevronUp, Package, DollarSign, User, Star } from 'lucide-react';
import './AdminUsers.css';

const DELIVERY_BADGE = {
  placed:     { label: 'Placed',    cls: 'badge-blue' },
  processing: { label: 'Processing',cls: 'badge-yellow' },
  shipped:    { label: 'Shipped',   cls: 'badge-purple' },
  delivered:  { label: 'Delivered', cls: 'badge-green' }
};

const PAYMENT_BADGE = {
  completed: { label: 'Paid',     cls: 'badge-green' },
  pending:   { label: 'Pending',  cls: 'badge-yellow' },
  failed:    { label: 'Failed',   cls: 'badge-red' },
  refunded:  { label: 'Refunded', cls: 'badge-gray' }
};

const AdminUsers = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers]           = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // User detail drawer
  const [selectedUser, setSelectedUser]   = useState(null);
  const [userDetail, setUserDetail]       = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);


  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin()) { navigate('/'); return; }
  }, [isAdmin, authLoading, navigate]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/orders/admin/users', {
        params: { page, limit: 15, search: debouncedSearch }
      });
      setUsers(res.data.data || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openUserDetail = async (userId) => {
    setSelectedUser(userId);
    setUserDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/orders/admin/users/${userId}`);
      setUserDetail(res.data.data);
    } catch {
      setUserDetail({ error: 'Failed to load user details.' });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="admin-users-page container">
      <h2 className="au-title"><Users size={22} /> User Management</h2>

      {/* ── Summary strip ── */}
      <div className="au-summary-strip">
        <div className="au-summary-item">
          <User size={18} />
          <span><strong>{total}</strong> registered users</span>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="au-search-bar">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="au-error">{error}</div>}

      {/* ── Users Table ── */}
      <div className="au-table-wrapper">
        <table className="au-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Joined</th>
              <th>Orders</th>
              <th>Total Spent</th>
              <th><Star size={13} style={{color:'#f59e0b', verticalAlign:'middle', marginRight:3}}/>Reward Pts</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="au-center">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="au-center">No users found.</td></tr>
            ) : (
              users.map(u => (
                <tr key={u._id} className={selectedUser === u._id ? 'au-row-selected' : ''}>
                  <td>
                    <div className="au-user-cell">
                      <div className="au-avatar">{u.name?.charAt(0).toUpperCase()}</div>
                      <span className="au-name">{u.name}</span>
                    </div>
                  </td>
                  <td className="au-email">{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td>{new Date(u.createdAt).toLocaleDateString('en-NP', { year:'numeric', month:'short', day:'numeric' })}</td>
                  <td>
                    <span className="au-order-count">{u.orderCount}</span>
                    <span className="au-order-sub"> ({u.completedOrderCount} paid)</span>
                  </td>
                  <td className="au-spent">Rs. {u.totalSpent?.toLocaleString()}</td>
                  <td>
                    <span className="au-reward-pts">
                      <Star size={12} style={{color:'#f59e0b', verticalAlign:'middle', marginRight:3}}/>
                      {u.rewardPoints ?? 0}
                    </span>
                  </td>
                  <td>
                    <button className="btn-view-user" onClick={() => openUserDetail(u._id)}>
                      View Orders
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="au-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      {/* ── User Detail Side Panel ── */}
      {selectedUser && (
        <div className="au-side-panel">
          <div className="au-panel-header">
            <h3>User Orders</h3>
            <button className="au-close" onClick={() => { setSelectedUser(null); setUserDetail(null); }}>✕</button>
          </div>

          {detailLoading && <p className="au-panel-loading">Loading…</p>}

          {userDetail?.error && <p className="au-panel-error">{userDetail.error}</p>}

          {userDetail && !userDetail.error && (
            <>
              {/* User info */}
              <div className="au-panel-user">
                <div className="au-avatar lg">{userDetail.user?.name?.charAt(0).toUpperCase()}</div>
                <div>
                  <p className="au-panel-name">{userDetail.user?.name}</p>
                  <p className="au-panel-email">{userDetail.user?.email}</p>
                  {userDetail.user?.phone && <p className="au-panel-phone">{userDetail.user.phone}</p>}
                </div>
              </div>

              {/* Stats row */}
              <div className="au-panel-stats">
                <div className="au-ps-item">
                  <Package size={16} />
                  <span><strong>{userDetail.stats?.totalOrders}</strong> orders</span>
                </div>
                <div className="au-ps-item">
                  <DollarSign size={16} />
                  <span><strong>Rs. {userDetail.stats?.totalSpent?.toLocaleString()}</strong> spent</span>
                </div>
                <div className="au-ps-item">
                  <Star size={16} style={{color:'#f59e0b'}} />
                  <span><strong>{userDetail.user?.rewardPoints ?? 0}</strong> pts</span>
                </div>
              </div>

              {/* Order list */}
              {userDetail.orders?.length === 0 ? (
                <p className="au-panel-no-orders">No orders yet.</p>
              ) : (
                <div className="au-panel-orders">
                  {userDetail.orders.map(order => {
                    const pb = PAYMENT_BADGE[order.paymentStatus] || { label: order.paymentStatus, cls: 'badge-gray' };
                    const db = DELIVERY_BADGE[order.deliveryStatus] || { label: order.deliveryStatus, cls: 'badge-gray' };
                    const isOpen = expandedOrder === order._id;

                    return (
                      <div key={order._id} className="au-order-card">
                        <div className="au-order-head" onClick={() => setExpandedOrder(isOpen ? null : order._id)}>
                          <div>
                            <p className="au-order-id">#{order._id.slice(-8).toUpperCase()}</p>
                            <p className="au-order-date">{new Date(order.createdAt).toLocaleDateString('en-NP', { year:'numeric', month:'short', day:'numeric' })}</p>
                          </div>
                          <div className="au-order-right">
                            <p className="au-order-amount">Rs. {order.totalAmount?.toFixed(2)}</p>
                            <span className={`badge ${pb.cls}`}>{pb.label}</span>
                            <span className={`badge ${db.cls}`}>{db.label}</span>
                          </div>
                          <button className="au-expand-btn">
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>

                        {isOpen && (
                          <div className="au-order-detail">
                            {order.items?.map(item => (
                              <div key={item._id} className="au-order-item">
                                <span className="au-item-name">{item.name}</span>
                                <span className="au-item-detail">× {item.quantity} — Rs. {(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                            <div className="au-bill-row"><span>Subtotal</span><span>Rs. {order.subtotal?.toFixed(2)}</span></div>
                            <div className="au-bill-row"><span>Delivery</span><span>Rs. {order.deliveryCharge?.toFixed(2)}</span></div>
                            <div className="au-bill-row bold"><span>Total</span><span>Rs. {order.totalAmount?.toFixed(2)}</span></div>
                            {order.khaltiTransactionId && <div className="au-bill-row"><span>Khalti Txn ID</span><span className="au-ref">{order.khaltiTransactionId}</span></div>}
                            <div className="au-addr">
                              <strong>Ship to:</strong> {order.shippingAddress?.name}, {order.shippingAddress?.street}, {order.shippingAddress?.city}
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
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
