import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useFestival } from '../context/FestivalContext';
import { Trash2, Minus, Plus, ShoppingBag } from 'lucide-react';
import './Cart.css';

// Helper: get the correct per-item price respecting festival discount
const getItemPrice = (item, getFestivalDiscount) => {
  const product = item?.product;
  if (!product) return 0;
  const festDiscount = getFestivalDiscount(product._id);
  const discount     = festDiscount > 0 ? festDiscount : (product.discount || 0);
  return discount
    ? Math.round(product.price - (product.price * discount) / 100)
    : product.price;
};

const Cart = () => {
  const { user, loading: authLoading } = useAuth();
  const { getFestivalDiscount }        = useFestival();
  const navigate = useNavigate();

  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCart = async () => {
    try {
      setError('');
      const res = await api.get('/cart');
      setCart(res.data?.data || []);
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to load cart';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Cart is user-specific and protected. If not logged in, send to login.
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    fetchCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const subtotal = useMemo(() => {
    return (cart || []).reduce((sum, item) => {
      const price = getItemPrice(item, getFestivalDiscount);
      return sum + price * (item.quantity || 0);
    }, 0);
  }, [cart, getFestivalDiscount]);

  const updateQty = async (cartItemId, quantity) => {
    try {
      const res = await api.put('/cart/update', { cartItemId, quantity });
      setCart(res.data?.data || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update quantity');
    }
  };

  const removeItem = async (cartItemId) => {
    try {
      const res = await api.delete(`/cart/remove/${cartItemId}`);
      setCart(res.data?.data || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove item');
    }
  };

  const clearCart = async () => {
    try {
      const res = await api.delete('/cart/clear');
      setCart(res.data?.data || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to clear cart');
    }
  };

  if (loading) return <div className="cart-page container">Loading cart...</div>;
  if (error) return <div className="cart-page container cart-error">{error}</div>;

  return (
    <div className="cart-page container">
      <div className="cart-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Continue Shopping</button>
        <h2>Your Cart</h2>
        {cart.length > 0 && (
          <button className="btn btn-secondary" onClick={clearCart}>
            Clear Cart
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="cart-empty">
          <ShoppingBag size={36} />
          <p>Your cart is empty.</p>
          <Link to="/" className="btn btn-primary">Continue Shopping</Link>
        </div>
      ) : (
        <div className="cart-grid">
          <div className="cart-items">
            {cart.map((item) => (
              <div key={item._id} className="cart-item">
                <div className="cart-item-left">
                  <div className="cart-thumb">
                    {item.product?.images?.[0] ? (
                      <img src={item.product.images[0]} alt={item.product.name} />
                    ) : (
                      <div className="cart-thumb-placeholder" />
                    )}
                  </div>

                  <div className="cart-meta">
                    <h3 className="cart-title">{item.product?.name || 'Product'}</h3>
                    <p className="cart-sub">
                      {item.selectedColor ? `Color: ${item.selectedColor}` : ''}
                      {item.selectedSize ? `  •  Size: ${item.selectedSize}` : ''}
                      {item.selectedFabric ? `  •  Fabric: ${item.selectedFabric}` : ''}
                    </p>
                    <p className="cart-price">
                      NPR {getItemPrice(item, getFestivalDiscount).toLocaleString()}
                      {getItemPrice(item, getFestivalDiscount) < item.product?.price && (
                        <span className="cart-original-price"> NPR {item.product.price?.toLocaleString()}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="cart-item-right">
                  <div className="qty-control">
                    <button
                      className="qty-btn"
                      onClick={() => updateQty(item._id, Math.max(1, (item.quantity || 1) - 1))}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => updateQty(item._id, (item.quantity || 1) + 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <button className="remove-btn" onClick={() => removeItem(item._id)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <h3>Summary</h3>
            <div className="summary-row">
              <span>Subtotal</span>
              <span>Rs. {subtotal.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Shipping</span>
              <span>—</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>Rs. {subtotal.toFixed(2)}</span>
            </div>

            <button className="btn btn-primary checkout-btn" onClick={() => navigate('/checkout')}>
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
