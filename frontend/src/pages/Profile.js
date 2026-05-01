import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI, orderAPI } from '../utils/api';
import {
  User, Mail, Phone, MapPin, Lock, Star, Package,
  Camera, Trash2, LogOut, CheckCircle, AlertCircle,
  Eye, EyeOff, Edit3, Save, X
} from 'lucide-react';
import './Profile.css';

const API_BASE = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

const Profile = () => {
  const { user, logout, updateUser, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // ── local state ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState(null);
  const [orderCount, setOrderCount] = useState(0);

  // editing flags
  const [editingInfo, setEditingInfo]       = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);

  // form fields
  const [infoForm, setInfoForm] = useState({ name: '', phone: '' });
  const [addrForm, setAddrForm] = useState({ street: '', city: '', state: '', zipCode: '', country: 'Nepal' });

  // password change
  const [pwForm, setPwForm]   = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw]   = useState({ current: false, newPw: false, confirm: false });
  const [pwMsg, setPwMsg]     = useState({ type: '', text: '' }); // inline feedback for password card

  // delete account
  const [deleteForm, setDeleteForm]   = useState({ password: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // feedback
  const [msg, setMsg]   = useState({ type: '', text: '' });
  const [loading, setLoading] = useState({ info: false, addr: false, pw: false, avatar: false, delete: false });

  // ── load profile on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;          // wait for AuthContext to finish checking token
    if (!user) { navigate('/login'); return; }
    fetchProfile();
    if (!isAdmin()) fetchOrderCount();
  }, [authLoading, user]); // eslint-disable-line

  const fetchProfile = async () => {
    try {
      const res = await authAPI.getMe();
      const data = res.data.data;
      setProfile(data);
      setInfoForm({ name: data.name || '', phone: data.phone || '' });
      setAddrForm({
        street:  data.address?.street  || '',
        city:    data.address?.city    || '',
        state:   data.address?.state   || '',
        zipCode: data.address?.zipCode || '',
        country: data.address?.country || 'Nepal',
      });
    } catch {
      showMsg('error', 'Failed to load profile');
    }
  };

  const fetchOrderCount = async () => {
    try {
      const res = await orderAPI.getMyOrders();
      setOrderCount(res.data?.data?.length || 0);
    } catch {
      setOrderCount(0);
    }
  };

  // ── helpers ──────────────────────────────────────────────────────────────
  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

  const setLoad = (key, val) => setLoading(prev => ({ ...prev, [key]: val }));

  // ── save personal info ───────────────────────────────────────────────────
  const handleSaveInfo = async (e) => {
    e.preventDefault();
    if (!infoForm.name.trim()) return showMsg('error', 'Name is required');
    setLoad('info', true);
    try {
      const res = await authAPI.updateProfile({ name: infoForm.name, phone: infoForm.phone });
      setProfile(prev => ({ ...prev, ...res.data.data }));
      updateUser({ name: res.data.data.name, phone: res.data.data.phone });
      setEditingInfo(false);
      showMsg('success', 'Personal info updated!');
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Update failed');
    } finally {
      setLoad('info', false);
    }
  };

  // ── save address ─────────────────────────────────────────────────────────
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setLoad('addr', true);
    try {
      const res = await authAPI.updateProfile({ address: addrForm });
      setProfile(prev => ({ ...prev, address: res.data.data.address }));
      setEditingAddress(false);
      showMsg('success', 'Address updated!');
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Update failed');
    } finally {
      setLoad('addr', false);
    }
  };

  // ── change password ──────────────────────────────────────────────────────
  const showPwMsg = (type, text) => {
    setPwMsg({ type, text });
    if (type === 'success') setTimeout(() => setPwMsg({ type: '', text: '' }), 4000);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwForm.currentPassword)
      return showPwMsg('error', 'Please enter your current password');
    if (pwForm.newPassword !== pwForm.confirmPassword)
      return showPwMsg('error', 'New passwords do not match');
    if (pwForm.newPassword.length < 6)
      return showPwMsg('error', 'New password must be at least 6 characters');
    setPwMsg({ type: '', text: '' });
    setLoad('pw', true);
    try {
      await authAPI.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showPwMsg('success', 'Password changed successfully!');
    } catch (err) {
      showPwMsg('error', err.response?.data?.message || 'Password change failed');
    } finally {
      setLoad('pw', false);
    }
  };

  // ── avatar upload ────────────────────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    setLoad('avatar', true);
    try {
      const res = await authAPI.uploadAvatar(formData);
      setProfile(prev => ({ ...prev, avatar: res.data.data.avatar }));
      updateUser({ avatar: res.data.data.avatar });
      showMsg('success', 'Avatar updated!');
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Upload failed');
    } finally {
      setLoad('avatar', false);
      e.target.value = '';
    }
  };

  // ── logout ───────────────────────────────────────────────────────────────
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // ── delete account ───────────────────────────────────────────────────────
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setLoad('delete', true);
    try {
      await authAPI.deleteAccount({ password: deleteForm.password });
      logout();
      navigate('/');
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Deletion failed');
    } finally {
      setLoad('delete', false);
    }
  };

  if (!profile) {
    return <div className="profile-loading"><div className="profile-spinner" /></div>;
  }

  const avatarSrc = profile.avatar
    ? `${API_BASE}${profile.avatar}`
    : null;

  return (
    <div className="profile-page">
      <div className="profile-container">

        {/* ── Global feedback banner ── */}
        {msg.text && (
          <div className={`profile-banner profile-banner--${msg.type}`}>
            {msg.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span>{msg.text}</span>
          </div>
        )}

        {/* ── HERO: avatar + name + role ── */}
        <div className="profile-hero">
          <div className="avatar-wrapper">
            {avatarSrc
              ? <img src={avatarSrc} alt="avatar" className="avatar-img" />
              : <div className="avatar-placeholder"><User size={48} /></div>
            }
            <button
              className="avatar-edit-btn"
              onClick={() => fileInputRef.current.click()}
              disabled={loading.avatar}
              title="Change photo"
            >
              {loading.avatar ? <div className="btn-spinner" /> : <Camera size={16} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
          </div>
          <div className="hero-info">
            <h1 className="hero-name">{profile.name}</h1>
            <span className={`role-badge role-badge--${profile.role}`}>{profile.role}</span>
            <p className="hero-email"><Mail size={14} /> {profile.email}</p>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} /> Logout
          </button>
        </div>

        {/* ── STATS ROW (users only) ── */}
        {!isAdmin() && (
          <div className="stats-row">
            <div className="stat-card stat-card--gold">
              <Star size={22} />
              <div>
                <span className="stat-value">{profile.rewardPoints || 0}</span>
                <span className="stat-label">Reward Points</span>
              </div>
            </div>
            <Link to="/orders" className="stat-card stat-card--blue">
              <Package size={22} />
              <div>
                <span className="stat-value">{orderCount}</span>
                <span className="stat-label">Total Orders</span>
              </div>
            </Link>
            <Link to="/rewards" className="stat-card stat-card--purple">
              <Star size={22} />
              <div>
                <span className="stat-value">Redeem</span>
                <span className="stat-label">Reward Store</span>
              </div>
            </Link>
          </div>
        )}

        <div className="profile-grid">

          {/* ── PERSONAL INFO ── */}
          <div className="profile-card">
            <div className="card-header">
              <h2><User size={18} /> Personal Info</h2>
              {!editingInfo && (
                <button className="icon-btn" onClick={() => setEditingInfo(true)}>
                  <Edit3 size={16} /> Edit
                </button>
              )}
            </div>

            {editingInfo ? (
              <form onSubmit={handleSaveInfo} className="profile-form">
                <label>Full Name</label>
                <input
                  type="text"
                  value={infoForm.name}
                  onChange={e => setInfoForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Your name"
                  required
                />
                <label>Phone</label>
                <input
                  type="text"
                  value={infoForm.phone}
                  onChange={e => setInfoForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="e.g. 9800000000"
                />
                <label>Email <span className="field-note">(cannot be changed)</span></label>
                <input type="email" value={profile.email} disabled />

                <div className="form-actions">
                  <button type="submit" className="btn-save" disabled={loading.info}>
                    {loading.info ? <div className="btn-spinner" /> : <><Save size={15} /> Save</>}
                  </button>
                  <button type="button" className="btn-cancel" onClick={() => setEditingInfo(false)}>
                    <X size={15} /> Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="info-list">
                <div className="info-row"><User size={15} /><span>{profile.name}</span></div>
                <div className="info-row"><Mail size={15} /><span>{profile.email}</span></div>
                <div className="info-row">
                  <Phone size={15} />
                  <span>{profile.phone || <em className="empty-hint">No phone added</em>}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── ADDRESS ── */}
          <div className="profile-card">
            <div className="card-header">
              <h2><MapPin size={18} /> Address</h2>
              {!editingAddress && (
                <button className="icon-btn" onClick={() => setEditingAddress(true)}>
                  <Edit3 size={16} /> Edit
                </button>
              )}
            </div>

            {editingAddress ? (
              <form onSubmit={handleSaveAddress} className="profile-form">
                <label>Street</label>
                <input type="text" value={addrForm.street}
                  onChange={e => setAddrForm(p => ({ ...p, street: e.target.value }))}
                  placeholder="Street / Tole" />
                <label>City</label>
                <input type="text" value={addrForm.city}
                  onChange={e => setAddrForm(p => ({ ...p, city: e.target.value }))}
                  placeholder="City" />
                <label>State / Province</label>
                <input type="text" value={addrForm.state}
                  onChange={e => setAddrForm(p => ({ ...p, state: e.target.value }))}
                  placeholder="Province No. / State" />
                <label>ZIP / Postal Code</label>
                <input type="text" value={addrForm.zipCode}
                  onChange={e => setAddrForm(p => ({ ...p, zipCode: e.target.value }))}
                  placeholder="44600" />
                <label>Country</label>
                <input type="text" value={addrForm.country}
                  onChange={e => setAddrForm(p => ({ ...p, country: e.target.value }))}
                  placeholder="Nepal" />

                <div className="form-actions">
                  <button type="submit" className="btn-save" disabled={loading.addr}>
                    {loading.addr ? <div className="btn-spinner" /> : <><Save size={15} /> Save</>}
                  </button>
                  <button type="button" className="btn-cancel" onClick={() => setEditingAddress(false)}>
                    <X size={15} /> Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="info-list">
                {profile.address?.street || profile.address?.city ? (
                  <>
                    {profile.address.street  && <div className="info-row"><MapPin size={15}/><span>{profile.address.street}</span></div>}
                    {profile.address.city    && <div className="info-row"><MapPin size={15}/><span>{profile.address.city}{profile.address.state ? `, ${profile.address.state}` : ''}</span></div>}
                    {profile.address.zipCode && <div className="info-row"><MapPin size={15}/><span>{profile.address.zipCode}</span></div>}
                    {profile.address.country && <div className="info-row"><MapPin size={15}/><span>{profile.address.country}</span></div>}
                  </>
                ) : (
                  <p className="empty-hint">No address saved yet. Click Edit to add one.</p>
                )}
              </div>
            )}
          </div>

          {/* ── CHANGE PASSWORD ── */}
          <div className="profile-card">
            <div className="card-header">
              <h2><Lock size={18} /> Change Password</h2>
            </div>
            <form onSubmit={handleChangePassword} className="profile-form">
              <label>Current Password</label>
              <div className="pw-field">
                <input
                  type={showPw.current ? 'text' : 'password'}
                  value={pwForm.currentPassword}
                  onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))}
                  placeholder="Enter current password"
                  required
                />
                <button type="button" onClick={() => setShowPw(p => ({ ...p, current: !p.current }))}>
                  {showPw.current ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <label>New Password</label>
              <div className="pw-field">
                <input
                  type={showPw.newPw ? 'text' : 'password'}
                  value={pwForm.newPassword}
                  onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                  placeholder="Min 6 characters"
                  required
                />
                <button type="button" onClick={() => setShowPw(p => ({ ...p, newPw: !p.newPw }))}>
                  {showPw.newPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <label>Confirm New Password</label>
              <div className="pw-field">
                <input
                  type={showPw.confirm ? 'text' : 'password'}
                  value={pwForm.confirmPassword}
                  onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Repeat new password"
                  required
                />
                <button type="button" onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}>
                  {showPw.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* ── inline feedback – always visible without scrolling ── */}
              {pwMsg.text && (
                <div className={`pw-inline-msg pw-inline-msg--${pwMsg.type}`}>
                  {pwMsg.type === 'success'
                    ? <CheckCircle size={16} />
                    : <AlertCircle size={16} />}
                  <span>{pwMsg.text}</span>
                </div>
              )}

              <button type="submit" className="btn-save" disabled={loading.pw} style={{ marginTop: '6px' }}>
                {loading.pw ? <div className="btn-spinner" /> : <><Lock size={15} /> Update Password</>}
              </button>
            </form>
          </div>

          {/* ── DANGER ZONE (users only — admin account cannot be deleted) ── */}
          {!isAdmin() && (
            <div className="profile-card profile-card--danger">
              <div className="card-header">
                <h2><Trash2 size={18} /> Danger Zone</h2>
              </div>
              <p className="danger-desc">
                Permanently delete your account. This cannot be undone — all your orders, reward points, and data will be removed.
              </p>

              {!showDeleteConfirm ? (
                <button className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={16} /> Delete My Account
                </button>
              ) : (
                <form onSubmit={handleDeleteAccount} className="profile-form">
                  <label>Enter your password to confirm</label>
                  <input
                    type="password"
                    value={deleteForm.password}
                    onChange={e => setDeleteForm({ password: e.target.value })}
                    placeholder="Your password"
                    required
                    autoFocus
                  />
                  <div className="form-actions">
                    <button type="submit" className="btn-danger" disabled={loading.delete}>
                      {loading.delete ? <div className="btn-spinner" /> : <><Trash2 size={15} /> Yes, Delete</>}
                    </button>
                    <button type="button" className="btn-cancel" onClick={() => setShowDeleteConfirm(false)}>
                      <X size={15} /> Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Profile;
