import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFestival } from '../context/FestivalContext';
import { festivalAPI, productAPI } from '../utils/api';
import { Plus, Edit, Trash2, X, Tag, ToggleLeft, ToggleRight, Search } from 'lucide-react';
import './AdminFestival.css';

const FESTIVALS = ['Dashain', 'Tihar', 'Chatt', 'Eid', 'Christmas', 'Custom'];
const THEMES    = ['gold', 'red', 'green', 'purple', 'blue', 'orange'];
const EMOJIS    = { Dashain:'🎑', Tihar:'🪔', Chatt:'🌅', Eid:'☪️', Christmas:'🎄', Custom:'🎉' };
const FESTIVAL_COLORS = {
  Dashain:   '#b91c1c',
  Tihar:     '#d97706',
  Chatt:     '#ea580c',
  Eid:       '#047857',
  Christmas: '#15803d',
  Custom:    '#4338ca',
};

const getImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
  return `${base}${path}`;
};

const emptyForm = {
  festivalName: 'Dashain',
  customFestivalName: '',
  title: '',
  subtitle: '',
  discountText: '',
  discountPercent: '',
  colorTheme: 'gold',
  isActive: false,
  startDate: '',
  endDate: '',
};

const AdminFestival = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const { fetchActiveFestival } = useFestival();
  const navigate = useNavigate();

  const [banners, setBanners]         = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [formData, setFormData]       = useState(emptyForm);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  // Product search for adding to festival
  const [activeBannerId, setActiveBannerId]   = useState(null);
  const [productSearch, setProductSearch]     = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedBannerForProducts, setSelectedBannerForProducts] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin()) { navigate('/'); return; }
    fetchBanners();
    fetchAllProducts();
  }, [isAdmin, authLoading, navigate]);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await festivalAPI.getAll();
      setBanners(res.data.data);
    } catch {
      setError('Failed to load festival banners');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProducts = async () => {
    try {
      const res = await productAPI.getAll({});
      setAllProducts(res.data.data);
    } catch {}
  };

  const openCreate = () => {
    setEditingBanner(null);
    setFormData(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEdit = (banner) => {
    setEditingBanner(banner);
    setFormData({
      festivalName: banner.festivalName,
      customFestivalName: banner.customFestivalName || '',
      title: banner.title,
      subtitle: banner.subtitle,
      discountText: banner.discountText,
      discountPercent: banner.discountPercent || '',
      colorTheme: banner.colorTheme,
      isActive: banner.isActive,
      startDate: banner.startDate ? banner.startDate.slice(0, 10) : '',
      endDate: banner.endDate ? banner.endDate.slice(0, 10) : '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingBanner) {
        await festivalAPI.update(editingBanner._id, formData);
        setSuccess('Banner updated!');
      } else {
        await festivalAPI.create(formData);
        setSuccess('Banner created!');
      }
      setShowModal(false);
      fetchBanners();
      fetchActiveFestival(); // sync context so discounts update immediately
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this festival banner?')) return;
    try {
      await festivalAPI.delete(id);
      setBanners(prev => prev.filter(b => b._id !== id));
      fetchActiveFestival(); // sync context — deleted banner must lose its discount
      setSuccess('Banner deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Delete failed');
    }
  };

  const toggleActive = async (banner) => {
    try {
      await festivalAPI.update(banner._id, { isActive: !banner.isActive });
      fetchBanners();
      fetchActiveFestival(); // immediately remove/apply discount across the site
    } catch {
      setError('Failed to toggle status');
    }
  };

  // ── Product management ────────────────────────────────────────
  const openProductModal = (banner) => {
    setSelectedBannerForProducts(banner);
    setProductSearch('');
    setShowProductModal(true);
  };

  const addProductToFestival = async (productId) => {
    try {
      await festivalAPI.addProduct(selectedBannerForProducts._id, productId);
      fetchBanners();
      // Refresh the selected banner
      const res = await festivalAPI.getAll();
      const updated = res.data.data.find(b => b._id === selectedBannerForProducts._id);
      setSelectedBannerForProducts(updated);
      setBanners(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add product');
    }
  };

  const removeProductFromFestival = async (bannerId, productId) => {
    try {
      await festivalAPI.removeProduct(bannerId, productId);
      fetchBanners();
      if (selectedBannerForProducts) {
        const res = await festivalAPI.getAll();
        const updated = res.data.data.find(b => b._id === bannerId);
        setSelectedBannerForProducts(updated);
        setBanners(res.data.data);
      }
    } catch {
      setError('Failed to remove product');
    }
  };

  const filteredProducts = allProducts.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.category?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const isInFestival = (productId) =>
    selectedBannerForProducts?.products?.some(p =>
      (p._id || p) === productId || (p._id || p).toString() === productId.toString()
    );

  if (authLoading || loading) return (
    <div className="admin-festival__loading">
      <div className="spinner"></div><p>Loading...</p>
    </div>
  );

  return (
    <div className="admin-festival">
      {/* ── Header ─────────────────────────────────── */}
      <div className="admin-festival__header">
        <div>
          <h1>🎉 Festival Banners</h1>
          <p>Create and manage festival sale banners</p>
        </div>
        <div className="admin-festival__header-actions">
          <Link to="/admin" className="btn btn-secondary">← Admin Panel</Link>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> New Festival
          </button>
        </div>
      </div>

      {/* ── Alerts ─────────────────────────────────── */}
      {error   && <div className="alert alert-error">{error}<button onClick={() => setError('')}>✕</button></div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ── Banner Cards ────────────────────────────── */}
      {banners.length === 0 ? (
        <div className="admin-festival__empty">
          <div style={{ fontSize:'4rem' }}>🎑</div>
          <h3>No Festival Banners Yet</h3>
          <p>Create your first festival banner to start the sale!</p>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Create Banner
          </button>
        </div>
      ) : (
        <div className="admin-festival__grid">
          {banners.map(banner => {
            const emoji = EMOJIS[banner.festivalName] || '🎉';
            const name  = banner.festivalName === 'Custom'
              ? banner.customFestivalName || 'Custom'
              : banner.festivalName;
            return (
              <div key={banner._id}
                className={`festival-card ${banner.isActive ? 'festival-card--active' : ''}`}
                style={{ borderTop: `4px solid ${FESTIVAL_COLORS[banner.festivalName] || '#4338ca'}` }}>
                {banner.isActive && <span className="festival-card__live">● LIVE</span>}

                <div className="festival-card__top">
                  <span className="festival-card__emoji">{emoji}</span>
                  <div>
                    <p className="festival-card__festival-name">{name}</p>
                    <h3 className="festival-card__title">{banner.title}</h3>
                    <p className="festival-card__discount">{banner.discountText}</p>
                  </div>
                </div>

                <p className="festival-card__subtitle">{banner.subtitle}</p>

                <div className="festival-card__meta">
                  <span className={`theme-dot theme-dot--${banner.colorTheme}`} />
                  <span>{banner.colorTheme}</span>
                  <span>·</span>
                  <span>{banner.products?.length || 0} products</span>
                </div>

                <div className="festival-card__actions">
                  <button
                    className={`btn btn-sm ${banner.isActive ? 'btn-warning' : 'btn-success'}`}
                    onClick={() => toggleActive(banner)}
                    title={banner.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {banner.isActive
                      ? <><ToggleRight size={14} /> Active</>
                      : <><ToggleLeft size={14} /> Inactive</>}
                  </button>

                  <button className="btn btn-sm btn-secondary" onClick={() => openProductModal(banner)}>
                    <Tag size={14} /> Products ({banner.products?.length || 0})
                  </button>

                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(banner)}>
                    <Edit size={14} /> Edit
                  </button>

                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(banner._id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          Create / Edit Modal
      ══════════════════════════════════════════════ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal festival-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBanner ? 'Edit Festival Banner' : 'Create Festival Banner'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSave} className="festival-form">
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label>Festival *</label>
                  <select value={formData.festivalName}
                    onChange={e => setFormData(p => ({ ...p, festivalName: e.target.value }))} required>
                    {FESTIVALS.map(f => (
                      <option key={f} value={f}>{EMOJIS[f]} {f}</option>
                    ))}
                  </select>
                </div>

                {formData.festivalName === 'Custom' && (
                  <div className="form-group">
                    <label>Custom Festival Name *</label>
                    <input type="text" value={formData.customFestivalName}
                      onChange={e => setFormData(p => ({ ...p, customFestivalName: e.target.value }))}
                      placeholder="e.g. New Year" required />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Banner Title *</label>
                <input type="text" value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Dashain Mega Sale!" required />
              </div>

              <div className="form-group">
                <label>Subtitle</label>
                <input type="text" value={formData.subtitle}
                  onChange={e => setFormData(p => ({ ...p, subtitle: e.target.value }))}
                  placeholder="e.g. Shop the best deals this festive season" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Discount Text * <span style={{fontWeight:400,color:'#888'}}>(shown on banner)</span></label>
                  <input type="text" value={formData.discountText}
                    onChange={e => setFormData(p => ({ ...p, discountText: e.target.value }))}
                    placeholder="e.g. Up to 50% Off" required />
                </div>
                <div className="form-group">
                  <label>Discount % Applied to Products *</label>
                  <input type="number" value={formData.discountPercent}
                    onChange={e => setFormData(p => ({ ...p, discountPercent: e.target.value }))}
                    placeholder="e.g. 20" min="0" max="100" required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label>Colour Theme</label>
                  <select value={formData.colorTheme}
                    onChange={e => setFormData(p => ({ ...p, colorTheme: e.target.value }))}>
                    {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={formData.startDate}
                    onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" value={formData.endDate}
                    onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))} />
                </div>
              </div>

              <div className="form-group form-group--checkbox">
                <label>
                  <input type="checkbox" checked={formData.isActive}
                    onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))} />
                  Set as Active (shows banner on site — deactivates all others)
                </label>
              </div>

              {/* Live Preview */}
              <div className={`festival-preview festival-preview--${formData.colorTheme}`}>
                <span style={{ fontSize:'1.4rem' }}>{EMOJIS[formData.festivalName] || '🎉'}</span>
                <div>
                  <p style={{ margin:0, fontSize:'0.7rem', fontWeight:700, letterSpacing:2, textTransform:'uppercase', opacity:0.8 }}>
                    {formData.festivalName === 'Custom' ? formData.customFestivalName : formData.festivalName} Sale
                  </p>
                  <p style={{ margin:0, fontWeight:800, fontSize:'1rem' }}>{formData.title || 'Banner Title'}</p>
                  <p style={{ margin:0, fontSize:'0.78rem', opacity:0.85 }}>{formData.discountText || 'Discount Text'}</p>
                </div>
                <span style={{ fontSize:'1.4rem' }}>{EMOJIS[formData.festivalName] || '🎉'}</span>
              </div>

            </form>

            {/* Sticky footer buttons — always visible outside the scroll area */}
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Saving...' : (editingBanner ? 'Save Changes' : 'Create Banner')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          Products Modal
      ══════════════════════════════════════════════ */}
      {showProductModal && selectedBannerForProducts && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal festival-products-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {EMOJIS[selectedBannerForProducts.festivalName]} Manage Products —{' '}
                {selectedBannerForProducts.festivalName === 'Custom'
                  ? selectedBannerForProducts.customFestivalName
                  : selectedBannerForProducts.festivalName}
              </h2>
              <button className="modal-close" onClick={() => setShowProductModal(false)}><X size={20} /></button>
            </div>

            {/* Search */}
            <div className="festival-product-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search products to add..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
            </div>

            {/* Products in festival */}
            {selectedBannerForProducts.products?.length > 0 && (
              <div className="festival-product-section">
                <h4>In this Festival ({selectedBannerForProducts.products.length})</h4>
                <div className="festival-product-list">
                  {selectedBannerForProducts.products.map(p => (
                    <div key={p._id || p} className="festival-product-row festival-product-row--added">
                      <img src={p.images?.[0] ? getImageUrl(p.images[0]) : '/placeholder.png'} alt={p.name} />
                      <div className="festival-product-info">
                        <p>{p.name}</p>
                        <span>Rs. {p.price?.toLocaleString()}</span>
                      </div>
                      <button className="btn btn-sm btn-danger"
                        onClick={() => removeProductFromFestival(selectedBannerForProducts._id, p._id || p)}>
                        <X size={14} /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All products */}
            <div className="festival-product-section">
              <h4>All Products</h4>
              <div className="festival-product-list">
                {filteredProducts.map(p => {
                  const added = isInFestival(p._id);
                  return (
                    <div key={p._id} className={`festival-product-row ${added ? 'festival-product-row--added' : ''}`}>
                      <img src={p.images?.[0] ? getImageUrl(p.images[0]) : '/placeholder.png'} alt={p.name} />
                      <div className="festival-product-info">
                        <p>{p.name}</p>
                        <span>Rs. {p.price?.toLocaleString()} · {p.category}</span>
                      </div>
                      <button
                        className={`btn btn-sm ${added ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => !added && addProductToFestival(p._id)}
                        disabled={added}
                      >
                        {added ? '✓ Added' : <><Plus size={14} /> Add</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFestival;
