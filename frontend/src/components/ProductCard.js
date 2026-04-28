import React from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFestival } from '../context/FestivalContext';
import './ProductCard.css';

const ProductCard = ({ product, festivalDiscount = 0 }) => {
  const { isAdmin } = useAuth();
  const { getFestivalDiscount } = useFestival();

  // festivalDiscount prop: explicitly passed from FestivalSale page
  // getFestivalDiscount: auto-detected from context (Home page, anywhere else)
  const propDiscount  = Number(festivalDiscount) || 0;
  const ctxDiscount   = getFestivalDiscount(product._id);
  const fest          = propDiscount || ctxDiscount;   // prop takes priority
  const isFestival    = fest > 0;
  const appliedDiscount = isFestival ? fest : (product.discount || 0);

  const finalPrice = appliedDiscount
    ? Math.round(product.price - (product.price * appliedDiscount) / 100)
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
        {appliedDiscount > 0 && (
          <div className={`product-badge ${isFestival ? 'product-badge--festival' : ''}`}>
            {appliedDiscount}% OFF
          </div>
        )}
      </div>

      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-category">{product.category}</p>
        <p className="product-brand">{product.brand}</p>

        <div className="product-footer">
          <div className="product-price">
            {appliedDiscount > 0 && (
              <span className="original-price">NPR {product.price?.toLocaleString()}</span>
            )}
            <span className="final-price">NPR {finalPrice?.toLocaleString()}</span>
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