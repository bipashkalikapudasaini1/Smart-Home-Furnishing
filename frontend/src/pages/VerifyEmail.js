import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../utils/api';
import { Mail, CheckCircle, RefreshCw } from 'lucide-react';
import './Auth.css';
import './VerifyEmail.css';

const VerifyEmail = () => {
  const location = useLocation();
  const navigate  = useNavigate();

  const email = location.state?.email || '';
  const [digits, setDigits]   = useState(['', '', '', '', '', '']);
  const [msg, setMsg]         = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending]   = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verified, setVerified]     = useState(false);

  const inputRefs = useRef([]);

  // Start a 60-second cooldown after page load (code was just sent)
  useEffect(() => {
    startCooldown(60);
  }, []); // eslint-disable-line

  const startCooldown = (seconds) => {
    setResendCooldown(seconds);
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── OTP digit input handling ─────────────────────────────────────────────
  const handleDigitChange = (index, value) => {
    // Accept only single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    // Auto-advance to next box
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // Allow pasting into first box
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) return;
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < 6) return setError('Please enter the full 6-digit code');
    if (!email)          return setError('Email is missing — please go back and try again');

    setError('');
    setLoading(true);
    try {
      const res = await authAPI.verifyEmail({ email, code });
      setMsg(res.data.message || 'Email verified!');
      setVerified(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
      // Clear digits on wrong code so user can re-type cleanly
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ── Resend ───────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setError('');
    setMsg('');
    try {
      await authAPI.resendVerification({ email });
      setMsg('A new code has been sent to your email.');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      startCooldown(60);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // ── Success screen ───────────────────────────────────────────────────────
  if (verified) {
    return (
      <div className="auth-container">
        <div className="auth-card verify-success-card">
          <div className="verify-success-icon"><CheckCircle size={56} /></div>
          <h2 className="auth-title" style={{ color: '#065f46' }}>Email Verified!</h2>
          <p className="verify-subtitle">Your account is now active. Redirecting to login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Header */}
        <div className="verify-header">
          <div className="verify-icon-wrap"><Mail size={32} /></div>
          <h2 className="auth-title">Verify Your Email</h2>
          <p className="verify-subtitle">
            We sent a 6-digit code to<br />
            <strong>{email || 'your email'}</strong>
          </p>
        </div>

        {msg   && <div className="alert alert-success">{msg}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {/* 6 individual digit boxes */}
          <div className="otp-row" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className={`otp-box${d ? ' otp-box--filled' : ''}`}
                value={d}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                autoFocus={i === 0}
              />
            ))}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading || digits.join('').length < 6}
          >
            {loading ? 'Verifying…' : 'Verify Email'}
          </button>
        </form>

        {/* Resend row */}
        <div className="resend-row">
          <span>Didn't receive a code?</span>
          <button
            type="button"
            className="resend-btn"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resending}
          >
            {resending
              ? <><RefreshCw size={14} className="spin" /> Sending…</>
              : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : <><RefreshCw size={14} /> Resend Code</>
            }
          </button>
        </div>

        <div className="auth-footer">
          <Link to="/login">← Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
