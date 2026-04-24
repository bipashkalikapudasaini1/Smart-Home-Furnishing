import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { isAdmin } = useAuth();
  const finalPrice = product.discount
    ? product.price - (product.price * product.discount) / 100
    : product.price;

  return (
    <div className="product-card">
      <div className="product-image">
        {product.images && product.images.length > 0 ? (
          <img src={product.images[0]} alt={product.name} />
        ) : (
          <div className="product-image-placeholder">
            <Package size={48} />
          </div>
        )}
        {product.discount > 0 && (
          <div className="product-badge">{product.discount}% OFF</div>
        )}
      </div>

      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-category">{product.category}</p>
        <p className="product-brand">{product.brand}</p>

        <div className="product-rating">
          <Star size={16} fill="#ffc107" stroke="#ffc107" />
          <span>{product.ratings?.average?.toFixed(1) || '0.0'}</span>
          <span className="rating-count">({product.ratings?.count || 0})</span>
        </div>

        <div className="product-footer">
          <div className="product-price">
            {product.discount > 0 && (
              <span className="original-price">NPR {product.price}</span>
            )}
            <span className="final-price">NPR {finalPrice}</span>
          </div>
        </div>

        <Link to={`/product/${product._id}`} className="btn btn-primary btn-full">
          {product.isCustomizable && !isAdmin() ? "View & Customize" : "View Details"}
        </Link>
      </div>
    </div>
  );
};

export default ProductCard;