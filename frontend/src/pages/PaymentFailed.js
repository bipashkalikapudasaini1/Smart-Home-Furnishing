import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { XCircle, ShoppingCart, Home } from 'lucide-react';
import './PaymentSuccess.css'; // shares the same styles

const PaymentFailed = () => {
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason') || 'Payment was cancelled or failed.';

  return (
    <div className="payment-page container">
      <div className="payment-card failed">
        <XCircle size={56} className="status-icon failed-icon" />
        <h2>Payment Failed</h2>
        <p className="status-msg">{decodeURIComponent(reason)}</p>
        <p className="status-msg" style={{ fontSize: '0.82rem', marginTop: '-12px' }}>
          Your cart has been kept intact. You can try again or choose a different payment method.
        </p>
        <div className="payment-actions">
          <Link to="/cart" className="btn btn-primary">
            <ShoppingCart size={16} /> Back to Cart
          </Link>
          <Link to="/" className="btn btn-secondary">
            <Home size={16} /> Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailed;
