import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, ShoppingBag, Clock, X } from 'lucide-react';
import api from '../utils/api';
import './SearchRecommendations.css';

/**
 * SearchRecommendations
 * ─────────────────────
 * Drop-in replacement for the plain search input.
 * Shows a rich dropdown with:
 *  • When empty / focused:  most-searched terms | trending products | most-bought
 *  • When typing (≥2 chars): autocomplete product names + popular past queries
 *
 * Props:
 *  value       {string}   - controlled search value
 *  onChange    {fn(val)}  - called with new string when user types / picks term
 *  placeholder {string}
 */
const SearchRecommendations = ({ value = '', onChange, placeholder = 'Search for furniture...' }) => {
  const navigate = useNavigate();

  const [open,        setOpen]        = useState(false);
  const [trending,    setTrending]    = useState([]);
  const [mostBought,  setMostBought]  = useState([]);
  const [mostSearched,setMostSearched]= useState([]);
  const [autoProducts,setAutoProducts]= useState([]);
  const [autoTerms,   setAutoTerms]   = useState([]);
  const [loadingAuto, setLoadingAuto] = useState(false);

  const inputRef     = useRef(null);
  const containerRef = useRef(null);
  const debounceRef  = useRef(null);

  // ── Load static discovery data once on mount ──────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [trendRes, boughtRes, searchedRes] = await Promise.all([
          api.get('/recommendations/trending?limit=6'),
          api.get('/recommendations/most-bought?limit=6'),
          api.get('/recommendations/most-searched?limit=8'),
        ]);
        setTrending(trendRes.data?.data    || []);
        setMostBought(boughtRes.data?.data || []);
        setMostSearched(searchedRes.data?.data || []);
      } catch (_) { /* silently ignore — recommendations are non-critical */ }
    };
    load();
  }, []);

  // ── Debounced autocomplete when user types ────────────────────────────────
  const fetchAutocomplete = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q || q.trim().length < 2) {
      setAutoProducts([]);
      setAutoTerms([]);
      setLoadingAuto(false);
      return;
    }

    setLoadingAuto(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/recommendations/autocomplete?q=${encodeURIComponent(q)}`);
        setAutoProducts(res.data?.data?.products || []);
        setAutoTerms(res.data?.data?.terms       || []);
      } catch (_) {
        setAutoProducts([]);
        setAutoTerms([]);
      } finally {
        setLoadingAuto(false);
      }
    }, 280);
  }, []);

  useEffect(() => {
    fetchAutocomplete(value);
  }, [value, fetchAutocomplete]);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    onChange(e.target.value);
    setOpen(true);
  };

  const handleTermClick = (term) => {
    onChange(term);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleProductClick = (productId) => {
    setOpen(false);
    navigate(`/product/${productId}`);
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const formatPrice = (product) => {
    const price = product.discount
      ? product.price - (product.price * product.discount) / 100
      : product.price;
    return `Rs. ${Math.round(price).toLocaleString()}`;
  };

  // Are we in autocomplete mode (user has typed ≥2 chars)?
  const isAutocompleteMode = value.trim().length >= 2;
  const hasAutoResults     = autoProducts.length > 0 || autoTerms.length > 0;
  const hasDiscoveryData   = trending.length > 0 || mostBought.length > 0 || mostSearched.length > 0;

  const shouldShowDropdown = open && (
    isAutocompleteMode ? (loadingAuto || hasAutoResults) : hasDiscoveryData
  );

  return (
    <div className="srec-container" ref={containerRef}>
      {/* ── Search Input ──────────────────────────────────────────────────── */}
      <div className="srec-input-wrapper">
        <Search size={18} className="srec-icon-left" />
        <input
          ref={inputRef}
          type="text"
          className="srec-input"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        {value && (
          <button className="srec-clear-btn" onClick={handleClear} title="Clear search">
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      {shouldShowDropdown && (
        <div className="srec-dropdown">

          {/* ── Autocomplete Mode ──────────────────────────────────────── */}
          {isAutocompleteMode && (
            <>
              {loadingAuto && (
                <div className="srec-loading">
                  <div className="srec-spinner" />
                  <span>Searching…</span>
                </div>
              )}

              {!loadingAuto && autoTerms.length > 0 && (
                <div className="srec-section">
                  <div className="srec-section-header">
                    <Clock size={13} />
                    <span>Popular searches</span>
                  </div>
                  <ul className="srec-term-list">
                    {autoTerms.map((t) => (
                      <li
                        key={t.term}
                        className="srec-term-item"
                        onClick={() => handleTermClick(t.term)}
                      >
                        <Search size={12} className="srec-term-icon" />
                        <span>{t.term}</span>
                        <span className="srec-term-count">{t.count} searches</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!loadingAuto && autoProducts.length > 0 && (
                <div className="srec-section">
                  <div className="srec-section-header">
                    <Search size={13} />
                    <span>Products</span>
                  </div>
                  <ul className="srec-product-list">
                    {autoProducts.map((p) => (
                      <li
                        key={p._id}
                        className="srec-product-item"
                        onClick={() => handleProductClick(p._id)}
                      >
                        <img
                          src={p.images?.[0] || ''}
                          alt={p.name}
                          className="srec-product-thumb"
                          onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
                        />
                        <div className="srec-product-info">
                          <span className="srec-product-name">{p.name}</span>
                          <span className="srec-product-meta">{p.category} · {formatPrice(p)}</span>
                        </div>
                        {p.discount > 0 && (
                          <span className="srec-discount-badge">-{p.discount}%</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!loadingAuto && !hasAutoResults && (
                <div className="srec-empty">No suggestions for "{value}"</div>
              )}
            </>
          )}

          {/* ── Discovery Mode (empty input) ───────────────────────────── */}
          {!isAutocompleteMode && (
            <>
              {/* Most searched terms */}
              {mostSearched.length > 0 && (
                <div className="srec-section">
                  <div className="srec-section-header">
                    <Clock size={13} />
                    <span>Most searched</span>
                  </div>
                  <div className="srec-chip-row">
                    {mostSearched.map((t) => (
                      <button
                        key={t.term}
                        className="srec-chip"
                        onClick={() => handleTermClick(t.term)}
                      >
                        {t.term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending products */}
              {trending.length > 0 && (
                <div className="srec-section">
                  <div className="srec-section-header">
                    <TrendingUp size={13} />
                    <span>Trending now</span>
                  </div>
                  <ul className="srec-product-list">
                    {trending.slice(0, 4).map((p) => (
                      <li
                        key={p._id}
                        className="srec-product-item"
                        onClick={() => handleProductClick(p._id)}
                      >
                        <img
                          src={p.images?.[0] || ''}
                          alt={p.name}
                          className="srec-product-thumb"
                          onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
                        />
                        <div className="srec-product-info">
                          <span className="srec-product-name">{p.name}</span>
                          <span className="srec-product-meta">{p.category} · {formatPrice(p)}</span>
                        </div>
                        <TrendingUp size={12} className="srec-trend-icon" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Most bought */}
              {mostBought.length > 0 && (
                <div className="srec-section">
                  <div className="srec-section-header">
                    <ShoppingBag size={13} />
                    <span>Most bought</span>
                  </div>
                  <ul className="srec-product-list">
                    {mostBought.slice(0, 3).map((p) => (
                      <li
                        key={p._id}
                        className="srec-product-item"
                        onClick={() => handleProductClick(p._id)}
                      >
                        <img
                          src={p.images?.[0] || ''}
                          alt={p.name}
                          className="srec-product-thumb"
                          onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
                        />
                        <div className="srec-product-info">
                          <span className="srec-product-name">{p.name}</span>
                          <span className="srec-product-meta">{p.category} · {formatPrice(p)}</span>
                        </div>
                        <span className="srec-bought-badge">
                          {p.purchaseCount} sold
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchRecommendations;
