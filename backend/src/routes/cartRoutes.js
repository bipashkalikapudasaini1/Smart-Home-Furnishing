const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

/**
 * Cart routes (DB-based per-user cart)
 * Base: /api/cart
 */

// GET /api/cart -> get current user's cart (with populated product)
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('cart.product');
    return res.json({ success: true, data: user.cart || [] });
  } catch (err) {
    console.error('GET /cart error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/cart/add -> add item to cart (merge if same product + same selections)
router.post('/add', protect, async (req, res) => {
  try {
    const { productId, quantity = 1, selectedColor = '', selectedSize = '', selectedFabric = '' } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'quantity must be >= 1' });
    }

    // Ensure product exists
    const product = await Product.findById(productId).select('_id');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const user = await User.findById(req.user.id);

    const existingItem = (user.cart || []).find(
      (item) =>
        item.product.toString() === productId &&
        (item.selectedColor || '') === (selectedColor || '') &&
        (item.selectedSize || '') === (selectedSize || '') &&
        (item.selectedFabric || '') === (selectedFabric || '')
    );

    if (existingItem) {
      existingItem.quantity += qty;
    } else {
      user.cart = user.cart || [];
      user.cart.push({
        product: productId,
        quantity: qty,
        selectedColor,
        selectedSize,
        selectedFabric,
      });
    }

    await user.save();
    const populated = await User.findById(req.user.id).populate('cart.product');
    return res.json({ success: true, data: populated.cart });
  } catch (err) {
    console.error('POST /cart/add error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/cart/update -> update quantity by cartItemId
router.put('/update', protect, async (req, res) => {
  try {
    const { cartItemId, quantity } = req.body;

    if (!cartItemId) {
      return res.status(400).json({ success: false, message: 'cartItemId is required' });
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'quantity must be >= 1' });
    }

    const user = await User.findById(req.user.id);
    const item = user.cart.id(cartItemId);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    item.quantity = qty;
    await user.save();

    const populated = await User.findById(req.user.id).populate('cart.product');
    return res.json({ success: true, data: populated.cart });
  } catch (err) {
    console.error('PUT /cart/update error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/cart/remove/:id -> remove cart item by cartItemId
router.delete('/remove/:id', protect, async (req, res) => {
  try {
    const cartItemId = req.params.id;

    const user = await User.findById(req.user.id);
    user.cart = (user.cart || []).filter((item) => item._id.toString() !== cartItemId);

    await user.save();

    const populated = await User.findById(req.user.id).populate('cart.product');
    return res.json({ success: true, data: populated.cart });
  } catch (err) {
    console.error('DELETE /cart/remove error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/cart/clear -> clear cart
router.delete('/clear', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.cart = [];
    await user.save();
    return res.json({ success: true, data: [] });
  } catch (err) {
    console.error('DELETE /cart/clear error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
