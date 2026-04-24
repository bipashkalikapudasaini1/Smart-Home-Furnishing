import React, { useState, useEffect, useCallback } from 'react';
import { productAPI } from '../utils/api';
import ProductCard from '../components/ProductCard';
import ProductFilters from '../components/ProductFilters';
import SearchRecommendations from '../components/SearchRecommendations';
import ForYouSection from '../components/ForYouSection';
import './Home.css';

const Home = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    brand: '',
    material: '',
    color: '',
    fabric: '',
  });

  const [filterOptions, setFilterOptions] = useState({
    brands: [],
    materials: [],
    categories: [],
    colors: [],
    fabrics: [],
    priceRange: { minPrice: 0, maxPrice: 0 },
  });

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      const response = await productAPI.getAll(params);
      setProducts(response.data.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await productAPI.getFilterOptions();
      setFilterOptions(response.data.data);
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchFilterOptions();
  }, [fetchProducts, fetchFilterOptions]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Called by SearchRecommendations when user picks a term or types
  const handleSearchChange = (value) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '', category: '', minPrice: '', maxPrice: '',
      brand: '', material: '', color: '', fabric: '',
    });
  };

  return (
    <div className="home-container">
      {/* ── Hero + Search ──────────────────────────────────────────────── */}
      <div className="home-hero">
        <div className="container">
          <h1>Smart Home Furnishing</h1>
          <p>Transform your space with our quality furniture collection</p>

          {/* Enhanced search with recommendation dropdown */}
          <SearchRecommendations
            value={filters.search}
            onChange={handleSearchChange}
            placeholder="Search for furniture..."
          />
        </div>
      </div>

      {/* ── For You Personalised Section (logged-in users only) ────────── */}
      <ForYouSection />

      {/* ── Product Grid + Filters ─────────────────────────────────────── */}
      <div className="container">
        <div className="home-content">
          <ProductFilters
            filters={filters}
            filterOptions={filterOptions}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
          />

          <div className="products-section">
            <div className="products-header">
              <h2>Our Products</h2>
              <p>{products.length} products found</p>
            </div>

            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
                <p>Loading products...</p>
              </div>
            ) : error ? (
              <div className="alert alert-error">{error}</div>
            ) : products.length === 0 ? (
              <div className="no-products">
                <p>No products found. Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="products-grid">
                {products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
