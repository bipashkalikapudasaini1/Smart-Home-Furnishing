import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, User, LogOut, LayoutDashboard, ShoppingCart, Package, Users, Star, Gift } from 'lucide-react';
import api from '../utils/api';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rewardPoints, setRewardPoints] = useState(0);

  // Fetch reward points whenever user logs in
  useEffect(() => {
    if (user && !isAdmin()) {
      api.get('/auth/me').then(res => {
        setRewardPoints(res.data?.data?.rewardPoints || 0);
      }).catch(() => {});
    } else {
      setRewardPoints(0);
    }
  }, [user]); // eslint-disable-line

  const handleLogout = () => {
    logout();
    setRewardPoints(0);
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="container">
        <div className="navbar-content">
          <Link to="/" className="navbar-brand">
            <Home size={24} />
            <span>Smart Home Furnishing</span>
          </Link>

          <div className="navbar-menu">
            <Link to="/" className="nav-link">
              Home
            </Link>

            {!isAdmin() && (
              <Link to="/cart" className="nav-link">
                <ShoppingCart size={18} style={{ marginRight: '6px' }} />
                Cart
              </Link>
            )}

            {user ? (
              <>
                {!isAdmin() && (
                  <Link to="/orders" className="nav-link">
                    <Package size={18} style={{ marginRight: '6px' }} />
                    My Orders
                  </Link>
                )}
                {isAdmin() && (
                  <>
                    <Link to="/admin" className="nav-link">
                      <LayoutDashboard size={18} />
                      <span>Products</span>
                    </Link>
                    <Link to="/admin/orders" className="nav-link">
                      <Package size={18} />
                      <span>Orders</span>
                    </Link>
                    <Link to="/admin/users" className="nav-link">
                      <Users size={18} />
                      <span>Users</span>
                    </Link>
                    <Link to="/admin/rewards" className="nav-link">
                      <Gift size={18} />
                      <span>Rewards</span>
                    </Link>
                  </>
                )}
                {!isAdmin() && (
                  <Link to="/rewards" className="nav-rewards-badge" title="Reward Store">
                    <Star size={14} />
                    <span>{rewardPoints} pts</span>
                  </Link>
                )}
                <div className="user-info">
                  <User size={18} />
                  <span>{user.name}</span>
                </div>
                <button onClick={handleLogout} className="btn btn-secondary">
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-primary">
                  Login
                </Link>
                <Link to="/register" className="btn btn-secondary">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
