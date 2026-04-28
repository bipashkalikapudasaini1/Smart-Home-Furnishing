const express = require('express');
const {
  getAllBanners,
  getActiveBanner,
  getBannerById,
  getFestivalProducts,
  createBanner,
  updateBanner,
  deleteBanner,
  addProduct,
  removeProduct,
} = require('../controllers/festivalController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Public
router.get('/active', getActiveBanner);
router.get('/by-id/:id', getBannerById);
router.get('/:id/products', getFestivalProducts);

// Admin only
router.get('/', protect, adminOnly, getAllBanners);
router.post('/', protect, adminOnly, createBanner);
router.put('/:id', protect, adminOnly, updateBanner);
router.delete('/:id', protect, adminOnly, deleteBanner);
router.post('/:id/products', protect, adminOnly, addProduct);
router.delete('/:id/products/:productId', protect, adminOnly, removeProduct);

module.exports = router;
