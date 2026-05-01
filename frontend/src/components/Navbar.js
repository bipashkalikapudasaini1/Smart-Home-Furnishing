import React, { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, User, LayoutDashboard, ShoppingCart, Package, Users, Star, Gift, Palette, Tag } from 'lucide-react';
import api from '../utils/api';
import useAutoRefresh from '../hooks/useAutoRefresh';
import './Navbar.css';

const API_BASE = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';

const Navbar = () => {
  const { user, isAdmin, updateUser } = useAuth();

  const refreshUserData = useCallback(() => {
    if (user && !isAdmin()) {
      api.get('/auth/me').then(res => {
        const data = res.data?.data;
        if (data) {
          updateUser({
            rewardPoints: data.rewardPoints || 0,
            avatar:       data.avatar       || '',
          });
        }
      }).catch(() => {});
    }
  }, [user?._id]); // eslint-disable-line

  useEffect(() => { refreshUserData(); }, [user?._id]); // eslint-disable-line
  useAutoRefresh(refreshUserData, 45_000);

  return (
    <nav className="navbar">
      <div className="container">
        <div className="navbar-content">

          {/* Brand */}
          <Link to="/" className="navbar-brand">
            <Home size={24} />
            <span className="navbar-brand-text">Smart Home Furnishing</span>
          </Link>

          {/* Nav links — always visible, icons+text on desktop, icons-only on mobile */}
          <div className="navbar-menu">
            <Link to="/" className="nav-link nav-home-link" title="Home">
              <Home size={18} />
              <span className="nav-text">Home</span>
            </Link>

            {!isAdmin() && (
              <Link to="/cart" className="nav-link" title="Cart">
                <ShoppingCart size={18} />
                <span className="nav-text">Cart</span>
              </Link>
            )}

            {user ? (
              <>
                {!isAdmin() && (
                  <Link to="/orders" className="nav-link" title="My Orders">
                    <Package size={18} />
                    <span className="nav-text">My Orders</span>
                  </Link>
                )}
                {!isAdmin() && (
                  <Link to="/my-customizations" className="nav-link" title="Customize">
                    <Palette size={18} />
                    <span className="nav-text">Customize</span>
                  </Link>
                )}

                {isAdmin() && (
                  <>
                    <Link to="/admin" className="nav-link" title="Products">
                      <LayoutDashboard size={18} />
                      <span className="nav-text">Products</span>
                    </Link>
                    <Link to="/admin/orders" className="nav-link" title="Orders">
                      <Package size={18} />
                      <span className="nav-text">Orders</span>
                    </Link>
                    <Link to="/admin/users" className="nav-link" title="Users">
                      <Users size={18} />
                      <span className="nav-text">Users</span>
                    </Link>
                    <Link to="/admin/rewards" className="nav-link" title="Rewards">
                      <Gift size={18} />
                      <span className="nav-text">Rewards</span>
                    </Link>
                    <Link to="/admin/festival" className="nav-link" title="Festival">
                      <Tag size={18} />
                      <span className="nav-text">Festival</span>
                    </Link>
                  </>
                )}

                {!isAdmin() && (
                  <Link to="/rewards" className="nav-rewards-badge" title="Reward Store">
                    <Star size={14} />
                    <span>{user.rewardPoints || 0} pts</span>
                  </Link>
                )}

                <Link to="/profile" className="nav-user-link" title="My Profile">
                  {user.avatar
                    ? <img src={`${API_BASE}${user.avatar}`} alt="avatar" className="nav-avatar" />
                    : <User size={18} />
                  }
                  <span className="nav-text">{user.name}</span>
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-primary">Login</Link>
                <Link to="/register" className="btn btn-secondary">Register</Link>
              </>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
};

export default Navbar;
