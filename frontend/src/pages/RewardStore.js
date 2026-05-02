import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
  Star, Gift, CheckCircle, Clock, Truck, Package,
  MapPin, X, ShoppingBag, XCircle
} from 'lucide-react';
import useAutoRefresh from '../hooks/useAutoRefresh';
import './RewardStore.css';

const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
};

// ── Delivery status config (mirrors regular orders) ──────────────────────────
const DELIVERY_STEPS  = ['placed', 'processing', 'shipped', 'delivered'];
const DELIVERY_CONFIG = {
  placed:     { label: 'Order Placed', icon: <Package size={13}/>,      cls: 'rs-d-placed'     },
  processing: { label: 'Processing',   icon: <Clock size={13}/>,         cls: 'rs-d-processing' },
  shipped:    { label: 'Shipped',      icon: <Truck size={13}/>,         cls: 'rs-d-shipped'    },
  delivered:  { label: 'Delivered',    icon: <CheckCircle size={13}/>,   cls: 'rs-d-delivered'  },
  cancelled:  { label: 'Cancelled',    icon: <XCircle size={13}/>,       cls: 'rs-d-cancelled'  },
};

const EMPTY_ADDR = { name: '', phone: '', street: '', city: '' };

// ── Delivery progress stepper ─────────────────────────────────────────────────
const DeliveryStepper = ({ status }) => {
  if (status === 'cancelled') return null;
  const currentIdx = DELIVERY_STEPS.indexOf(status);
  return (
    <div className="rs-stepper">
      {DELIVERY_STEPS.map((step, idx) => (
        <React.Fragment key={step}>
          <div className={`rs-step${idx <= currentIdx ? ' rs-step--done' : ''}${idx === currentIdx ? ' rs-step--active' : ''}`}>
            <div className="rs-step-dot"/>
            <span className="rs-step-label">{DELIVERY_CONFIG[step].label}</span>
          </div>
          {idx < DELIVERY_STEPS.length - 1 && (
            <div className={`rs-step-line${idx < currentIdx ? ' rs-step-line--done' : ''}`}/>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
const RewardStore = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [items,        setItems]        = useState([]);
  const [claims,       setClaims]       = useState([]);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState('store'); // 'store' | 'my-claims'

  // ── Claim modal state ──────────────────────────────────────────────────────
  const [claimModal,   setClaimModal]   = useState(null);  // null | rewardItem object
  const [addr,         setAddr]         = useState(EMPTY_ADDR);
  const [addrError,    setAddrError]    = useState('');
  const [claiming,     setClaiming]     = useState(false);
  const [claimMsg,     setClaimMsg]     = useState({ id: null, type: '', text: '' });

  // ── Cancel state ──────────────────────────────────────────────────────────
  const [cancellingId, setCancellingId] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [itemsRes, claimsRes, meRes] = await Promise.all([
        api.get('/rewards'),
        api.get('/rewards/my-claims'),
        api.get('/auth/me')
      ]);
      setItems(itemsRes.data.data   || []);
      setClaims(claimsRes.data.data || []);
      setRewardPoints(meRes.data?.data?.rewardPoints || 0);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    loadAll();
  }, [user, authLoading, navigate]); // eslint-disable-line

  // Auto-refresh every 30 s + on tab focus (picks up admin stock/item changes)
  useAutoRefresh(loadAll, 30_000);

  // ── Open claim modal ──────────────────────────────────────────────────────
  const openClaimModal = (item) => {
    setClaimModal(item);
    setAddr(EMPTY_ADDR);
    setAddrError('');
  };

  // ── Submit claim ──────────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (!addr.name.trim() || !addr.phone.trim() || !addr.street.trim() || !addr.city.trim()) {
      setAddrError('Please fill in all required fields (Name, Phone, Street, City).');
      return;
    }
    setClaiming(true);
    setAddrError('');
    try {
      const res = await api.post(`/rewards/${claimModal._id}/claim`, {
        shippingAddress: addr
      });
      setRewardPoints(res.data.data.newPointsBalance);
      setClaimMsg({ id: claimModal._id, type: 'success', text: res.data.message });
      setClaimModal(null);
      // Refresh claims list
      const cr = await api.get('/rewards/my-claims');
      setClaims(cr.data.data || []);
    } catch (err) {
      setAddrError(err.response?.data?.message || 'Claim failed. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  // ── Cancel a claim ────────────────────────────────────────────────────────
  const handleCancelClaim = async (claimId) => {
    if (!window.confirm('Cancel this reward claim? Your points will be restored.')) return;
    setCancellingId(claimId);
    try {
      const res = await api.put(`/rewards/claims/${claimId}/cancel`);
      setRewardPoints(res.data.data.newPointsBalance);
      const cr = await api.get('/rewards/my-claims');
      setClaims(cr.data.data || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel claim.');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) return <div className="rs-page container">Loading Reward Store…</div>;

  return (
    <div className="rs-page container">
      <h2 className="rs-title"><Gift size={22} className="rs-title-icon"/> Reward Store</h2>

      {/* ── Points Banner ── */}
      <div className="rs-points-banner">
        <Star size={20} className="rs-banner-star"/>
        <div>
          <p className="rs-banner-balance">{rewardPoints} Points Available</p>
          <p className="rs-banner-hint">Earn 1 pt per Rs. 100 spent · Redeem points for free rewards below</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="rs-tabs">
        <button className={`rs-tab${tab === 'store' ? ' rs-tab--active' : ''}`} onClick={() => setTab('store')}>
          <Gift size={15}/> Rewards ({items.length})
        </button>
        <button className={`rs-tab${tab === 'my-claims' ? ' rs-tab--active' : ''}`} onClick={() => setTab('my-claims')}>
          <Truck size={15}/> My Claims ({claims.length})
        </button>
      </div>

      {/* ══════════════ STORE TAB ══════════════ */}
      {tab === 'store' && (
        <>
          {items.length === 0 ? (
            <div className="rs-empty">
              <ShoppingBag size={44}/>
              <p>No reward items available yet. Keep shopping to earn points!</p>
            </div>
          ) : (
            <div className="rs-grid">
              {items.map(item => {
                const canClaim = rewardPoints >= item.pointsRequired;
                const outStock = item.stock !== -1 && item.stock <= 0;
                const msg      = claimMsg.id === item._id ? claimMsg : null;

                return (
                  <div key={item._id} className={`rs-card${!canClaim ? ' rs-card--locked' : ''}`}>
                    <div className="rs-card-img">
                      {item.image
                        ? <img src={getImageUrl(item.image)} alt={item.name}/>
                        : <div className="rs-img-placeholder"><Gift size={30}/></div>
                      }
                      {outStock && <div className="rs-out-of-stock">Out of Stock</div>}
                      {!canClaim && !outStock && (
                        <div className="rs-locked-overlay">
                          <Star size={18}/>
                          <span>Need {item.pointsRequired - rewardPoints} more pts</span>
                        </div>
                      )}
                    </div>

                    <div className="rs-card-body">
                      <h3 className="rs-card-name">{item.name}</h3>
                      {item.description && <p className="rs-card-desc">{item.description}</p>}
                      <div className="rs-card-pts">
                        <Star size={14} className="rs-pts-star"/>
                        <strong>{item.pointsRequired}</strong> points required
                      </div>
                      {item.stock !== -1 && (
                        <p className="rs-card-stock">{item.stock} left in stock</p>
                      )}
                    </div>

                    {msg && (
                      <p className={`rs-claim-msg${msg.type === 'success' ? ' rs-claim-msg--ok' : ' rs-claim-msg--err'}`}>
                        {msg.text}
                      </p>
                    )}

                    <button
                      className={`rs-btn-claim${canClaim && !outStock ? '' : ' rs-btn-claim--disabled'}`}
                      onClick={() => canClaim && !outStock && openClaimModal(item)}
                      disabled={!canClaim || outStock}
                    >
                      {outStock
                        ? 'Out of Stock'
                        : canClaim
                          ? `Claim for ${item.pointsRequired} pts`
                          : `Need ${item.pointsRequired} pts`
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════ MY CLAIMS TAB ══════════════ */}
      {tab === 'my-claims' && (
        <>
          {claims.length === 0 ? (
            <div className="rs-empty">
              <Truck size={44}/>
              <p>You haven't claimed any rewards yet.</p>
            </div>
          ) : (
            <div className="rs-claims-list">
              {claims.map(c => {
                const dc        = DELIVERY_CONFIG[c.deliveryStatus] || DELIVERY_CONFIG.placed;
                const canCancel = ['placed', 'processing'].includes(c.deliveryStatus);

                return (
                  <div key={c._id} className="rs-claim-card">
                    {/* ── Image ── */}
                    <div className="rs-claim-img">
                      {c.rewardItem?.image
                        ? <img src={getImageUrl(c.rewardItem.image)} alt={c.rewardItem?.name}/>
                        : <div className="rs-img-placeholder sm"><Gift size={18}/></div>
                      }
                    </div>

                    {/* ── Info ── */}
                    <div className="rs-claim-info">
                      <p className="rs-claim-name">{c.rewardItem?.name || 'Item removed'}</p>
                      <p className="rs-claim-date">
                        Claimed {new Date(c.createdAt).toLocaleDateString('en-NP', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="rs-claim-pts">
                        <Star size={12} className="rs-pts-star"/> {c.pointsSpent} pts spent
                      </p>

                      {/* Delivery address summary */}
                      {c.shippingAddress?.street && (
                        <p className="rs-claim-addr">
                          <MapPin size={11}/> {c.shippingAddress.street}, {c.shippingAddress.city}
                        </p>
                      )}

                      {/* Tracking number */}
                      {c.trackingNumber && (
                        <p className="rs-claim-tracking">
                          <Truck size={11}/> Tracking: <strong>{c.trackingNumber}</strong>
                        </p>
                      )}

                      {/* Admin note */}
                      {c.adminNote && (
                        <p className="rs-claim-note">Note: {c.adminNote}</p>
                      )}

                      {/* Cancellation reason */}
                      {c.deliveryStatus === 'cancelled' && c.cancelReason && (
                        <p className="rs-claim-cancel-reason">Reason: {c.cancelReason}</p>
                      )}

                      {/* Delivery stepper */}
                      <DeliveryStepper status={c.deliveryStatus}/>
                    </div>

                    {/* ── Right side: badge + cancel ── */}
                    <div className="rs-claim-right">
                      <span className={`rs-status-badge ${dc.cls}`}>
                        {dc.icon} {dc.label}
                      </span>

                      {canCancel && (
                        <button
                          className="rs-btn-cancel-claim"
                          onClick={() => handleCancelClaim(c._id)}
                          disabled={cancellingId === c._id}
                        >
                          {cancellingId === c._id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════ CLAIM MODAL (shipping address) ══════════════ */}
      {claimModal && (
        <div className="rs-modal-overlay" onClick={() => setClaimModal(null)}>
          <div className="rs-modal" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="rs-modal-header">
              <div className="rs-modal-title">
                <Gift size={18} className="rs-modal-icon"/>
                <div>
                  <h3>Claim Reward</h3>
                  <p className="rs-modal-subtitle">{claimModal.name}</p>
                </div>
              </div>
              <button className="rs-modal-close" onClick={() => setClaimModal(null)}>
                <X size={18}/>
              </button>
            </div>

            <p className="rs-modal-desc">Enter your delivery address. Your reward will be shipped to this address.</p>

            {addrError && <p className="rs-modal-error">{addrError}</p>}

            {/* Address form */}
            <div className="rs-addr-form">
              <div className="rs-addr-row">
                <div className="rs-addr-group">
                  <label>Full Name <span className="rs-req">*</span></label>
                  <input
                    value={addr.name}
                    onChange={e => setAddr(a => ({ ...a, name: e.target.value }))}
                    placeholder="e.g. Ram Bahadur"
                  />
                </div>
                <div className="rs-addr-group">
                  <label>Phone Number <span className="rs-req">*</span></label>
                  <input
                    value={addr.phone}
                    onChange={e => setAddr(a => ({ ...a, phone: e.target.value }))}
                    placeholder="e.g. 98XXXXXXXX"
                  />
                </div>
              </div>

              <div className="rs-addr-group">
                <label>Street Address <span className="rs-req">*</span></label>
                <input
                  value={addr.street}
                  onChange={e => setAddr(a => ({ ...a, street: e.target.value }))}
                  placeholder="e.g. Thamel, Ward 26"
                />
              </div>

              <div className="rs-addr-group">
                <label>City <span className="rs-req">*</span></label>
                <input
                  value={addr.city}
                  onChange={e => setAddr(a => ({ ...a, city: e.target.value }))}
                  placeholder="e.g. Kathmandu"
                />
              </div>
            </div>

            {/* Points summary */}
            <div className="rs-modal-summary">
              <div className="rs-modal-summary-row">
                <span>Points required</span>
                <strong className="rs-modal-pts">{claimModal.pointsRequired} pts</strong>
              </div>
              <div className="rs-modal-summary-row">
                <span>Your balance after claim</span>
                <strong>{rewardPoints - claimModal.pointsRequired} pts</strong>
              </div>
            </div>

            {/* Actions */}
            <div className="rs-modal-actions">
              <button className="rs-modal-btn-cancel" onClick={() => setClaimModal(null)}>
                Cancel
              </button>
              <button className="rs-modal-btn-confirm" onClick={handleClaim} disabled={claiming}>
                {claiming
                  ? 'Placing…'
                  : <><Gift size={15}/> Claim Now — {claimModal.pointsRequired} pts</>
                }
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default RewardStore;
