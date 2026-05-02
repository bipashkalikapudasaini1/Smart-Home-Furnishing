const express = require('express');
const {
  createRewardItem,
  updateRewardItem,
  deleteRewardItem,
  getAllClaims,
  updateClaimDelivery,
  getRewardItems,
  getAllRewardItems,
  claimReward,
  cancelClaim,
  getMyClaims
} = require('../controllers/rewardController');
const { protect, adminOnly } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

// ── Named routes BEFORE wildcards ──────────────────────────────────────────
router.get('/admin/all',  protect, adminOnly, getAllRewardItems);
router.get('/claims',     protect, adminOnly, getAllClaims);
router.get('/my-claims',  protect,            getMyClaims);

// ── Admin: update claim delivery status (placed→processing→shipped→delivered)
router.put('/claims/:claimId/delivery', protect, adminOnly, updateClaimDelivery);

// ── User: cancel their own claim (before shipped)
router.put('/claims/:claimId/cancel',   protect, cancelClaim);

// ── Public / User routes ────────────────────────────────────────────────────
router.get('/',           protect,            getRewardItems);
router.post('/:id/claim', protect,            claimReward);

// ── Admin CRUD ──────────────────────────────────────────────────────────────
router.post('/',    protect, adminOnly, upload.single('image'), createRewardItem);
router.put('/:id',  protect, adminOnly, upload.single('image'), updateRewardItem);
router.delete('/:id', protect, adminOnly, deleteRewardItem);

module.exports = router;
