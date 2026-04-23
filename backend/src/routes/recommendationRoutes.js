/**
 * recommendationRoutes.js
 * Mounted at: /api/recommendations
 */

const express = require('express');
const {
  getTrending,
  getMostSearched,
  getMostBought,
  getAutocomplete,
  getForYou,
  getSimilarProducts,
  logView,
  logCartAdd,
} = require('../controllers/recommendationController');

const { protect } = require('../middleware/auth');

const router = express.Router();

// ── Public discovery endpoints ──────────────────────────────────────────────
router.get('/trending',            getTrending);
router.get('/most-searched',       getMostSearched);
router.get('/most-bought',         getMostBought);
router.get('/autocomplete',        getAutocomplete);
router.get('/similar/:productId',  getSimilarProducts);   // Item-Item AI similarity

// ── Protected personalisation endpoint ─────────────────────────────────────
router.get('/for-you', protect, getForYou);  // Hybrid CF + CB AI model

// ── Interaction tracking (optional auth — works for guests) ────────────────
// We use a lightweight "optionalAuth" pattern: if there's a valid Bearer token
// we attach req.user; if not, req.user stays undefined (that's fine).
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt  = require('jsonwebtoken');
    const User = require('../models/User');
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (!err && decoded?.id) {
        try {
          req.user = await User.findById(decoded.id);
        } catch (_) { /* ignore */ }
      }
      next();
    });
  } else {
    next();
  }
};

router.post('/log-view',     optionalAuth, logView);
router.post('/log-cart-add', optionalAuth, logCartAdd);

module.exports = router;
