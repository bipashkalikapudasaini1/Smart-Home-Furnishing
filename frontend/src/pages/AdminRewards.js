import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
  Star, Plus, Trash2, Edit2, X, CheckCircle, Package,
  Truck, Clock, MapPin, XCircle
} from 'lucide-react';
import './AdminRewards.css';

const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
};

// ── Delivery status config ────────────────────────────────────────────────────
const DELIVERY_CONFIG = {
  placed:     { label: 'Placed',      cls: 'ar-d-placed',     icon: <Package size={13}/>    },
  processing: { label: 'Processing',  cls: 'ar-d-processing', icon: <Clock size={13}/>      },
  shipped:    { label: 'Shipped',     cls: 'ar-d-shipped',    icon: <Truck size={13}/>      },
  delivered:  { label: 'Delivered',   cls: 'ar-d-delivered',  icon: <CheckCircle size={13}/> },
  cancelled:  { label: 'Cancelled',   cls: 'ar-d-cancelled',  icon: <XCircle size={13}/>    },
};

const DELIVERY_STATUSES = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'];

const EMPTY_FORM = { name: '', description: '', pointsRequired: '', stock: '-1', isActive: true };

// ═════════════════════════════════════════════════════════════════════════════
const AdminRewards = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [items,        setItems]        = useState([]);
  const [claims,       setClaims]       = useState([]);
  const [tab,          setTab]          = useState('items'); // 'items' | 'claims'
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  // ── Add / Edit item modal ─────────────────────────────────────────────────
  const [showItemModal,  setShowItemModal]  = useState(false);
  const [editItem,       setEditItem]       = useState(null);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [imageFile,      setImageFile]      = useState(null);
  const [imagePreview,   setImagePreview]   = useState('');
  const [saving,         setSaving]         = useState(false);
  const [formError,      setFormError]      = useState('');

  // ── Delivery update modal ─────────────────────────────────────────────────
  const [deliveryModal,  setDeliveryModal]  = useState(null);
  // { claimId, deliveryStatus, trackingNumber, adminNote }
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliveryError,  setDeliveryError]  = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin()) { navigate('/'); return; }
  }, [isAdmin, authLoading, navigate]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.get('/rewards/admin/all');
      setItems(res.data.data || []);
    } catch { setError('Failed to load reward items.'); }
  }, []);

  const fetchClaims = useCallback(async () => {
    try {
      const res = await api.get('/rewards/claims');
      setClaims(res.data.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchItems(), fetchClaims()]).finally(() => setLoading(false));
  }, [fetchItems, fetchClaims]);

  // ── Item modal helpers ────────────────────────────────────────────────────
  const openAdd = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview('');
    setFormError('');
    setShowItemModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name:           item.name,
      description:    item.description || '',
      pointsRequired: String(item.pointsRequired),
      stock:          String(item.stock),
      isActive:       item.isActive
    });
    setImageFile(null);
    setImagePreview(item.image ? getImageUrl(item.image) : '');
    setFormError('');
    setShowItemModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.name || !form.pointsRequired) {
      setFormError('Name and Points Required are mandatory.'); return;
    }
    setSaving(true); setFormError('');
    try {
      const fd = new FormData();
      fd.append('name',           form.name);
      fd.append('description',    form.description);
      fd.append('pointsRequired', form.pointsRequired);
      fd.append('stock',          form.stock);
      fd.append('isActive',       form.isActive);
      if (imageFile) fd.append('image', imageFile);

      if (editItem) {
        await api.put(`/rewards/${editItem._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/rewards', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setShowItemModal(false);
      fetchItems();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this reward item?')) return;
    await api.delete(`/rewards/${id}`);
    fetchItems();
  };

  // ── Open delivery update modal ────────────────────────────────────────────
  const openDeliveryModal = (claim) => {
    setDeliveryModal({
      claimId:        claim._id,
      claim,
      deliveryStatus: claim.deliveryStatus,
      trackingNumber: claim.trackingNumber || '',
      adminNote:      claim.adminNote      || ''
    });
    setDeliveryError('');
  };

  // ── Save delivery update ──────────────────────────────────────────────────
  const handleDeliveryUpdate = async () => {
    setDeliverySaving(true);
    setDeliveryError('');
    try {
      await api.put(`/rewards/claims/${deliveryModal.claimId}/delivery`, {
        deliveryStatus: deliveryModal.deliveryStatus,
        trackingNumber: deliveryModal.trackingNumber,
        adminNote:      deliveryModal.adminNote
      });
      setDeliveryModal(null);
      fetchClaims();
    } catch (err) {
      setDeliveryError(err.response?.data?.message || 'Update failed.');
    } finally {
      setDeliverySaving(false);
    }
  };

  // Count claims that are not yet delivered or cancelled (need attention)
  const activeCount = claims.filter(c => !['delivered', 'cancelled'].includes(c.deliveryStatus)).length;

  if (loading) return <div className="ar-page container">Loading…</div>;

  return (
    <div className="ar-page container">
      <h2 className="ar-title"><Star size={22} className="ar-title-star"/> Reward Store Management</h2>

      {/* ── Tabs ── */}
      <div className="ar-tabs">
        <button className={`ar-tab${tab === 'items' ? ' ar-tab--active' : ''}`} onClick={() => setTab('items')}>
          <Package size={16}/> Reward Items ({items.length})
        </button>
        <button className={`ar-tab${tab === 'claims' ? ' ar-tab--active' : ''}`} onClick={() => setTab('claims')}>
          <Truck size={16}/> Deliveries
          {activeCount > 0 && <span className="ar-badge">{activeCount}</span>}
        </button>
      </div>

      {error && <div className="ar-error">{error}</div>}

      {/* ══════════════ ITEMS TAB ══════════════ */}
      {tab === 'items' && (
        <>
          <div className="ar-toolbar">
            <button className="ar-btn-add" onClick={openAdd}>
              <Plus size={16}/> Add Reward Item
            </button>
          </div>

          {items.length === 0 ? (
            <div className="ar-empty">
              <Star size={40}/>
              <p>No reward items yet. Add one to get started!</p>
            </div>
          ) : (
            <div className="ar-items-grid">
              {items.map(item => (
                <div key={item._id} className={`ar-item-card${!item.isActive ? ' ar-item-card--inactive' : ''}`}>
                  <div className="ar-item-img">
                    {item.image
                      ? <img src={getImageUrl(item.image)} alt={item.name}/>
                      : <div className="ar-img-placeholder"><Star size={28}/></div>
                    }
                    {!item.isActive && <span className="ar-inactive-badge">Inactive</span>}
                  </div>
                  <div className="ar-item-body">
                    <h3 className="ar-item-name">{item.name}</h3>
                    {item.description && <p className="ar-item-desc">{item.description}</p>}
                    <div className="ar-item-meta">
                      <span className="ar-pts-required">
                        <Star size={13}/> {item.pointsRequired} pts required
                      </span>
                      <span className="ar-stock">
                        {item.stock === -1 ? '∞ Unlimited' : `${item.stock} left`}
                      </span>
                    </div>
                  </div>
                  <div className="ar-item-actions">
                    <button className="ar-btn-edit" onClick={() => openEdit(item)}>
                      <Edit2 size={14}/> Edit
                    </button>
                    <button className="ar-btn-del" onClick={() => handleDelete(item._id)}>
                      <Trash2 size={14}/> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════════ DELIVERIES TAB ══════════════ */}
      {tab === 'claims' && (
        <>
          {claims.length === 0 ? (
            <div className="ar-empty"><Truck size={40}/><p>No reward claims yet.</p></div>
          ) : (
            <div className="ar-claims-table-wrap">
              <table className="ar-claims-table">
                <thead>
                  <tr>
                    <th>Reward Item</th>
                    <th>Customer</th>
                    <th>Ship To</th>
                    <th>Points</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map(c => {
                    const dc = DELIVERY_CONFIG[c.deliveryStatus] || DELIVERY_CONFIG.placed;
                    const addr = c.shippingAddress;
                    return (
                      <tr key={c._id}>
                        {/* Item */}
                        <td>
                          <div className="ar-claim-item">
                            {c.rewardItem?.image
                              ? <img src={getImageUrl(c.rewardItem.image)} alt={c.rewardItem?.name} className="ar-claim-thumb"/>
                              : <div className="ar-claim-thumb ar-claim-thumb--placeholder"><Star size={14}/></div>
                            }
                            <span>{c.rewardItem?.name || '—'}</span>
                          </div>
                        </td>

                        {/* Customer */}
                        <td>
                          <p className="ar-claim-uname">{c.user?.name}</p>
                          <p className="ar-claim-uemail">{c.user?.email}</p>
                          {c.user?.phone && <p className="ar-claim-uphone">{c.user.phone}</p>}
                        </td>

                        {/* Shipping address */}
                        <td>
                          {addr?.street ? (
                            <div className="ar-claim-addr">
                              <p className="ar-addr-name">{addr.name}</p>
                              <p className="ar-addr-phone">{addr.phone}</p>
                              <p className="ar-addr-line">
                                <MapPin size={11}/> {addr.street}, {addr.city}
                                {addr.state ? `, ${addr.state}` : ''}
                              </p>
                            </div>
                          ) : (
                            <span className="ar-addr-empty">—</span>
                          )}
                          {c.trackingNumber && (
                            <p className="ar-tracking-num">
                              <Truck size={10}/> {c.trackingNumber}
                            </p>
                          )}
                        </td>

                        {/* Points */}
                        <td><strong>{c.pointsSpent} pts</strong></td>

                        {/* Date */}
                        <td>{new Date(c.createdAt).toLocaleDateString('en-NP', { year: 'numeric', month: 'short', day: 'numeric' })}</td>

                        {/* Status */}
                        <td>
                          <span className={`ar-status-badge ${dc.cls}`}>
                            {dc.icon} {dc.label}
                          </span>
                          {c.adminNote && <p className="ar-claim-note">{c.adminNote}</p>}
                        </td>

                        {/* Action */}
                        <td>
                          <button
                            className="ar-btn-update-delivery"
                            onClick={() => openDeliveryModal(c)}
                          >
                            <Truck size={13}/> Update
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══════════════ ADD / EDIT ITEM MODAL ══════════════ */}
      {showItemModal && (
        <div className="ar-modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="ar-modal" onClick={e => e.stopPropagation()}>
            <div className="ar-modal-header">
              <h3>{editItem ? 'Edit Reward Item' : 'Add Reward Item'}</h3>
              <button className="ar-modal-close" onClick={() => setShowItemModal(false)}><X size={18}/></button>
            </div>

            {formError && <p className="ar-form-error">{formError}</p>}

            <div className="ar-form-group">
              <label>Item Image</label>
              <div className="ar-img-upload">
                {imagePreview
                  ? <img src={imagePreview} alt="preview" className="ar-img-preview"/>
                  : <div className="ar-img-placeholder-sm"><Star size={22}/><span>Upload Image</span></div>
                }
                <input type="file" accept="image/*" onChange={handleImageChange}/>
              </div>
            </div>

            <div className="ar-form-group">
              <label>Item Name <span className="ar-req">*</span></label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Discount Coupon, Free Cushion…"
              />
            </div>

            <div className="ar-form-group">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this reward…"
                rows={2}
              />
            </div>

            <div className="ar-form-row">
              <div className="ar-form-group">
                <label>Points Required <span className="ar-req">*</span></label>
                <input
                  type="number" min="1"
                  value={form.pointsRequired}
                  onChange={e => setForm(f => ({ ...f, pointsRequired: e.target.value }))}
                  placeholder="e.g. 200"
                />
              </div>
              <div className="ar-form-group">
                <label>Stock (-1 = unlimited)</label>
                <input
                  type="number" min="-1"
                  value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  placeholder="-1"
                />
              </div>
            </div>

            <div className="ar-form-group ar-toggle-group">
              <label className="ar-toggle-label">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                />
                <span>Active (visible to users)</span>
              </label>
            </div>

            <button className="ar-btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editItem ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ DELIVERY UPDATE MODAL ══════════════ */}
      {deliveryModal && (
        <div className="ar-modal-overlay" onClick={() => setDeliveryModal(null)}>
          <div className="ar-modal" onClick={e => e.stopPropagation()}>
            <div className="ar-modal-header">
              <div>
                <h3>Update Delivery Status</h3>
                <p className="ar-modal-subhead">
                  {deliveryModal.claim.rewardItem?.name} — {deliveryModal.claim.user?.name}
                </p>
              </div>
              <button className="ar-modal-close" onClick={() => setDeliveryModal(null)}><X size={18}/></button>
            </div>

            {/* Shipping address reminder */}
            {deliveryModal.claim.shippingAddress?.street && (
              <div className="ar-delivery-addr-box">
                <p className="ar-delivery-addr-title"><MapPin size={13}/> Deliver to:</p>
                <p className="ar-delivery-addr-line">
                  {deliveryModal.claim.shippingAddress.name} · {deliveryModal.claim.shippingAddress.phone}
                </p>
                <p className="ar-delivery-addr-line">
                  {deliveryModal.claim.shippingAddress.street}, {deliveryModal.claim.shippingAddress.city}
                  {deliveryModal.claim.shippingAddress.state ? `, ${deliveryModal.claim.shippingAddress.state}` : ''}
                </p>
              </div>
            )}

            {deliveryError && <p className="ar-form-error">{deliveryError}</p>}

            {/* Delivery status select */}
            <div className="ar-form-group">
              <label>Delivery Status <span className="ar-req">*</span></label>
              <select
                className="ar-delivery-select"
                value={deliveryModal.deliveryStatus}
                onChange={e => setDeliveryModal(d => ({ ...d, deliveryStatus: e.target.value }))}
              >
                {DELIVERY_STATUSES.map(s => (
                  <option key={s} value={s}>{DELIVERY_CONFIG[s].label}</option>
                ))}
              </select>
            </div>

            {/* Tracking number */}
            <div className="ar-form-group">
              <label>Tracking Number <span className="ar-optional">(optional)</span></label>
              <input
                value={deliveryModal.trackingNumber}
                onChange={e => setDeliveryModal(d => ({ ...d, trackingNumber: e.target.value }))}
                placeholder="e.g. NPC123456789"
              />
            </div>

            {/* Admin note */}
            <div className="ar-form-group">
              <label>Admin Note <span className="ar-optional">(optional — shown to user)</span></label>
              <textarea
                value={deliveryModal.adminNote}
                onChange={e => setDeliveryModal(d => ({ ...d, adminNote: e.target.value }))}
                placeholder="e.g. Item dispatched via Nepal Post"
                rows={2}
              />
            </div>

            <div className="ar-delivery-modal-actions">
              <button className="ar-btn-cancel-modal" onClick={() => setDeliveryModal(null)}>
                Cancel
              </button>
              <button className="ar-btn-save ar-btn-save--delivery" onClick={handleDeliveryUpdate} disabled={deliverySaving}>
                {deliverySaving ? 'Updating…' : <><Truck size={15}/> Update Status</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRewards;
