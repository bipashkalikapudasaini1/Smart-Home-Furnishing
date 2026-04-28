import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { festivalAPI } from '../utils/api';
import ProductCard from '../components/ProductCard';
import './FestivalSale.css';

const FESTIVAL_EMOJIS = {
  Dashain:   '🎑',
  Tihar:     '🪔',
  Chatt:     '🌅',
  Eid:       '🌙',
  Christmas: '🎄',
  Custom:    '🎉',
};

const FestivalSale = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [banner, setBanner] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Fetch this specific festival by ID — gives us discountPercent + all banner info
        const bannerRes = await festivalAPI.getById(id);
        if (bannerRes.data.data) {
          const fetchedBanner = bannerRes.data.data;
          setBanner(fetchedBanner);
          // Only load products if the festival is still active
          if (fetchedBanner.isActive) {
            setProducts(fetchedBanner.products || []);
          } else {
            setProducts([]);
          }
        }
      } catch (err) {
        setError('Failed to load festival sale. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const emoji = banner ? (FESTIVAL_EMOJIS[banner.festivalName] || '🎉') : '🎉';
  const displayName = banner
    ? (banner.festivalName === 'Custom' ? banner.customFestivalName || 'Festival' : banner.festivalName)
    : 'Festival';

  return (
    <div className={`festival-sale festival-sale--${banner?.colorTheme || 'gold'}`}>
      {/* ── Hero Header ─────────────────────────────── */}
      <div className="festival-sale__hero">
        <div className="festival-sale__confetti">
          {[...Array(20)].map((_, i) => (
            <span key={i} className="confetti-piece" style={{ '--i': i }} />
          ))}
        </div>

        <div className="festival-sale__hero-content">
          <div className="festival-sale__emoji-row">
            <span>{emoji}</span>
            <span>{emoji}</span>
            <span>{emoji}</span>
          </div>

          {banner ? (
            <>
              <p className="festival-sale__festival-label">{displayName} Sale</p>
              <h1 className="festival-sale__title">{banner.title}</h1>
              <p className="festival-sale__subtitle">{banner.subtitle}</p>
              <div className="festival-sale__discount-pill">{banner.discountText}</div>
            </>
          ) : (
            <h1 className="festival-sale__title">🎉 Festival Sale</h1>
          )}
        </div>
      </div>

      {/* ── Products Section ────────────────────────── */}
      <div className="festival-sale__products container">
        <div className="festival-sale__products-header">
          <h2>Festival Deals</h2>
          {!loading && <p>{products.length} items on sale</p>}
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading deals...</p>
          </div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : banner && !banner.isActive ? (
          <div className="festival-sale__empty">
            <div className="festival-sale__empty-icon">🏁</div>
            <h3>This Sale Has Ended</h3>
            <p>The {banner.festivalName === 'Custom' ? banner.customFestivalName || 'festival' : banner.festivalName} sale is no longer active. Check back for upcoming deals!</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Browse All Products
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="festival-sale__empty">
            <div className="festival-sale__empty-icon">🛍️</div>
            <h3>No products added yet</h3>
            <p>The admin is busy adding amazing deals — check back soon!</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Browse All Products
            </button>
          </div>
        ) : (
          <div className="products-grid">
            {products.map(product => (
              <ProductCard
                key={product._id}
                product={product}
                festivalDiscount={banner?.isActive ? (Number(banner?.discountPercent) || 0) : 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FestivalSale;
