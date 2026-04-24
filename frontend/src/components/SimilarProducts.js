import React, { useState, useEffect, useRef, memo } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Star, ChevronLeft, ChevronRight, ShoppingCart, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { recommendationAPI } from '../utils/api';
import './SimilarProducts.css';

/**
 * SimilarProducts
 * ─────────────────────────────────────────────────────────────────────────────
 * Horizontal carousel of products similar to the currently viewed product.
 *
 * Algorithm (backend — aiRecommendationService.getSimilarProducts):
 *   similarity = 0.6 × contentCosineSimilarity + 0.4 × coPurchaseFrequency
 *
 * Content similarity uses a 17-dim feature vector:
 *   [category one-hot (11 dims), price bucket (5 dims), normalised rating (1 dim)]
 *
 * Co-purchase frequency counts how many users bought both products together.
 *
 * Props:
 *   productId  {string}  – MongoDB _id of the currently viewed product
 * ─────────────────────────────────────────────────────────────────────────────
 */
const SimilarProducts = memo(({ productId }) => {
  const { user, isAdmin } = useAuth();

  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [addedId,  setAddedId]  = useState(null);

  const scrollRef  = useRef(null);
  const fetchedFor = useRef(null); // Track which productId we've already fetched for

  useEffect(() => {
    if (!productId) { setLoading(false); return; }
    // Avoid duplicate fetches when the same productId triggers re-render
    if (fetchedFor.current === productId) return;
    fetchedFor.current = productId;

    let isMounted = true;
    const controller = new AbortController();

    const fetchSimilar = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await api.get(
          `/recommendations/similar/${productId}?limit=8`,
          { signal: controller.signal }
        );
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

    fetchSimilar();

    return () => {
      isMounted = false;
      controller.abort();
      // Reset so a genuine productId change triggers a fresh fetch
      fetchedFor.current = null;
    };
  }, [productId]);

  // ── Early returns ──────────────────────────────────────────────────────────
  if (!loading && (error || products.length === 0)) return null;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  const getPrice = (product) => {
    if (product.discount) {
      return product.price - (product.price * product.discount) / 100;
    }
    return product.price;
  };

  const handleAddToCart = async (e, product) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    try {
      await api.post('/cart/add', {
        productId:     product._id,
        quantity:      1,
        selectedColor:  '',
        selectedSize:   '',
        selectedFabric: '',
      });
      recommendationAPI.logCartAdd(product._id);
      setAddedId(product._id);
      setTimeout(() => setAddedId(null), 1800);
    } catch (_) { /* silently ignore */ }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="simprods-section">
      <div className="simprods-header">
        <div className="simprods-title-group">
          <Layers size={20} className="simprods-icon" />
          <h2 className="simprods-title">You May Also Like</h2>
        </div>
        <p className="simprods-subtitle">
          Products similar to this one — matched by category, features &amp; purchase patterns
        </p>
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="simprods-skeleton-row" aria-busy="true" aria-label="Loading similar products">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="simprods-skeleton-card">
              <div className="simprods-skeleton-img" />
              <div className="simprods-skeleton-body">
                <div className="simprods-skeleton-line simprods-skeleton-line--long" />
                <div className="simprods-skeleton-line simprods-skeleton-line--short" />
                <div className="simprods-skeleton-line simprods-skeleton-line--price" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Carousel */}
      {!loading && products.length > 0 && (
        <div className="simprods-carousel-wrapper">

          <button
            className="simprods-scroll-btn simprods-scroll-btn--left"
            onClick={() => scroll('left')}
            aria-label="Scroll left"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="simprods-carousel" ref={scrollRef}>
            {products.map((product) => {
              const finalPrice = getPrice(product);
              const isAdded    = addedId === product._id;

              return (
                <div key={product._id} className="simprods-card">

                  {/* Discount badge */}
                  {product.discount > 0 && (
                    <span className="simprods-badge">-{product.discount}%</span>
                  )}

                  {/* Product image */}
                  <Link to={`/product/${product._id}`} className="simprods-card-img-link">
                    <div className="simprods-card-img-wrap">
                      <img
                        src={product.images?.[0] || ''}
                        alt={product.name}
                        className="simprods-card-img"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="simprods-card-body">
                    <p className="simprods-card-category">{product.category}</p>

                    <Link to={`/product/${product._id}`} className="simprods-card-name-link">
                      <h3 className="simprods-card-name">{product.name}</h3>
                    </Link>

                    {/* Rating */}
                    {product.ratings?.count > 0 && (
                      <div className="simprods-card-rating">
                        <Star size={11} className="simprods-star" />
                        <span>{product.ratings.average.toFixed(1)}</span>
                        <span className="simprods-rating-count">({product.ratings.count})</span>
                      </div>
                    )}

                    {/* Price */}
                    <div className="simprods-card-price-row">
                      <span className="simprods-card-price">
                        NPR {Math.round(finalPrice).toLocaleString()}
                      </span>
                      {product.discount > 0 && (
                        <span className="simprods-card-price-original">
                          NPR {Math.round(product.price).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="simprods-card-actions">
                      <Link
                        to={`/product/${product._id}`}
                        className="simprods-btn simprods-btn--view"
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </Link>

                      {!isAdmin() && (
                        <button
                          className={`simprods-btn simprods-btn--cart${isAdded ? ' simprods-btn--added' : ''}`}
                          onClick={(e) => handleAddToCart(e, product)}
                          disabled={isAdded}
                          title="Add to Cart"
                        >
                          <ShoppingCart size={13} />
                          <span>{isAdded ? 'Added!' : 'Add'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            className="simprods-scroll-btn simprods-scroll-btn--right"
            onClick={() => scroll('right')}
            aria-label="Scroll right"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </section>
  );
});

SimilarProducts.displayName = 'SimilarProducts';
export default SimilarProducts;
