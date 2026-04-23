const express = require('express');
const {
  createOrder,
  verifyKhaltiPayment,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateDeliveryStatus,
  getAllUsers,
  getUserDetails,
  getTransactionSummary,
  adjustRewardPoints
} = require('../controllers/orderController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

//  Specific named user routes (must come BEFORE /:id wildcard) 
router.post('/',             protect, createOrder);
router.post('/verify',       protect, verifyKhaltiPayment);
router.get('/my',            protect, getUserOrders);
router.put('/:id/cancel',    protect, cancelOrder);

//  Admin routes (must come BEFORE /:id wildcard) 
router.get('/admin/all',           protect, adminOnly, getAllOrders);
router.get('/admin/transactions',  protect, adminOnly, getTransactionSummary);
router.get('/admin/users',         protect, adminOnly, getAllUsers);
router.get('/admin/users/:userId',                    protect, adminOnly, getUserDetails);
router.put('/admin/users/:userId/reward-points',      protect, adminOnly, adjustRewardPoints);
router.put('/admin/:id/delivery',                     protect, adminOnly, updateDeliveryStatus);

//  Wildcard route LAST (catches /:id — must not shadow above routes) 
router.get('/:id', protect, getOrderById);

module.exports = router;
