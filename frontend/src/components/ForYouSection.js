import React, { useState, useEffect, useRef, memo } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Star, ChevronLeft, ChevronRight, ShoppingCart, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import './ForYouSection.css';

/**
 * ForYouSection
 * ─────────────────────────────────────────────────────────────────────────────
 * Personalised product carousel for logged-in (non-admin) users.
 *
 * Blinking root-causes fixed:
 *  1. Single useEffect — no competing reset-effect that was accidentally clearing
 *     the `hasFetched` guard between the two effects in StrictMode.
 *  2. `userId` string dependency (stable primitive) instead of the `user` object
 *     reference, so AuthContext re-renders don't re-trigger the fetch.
 *  3. AbortController cleanly cancels in-flight requests on unmount (StrictMode
 *     double-invocation safe).
 *  4. Initial loading=true prevents the null → skeleton flash.
 *  5. `isMounted` flag guards all state setters after async await so a slow
 *     response arriving after unmount never mutates state.
 *
 * Route bug fixed:
 *  - Uses `/product/:id` (singular) matching App.js, not `/products/:id`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const ForYouSection = memo(() => {
  const { user, isAdmin } = useAuth();

  // Stable primitive — effect only re-runs when the actual user ID changes
  const userId = user?._id?.toString() || null;

  // Start loading=true so the skeleton shows immediately (no null→skeleton flash)
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  // Cart feedback: tracks which productId currently shows "Added!"
  const [addedId,  setAddedId]  = useState(null);

  const scrollRef  = useRef(null);
  // Single ref that tracks whether we have already fetched for this userId.
  // Reset to false only inside the effect cleanup (when userId actually changes).
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Guest or admin — nothing to show; stop loading
    if (!userId || isAdmin()) {
      setLoading(false);
      return;
    }

    // Already fetched for this userId — skip (prevents StrictMode double-fetch
    // and context-driven re-renders from firing a second request)
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let isMounted = true;
    const controller = new AbortController();

    const fetchRecs = async () => {
      try {
        const res = await api.get('/recommendations/for-you?limit=12', {
          signal: controller.signal,
        });
        if (isMounted) {
          setProducts(res.data?.data || []);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted && err.name !== 'CanceledError' && err.name !== 'AbortError') {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchRecs();

    // Cleanup: runs when userId changes OR component unmounts.
    // We reset fetchedRef here so a genuine userId change (different user logs in)
    // will correctly trigger a new fetch.
    return () => {
      isMounted = false;
      controller.abort();
      fetchedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Early returns ──────────────────────────────────────────────────────────
  if (!userId || isAdmin()) return null;
  if (!loading && (error || products.length === 0)) return null;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  };

  const getPrice = (product) => {
    if (product.discount) {
      return product.price - (product.price * product.discount) / 100;
    }
    return product.price;
  };

  const handleAddToCart = async (e, product) => {
    e.preventDefault();          // don't navigate via the parent <Link>
    e.stopPropagation();
    if (!user) return;
    try {
      await api.post('/cart/add', {
        productId: product._id,
        quantity: 1,
        selectedColor: '',
        selectedSize: '',
        selectedFabric: '',
      });
      setAddedId(product._id);
      setTimeout(() => setAddedId(null), 1800);
    } catch (_) {
      // Silently ignore — user can still go to the product page
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="foryou-section">
      <div className="container">

        {/* Header */}
        <div className="foryou-header">
          <div className="foryou-title-group">
            <Sparkles size={20} className="foryou-sparkle" />
            <h2 className="foryou-title">Recommended For You</h2>
          </div>
          <p className="foryou-subtitle">
            Curated picks based on your browsing &amp; purchase history
          </p>
        </div>

        {/* Skeleton */}
        {loading && (
          <div className="foryou-skeleton-row" aria-busy="true" aria-label="Loading recommendations">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="foryou-skeleton-card">
                <div className="foryou-skeleton-img" />
                <div className="foryou-skeleton-body">
                  <div className="foryou-skeleton-line foryou-skeleton-line--long" />
                  <div className="foryou-skeleton-line foryou-skeleton-line--short" />
                  <div className="foryou-skeleton-line foryou-skeleton-line--price" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Carousel */}
        {!loading && products.length > 0 && (
          <div className="foryou-carousel-wrapper">

            <button
              className="foryou-scroll-btn foryou-scroll-btn--left"
              onClick={() => scroll('left')}
              aria-label="Scroll left"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="foryou-carousel" ref={scrollRef}>
              {products.map((product) => {
                const finalPrice = getPrice(product);
                const isAdded    = addedId === product._id;

                return (
                  <div key={product._id} className="foryou-card">

                    {/* Discount badge */}
                    {product.discount > 0 && (
                      <span className="foryou-badge">-{product.discount}%</span>
                    )}

                    {/* Image — clicking image or name navigates to product page */}
                    <Link to={`/product/${product._id}`} className="foryou-card-img-link">
                      <div className="foryou-card-img-wrap">
                        <img
                          src={product.images?.[0] || ''}
                          alt={product.name}
                          className="foryou-card-img"
                          onError={(e) => {
                            // Null out the handler first — prevents the infinite
                            // re-fire loop that caused the image-slot blinking
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="foryou-card-body">
                      <p className="foryou-card-category">{product.category}</p>

                      <Link to={`/product/${product._id}`} className="foryou-card-name-link">
                        <h3 className="foryou-card-name">{product.name}</h3>
                      </Link>

                      {/* Rating */}
                      {product.ratings?.count > 0 && (
                        <div className="foryou-card-rating">
                          <Star size={11} className="foryou-star" />
                          <span>{product.ratings.average.toFixed(1)}</span>
                          <span className="foryou-rating-count">
                            ({product.ratings.count})
                          </span>
                        </div>
                      )}

                      {/* Price */}
                      <div className="foryou-card-price-row">
                        <span className="foryou-card-price">
                          NPR {Math.round(finalPrice).toLocaleString()}
                        </span>
                        {product.discount > 0 && (
                          <span className="foryou-card-price-original">
                            NPR {Math.round(product.price).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="foryou-card-actions">
                        <Link
                          to={`/product/${product._id}`}
                          className="foryou-btn foryou-btn--view"
                        >
                          <Eye size={13} />
                          <span>View Details</span>
                        </Link>

                        <button
                          className={`foryou-btn foryou-btn--cart${isAdded ? ' foryou-btn--added' : ''}`}
                          onClick={(e) => handleAddToCart(e, product)}
                          disabled={isAdded}
                          title="Add to Cart"
                        >
                          <ShoppingCart size={13} />
                          <span>{isAdded ? 'Added!' : 'Add to Cart'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              className="foryou-scroll-btn foryou-scroll-btn--right"
              onClick={() => scroll('right')}
              aria-label="Scroll right"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

      </div>
    </section>
  );
});

ForYouSection.displayName = 'ForYouSection';
export default ForYouSection;
