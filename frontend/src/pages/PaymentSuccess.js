import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { CheckCircle, XCircle, Loader, Package, Home, Star } from 'lucide-react';
import './PaymentSuccess.css';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying | success | failed
  const [orderData, setOrderData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const pidx = searchParams.get('pidx');
    if (!pidx) {
      setStatus('failed');
      setError('No payment data received from Khalti.');
      return;
    }
    verifyPayment(pidx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyPayment = async (pidx) => {
    try {
      const res = await api.post('/orders/verify', { pidx });
      if (res.data.success) {
        setOrderData(res.data.data);
        setStatus('success');
      } else {
        setStatus('failed');
        setError(res.data.message || 'Payment verification failed.');
      }
    } catch (err) {
      setStatus('failed');
      setError(err.response?.data?.message || 'Could not verify payment. Contact support.');
    }
  };

  if (status === 'verifying') {
    return (
      <div className="payment-page container">
        <div className="payment-card">
          <Loader className="spin-icon" size={48} />
          <h2>Verifying your payment…</h2>
          <p>Please wait while we confirm your payment with Khalti.</p>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="payment-page container">
        <div className="payment-card failed">
          <XCircle size={56} className="status-icon failed-icon" />
          <h2>Payment Failed</h2>
          <p className="status-msg">{error || 'Your payment could not be processed.'}</p>
          <div className="payment-actions">
            <Link to="/cart" className="btn btn-primary">Try Again</Link>
            <Link to="/" className="btn btn-secondary"><Home size={16} /> Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-page container">
      <div className="payment-card success">
        <CheckCircle size={56} className="status-icon success-icon" />
        <h2>Payment Successful!</h2>
        <p className="status-msg">Thank you for your order. Your payment has been confirmed.</p>

        {orderData && (
          <div className="payment-details">
            <div className="detail-row">
              <span>Order ID</span>
              <span className="detail-val">{orderData.orderId}</span>
            </div>
            {orderData.khaltiTransactionId && (
            <div className="detail-row">
              <span>Khalti Transaction ID</span>
              <span className="detail-val">{orderData.khaltiTransactionId}</span>
            </div>
            )}
            <div className="detail-row">
              <span>Amount Paid</span>
              <span className="detail-val highlight">Rs. {orderData.totalAmount?.toFixed(2)}</span>
            </div>
            <div className="detail-row">
              <span>Delivery Status</span>
              <span className="detail-val status-badge placed">Order Placed</span>
            </div>
            {orderData.rewardDiscount > 0 && (
              <div className="detail-row reward-used-row">
                <span>🎁 Reward Discount Used</span>
                <span className="detail-val">− Rs. {orderData.rewardDiscount?.toFixed(2)}</span>
              </div>
            )}
            {orderData.rewardPointsEarned > 0 && (
              <div className="detail-row reward-earned-row">
                <span><Star size={14} style={{color:'#f59e0b', verticalAlign:'middle', marginRight:4}} />Points Earned</span>
                <span className="detail-val reward-earned-val">+{orderData.rewardPointsEarned} pts</span>
              </div>
            )}
          </div>
        )}
        {orderData?.rewardPointsEarned > 0 && (
          <div className="reward-earned-banner">
            🌟 You earned <strong>{orderData.rewardPointsEarned} reward points</strong> on this order! Use them for discounts on your next purchase.
          </div>
        )}

        <div className="payment-actions">
          <Link to="/orders" className="btn btn-primary">
            <Package size={16} /> Track My Order
          </Link>
          <Link to="/" className="btn btn-secondary">
            <Home size={16} /> Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
