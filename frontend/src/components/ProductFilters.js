import React from 'react';
import { Filter, X } from 'lucide-react';
import './ProductFilters.css';

const ProductFilters = ({ filters, filterOptions, onFilterChange, onClearFilters }) => {
  return (
    <div className="filters-container">
      <div className="filters-header">
        <h3>
          <Filter size={20} />
          Filters
        </h3>
        <button onClick={onClearFilters} className="clear-filters">
          <X size={16} />
          Clear
        </button>
      </div>

      <div className="filter-group">
        <label>Category</label>
        <select
          value={filters.category}
          onChange={(e) => onFilterChange('category', e.target.value)}
          className="form-control"
        >
          <option value="">All Categories</option>
          {filterOptions.categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Price Range (NPR)</label>
        <div className="price-inputs">
          <input
            type="number"
            placeholder="Min"
            value={filters.minPrice}
            onChange={(e) => onFilterChange('minPrice', e.target.value)}
            className="form-control"
          />
          <span>-</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(e) => onFilterChange('maxPrice', e.target.value)}
            className="form-control"
          />
        </div>
      </div>

      <div className="filter-group">
        <label>Brand</label>
        <select
          value={filters.brand}
          onChange={(e) => onFilterChange('brand', e.target.value)}
          className="form-control"
        >
          <option value="">All Brands</option>
          {filterOptions.brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Material</label>
        <select
          value={filters.material}
          onChange={(e) => onFilterChange('material', e.target.value)}
          className="form-control"
        >
          <option value="">All Materials</option>
          {filterOptions.materials.map((material) => (
            <option key={material} value={material}>
              {material}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Color</label>
        <select
          value={filters.color}
          onChange={(e) => onFilterChange('color', e.target.value)}
          className="form-control"
        >
          <option value="">All Colors</option>
          {filterOptions.colors.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label>Fabric Type</label>
        <select
          value={filters.fabric}
          onChange={(e) => onFilterChange('fabric', e.target.value)}
          className="form-control"
        >
          <option value="">All Fabrics</option>
          {filterOptions.fabrics.map((fabric) => (
            <option key={fabric} value={fabric}>
              {fabric}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ProductFilters;
