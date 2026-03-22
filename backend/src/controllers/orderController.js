const axios  = require('axios');
const Order  = require('../models/Order');
const User   = require('../models/User');

// ─────────────────────────────────────────────
// Khalti config
// ─────────────────────────────────────────────
const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY || 'test_secret_key_f59e8b7d18b4499ca40f68195a846e9b';
const KHALTI_API_URL    = process.env.KHALTI_API_URL    || 'https://a.khalti.com/api/v2/';
const FRONTEND_URL      = process.env.FRONTEND_URL      || 'http://localhost:3000';
const WEBSITE_URL       = process.env.WEBSITE_URL       || 'http://localhost:3000';
const DELIVERY_CHARGE   = parseInt(process.env.DELIVERY_CHARGE || '500', 10);

const khaltiHeaders = () => ({
  Authorization: `Key ${KHALTI_SECRET_KEY}`,
  'Content-Type': 'application/json'
});

// ─────────────────────────────────────────────
// @desc   Create order + initiate Khalti payment
// @route  POST /api/orders
// @access Private
// ─────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    const { shippingAddress, buyNowItem } = req.body;

    if (!shippingAddress?.name || !shippingAddress?.phone ||
        !shippingAddress?.street || !shippingAddress?.city) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required fields (Name, Phone, Street, City)'
      });
    }

    const items = [];
    let subtotal = 0;

    if (buyNowItem) {
      // ── Buy Now: single product, skip cart ──
      const Product = require('../models/Product');
      const product = await Product.findById(buyNowItem.productId).select('name price discount images stock');
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

      const qty = Math.max(1, parseInt(buyNowItem.quantity) || 1);
      if (product.stock < qty) {
        return res.status(400).json({ success: false, message: `"${product.name}" only has ${product.stock} unit(s) in stock` });
      }

      const unitPrice = product.discount
        ? parseFloat((product.price - (product.price * product.discount) / 100).toFixed(2))
        : product.price;

      items.push({
        product:        product._id,
        name:           product.name,
        price:          unitPrice,
        quantity:       qty,
        selectedColor:  '',
        selectedSize:   '',
        selectedFabric: '',
        image:          product.images?.[0] || ''
      });
      subtotal = unitPrice * qty;

    } else {
      // ── Normal: read from cart ──
      const userWithCart = await User.findById(req.user._id).populate({
        path: 'cart.product',
        select: 'name price discount images stock'
      });

      if (!userWithCart?.cart?.length) {
        return res.status(400).json({ success: false, message: 'Your cart is empty' });
      }

      for (const cartItem of userWithCart.cart) {
        if (!cartItem.product) continue;
        const p = cartItem.product;

        if (p.stock < cartItem.quantity) {
          return res.status(400).json({
            success: false,
            message: `"${p.name}" only has ${p.stock} unit(s) in stock`
          });
        }

        const unitPrice = p.discount
          ? parseFloat((p.price - (p.price * p.discount) / 100).toFixed(2))
          : p.price;

        items.push({
          product:        p._id,
          name:           p.name,
          price:          unitPrice,
          quantity:       cartItem.quantity,
          selectedColor:  cartItem.selectedColor  || '',
          selectedSize:   cartItem.selectedSize   || '',
          selectedFabric: cartItem.selectedFabric || '',
          image:          p.images?.[0] || ''
        });

        subtotal += unitPrice * cartItem.quantity;
      }
    }

    subtotal          = parseFloat(subtotal.toFixed(2));
    const totalAmount = parseFloat((subtotal + DELIVERY_CHARGE).toFixed(2));

    const order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress,
      subtotal,
      deliveryCharge: DELIVERY_CHARGE,
      totalAmount,
      paymentStatus:  'pending',
      deliveryStatus: 'placed'
    });

    await User.findByIdAndUpdate(req.user._id, { $push: { orderHistory: order._id } });

    // ── Initiate Khalti Payment (amount in PAISA = NPR * 100) ──
    const khaltiPayload = {
      return_url:          `${FRONTEND_URL}/payment/success`,
      website_url:         WEBSITE_URL,
      amount:              Math.round(totalAmount * 100),
      purchase_order_id:   order._id.toString(),
      purchase_order_name: `SHF Order #${order._id.toString().slice(-8).toUpperCase()}`,
      customer_info: {
        name:  shippingAddress.name,
        email: req.user.email,
        phone: shippingAddress.phone
      },
      amount_breakdown: [
        { label: 'Items',    amount: Math.round(subtotal * 100) },
        { label: 'Delivery', amount: Math.round(DELIVERY_CHARGE * 100) }
      ],
      product_details: items.map(i => ({
        identity:    i.product.toString(),
        name:        i.name,
        total_price: Math.round(i.price * i.quantity * 100),
        quantity:    i.quantity,
        unit_price:  Math.round(i.price * 100)
      }))
    };

    const khaltiRes = await axios.post(
      `${KHALTI_API_URL}epayment/initiate/`,
      khaltiPayload,
      { headers: khaltiHeaders(), timeout: 15000 }
    );

    const { pidx, payment_url } = khaltiRes.data;

    order.khaltiPidx = pidx;
    await order.save();

    return res.status(201).json({
      success: true,
      message: 'Order created. Redirecting to Khalti…',
      data: { orderId: order._id, khaltiPaymentUrl: payment_url, pidx }
    });

  } catch (error) {
    console.error('createOrder error:', error?.response?.data || error.message);
    const khaltiMsg = error?.response?.data?.detail || error?.response?.data?.error_key || null;
    res.status(500).json({ success: false, message: khaltiMsg || error.message || 'Failed to initiate payment' });
  }
};

// ─────────────────────────────────────────────
// @desc   Verify Khalti payment
// @route  POST /api/orders/verify
// @access Private
// ─────────────────────────────────────────────
exports.verifyKhaltiPayment = async (req, res) => {
  try {
    const { pidx } = req.body;

    if (!pidx) {
      return res.status(400).json({ success: false, message: 'pidx is required' });
    }

    const order = await Order.findOne({ khaltiPidx: pidx });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found for this payment' });
    }

    if (order.paymentStatus === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        data: { orderId: order._id, paymentStatus: 'completed', khaltiTransactionId: order.khaltiTransactionId, totalAmount: order.totalAmount }
      });
    }

    // ── Khalti Lookup API ──
    const lookupRes = await axios.post(
      `${KHALTI_API_URL}epayment/lookup/`,
      { pidx },
      { headers: khaltiHeaders(), timeout: 15000 }
    );

    const { status, transaction_id, total_amount, fee, mobile } = lookupRes.data;

    if (status === 'Completed') {
      order.paymentStatus       = 'completed';
      order.deliveryStatus      = 'placed';
      order.khaltiTransactionId = transaction_id || '';
      order.khaltiMobile        = mobile || '';
      await order.save();

      // Reduce stock
      const Product = require('../models/Product');
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
      }

      // Clear cart
      await User.findByIdAndUpdate(order.user, { $set: { cart: [] } });

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully!',
        data: {
          orderId:             order._id,
          paymentStatus:       'completed',
          deliveryStatus:      'placed',
          totalAmount:         order.totalAmount,
          khaltiTransactionId: transaction_id,
          fee:                 fee ? fee / 100 : 0
        }
      });

    } else if (status === 'Pending') {
      return res.status(200).json({
        success: false,
        message: 'Payment is still pending on Khalti. Please wait a moment and refresh.',
        data: { orderId: order._id, paymentStatus: 'pending' }
      });
    } else {
      order.paymentStatus = 'failed';
      await order.save();
      return res.status(200).json({
        success: false,
        message: `Payment ${status?.toLowerCase() || 'failed'}. Your cart is still intact.`,
        data: { orderId: order._id, paymentStatus: 'failed', khaltiStatus: status }
      });
    }

  } catch (error) {
    console.error('verifyKhaltiPayment error:', error?.response?.data || error.message);
    const khaltiMsg = error?.response?.data?.detail || null;
    res.status(500).json({ success: false, message: khaltiMsg || 'Verification failed. Please contact support.' });
  }
};

// ─────────────────────────────────────────────
// @desc   User's orders
// @route  GET /api/orders/my
// ─────────────────────────────────────────────
exports.getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name images price')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc   Single order
// @route  GET /api/orders/:id
// ─────────────────────────────────────────────
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images price category');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (req.user.role !== 'admin' && order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// @desc   Cancel an order (user)
// @route  PUT /api/orders/:id/cancel
// @access Private
// ─────────────────────────────────────────────
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Only the order owner may cancel
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    // Already cancelled
    if (order.deliveryStatus === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Order is already cancelled' });
    }

    // Cannot cancel once shipped or delivered
    if (order.deliveryStatus === 'shipped' || order.deliveryStatus === 'delivered') {
      return res.status(400).json({ success: false, message: 'Cannot cancel an order that has already been shipped or delivered' });
    }

    const wasCompleted = order.paymentStatus === 'completed';

    // Set cancellation fields
    order.deliveryStatus = 'cancelled';
    order.paymentStatus  = wasCompleted ? 'refunded' : 'cancelled';
    order.cancelReason   = req.body.reason || 'Cancelled by user';
    order.cancelledAt    = new Date();
    await order.save();

    // If order was paid, restore stock
    if (wasCompleted) {
      const Product = require('../models/Product');
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
      }
    }

    return res.status(200).json({
      success: true,
      message: wasCompleted
        ? 'Order cancelled. Stock restored. Refund will be processed within 5–7 business days.'
        : 'Order cancelled successfully.',
      data: { orderId: order._id, paymentStatus: order.paymentStatus, deliveryStatus: 'cancelled' }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────
exports.getAllOrders = async (req, res) => {
  try {
    const { paymentStatus, deliveryStatus, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (paymentStatus)  filter.paymentStatus  = paymentStatus;
    if (deliveryStatus) filter.deliveryStatus = deliveryStatus;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const revenueAgg   = await Order.aggregate([{ $match: { paymentStatus: 'completed' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    res.status(200).json({ success: true, count: orders.length, total, totalPages: Math.ceil(total / parseInt(limit)), currentPage: parseInt(page), totalRevenue: parseFloat(totalRevenue.toFixed(2)), data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { deliveryStatus, adminNote, trackingNumber } = req.body;
    const validStatuses = ['placed', 'processing', 'shipped', 'delivered'];

    if (!validStatuses.includes(deliveryStatus)) {
      return res.status(400).json({ success: false, message: `Invalid status. Choose: ${validStatuses.join(', ')}` });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.paymentStatus !== 'completed') return res.status(400).json({ success: false, message: 'Cannot update delivery status on unpaid order' });

    order.deliveryStatus = deliveryStatus;
    if (adminNote      !== undefined) order.adminNote      = adminNote;
    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
    await order.save();

    res.status(200).json({ success: true, message: `Status updated to "${deliveryStatus}"`, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchFilter = { role: 'user', ...(search && { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] }) };
    const total = await User.countDocuments(searchFilter);
    const users = await User.find(searchFilter).select('-password -passwordResetCodeHash -cart -wishlist').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const usersWithStats = await Promise.all(users.map(async (u) => {
      const orders = await Order.find({ user: u._id });
      const completed = orders.filter(o => o.paymentStatus === 'completed');
      const totalSpent = completed.reduce((s, o) => s + o.totalAmount, 0);
      return { ...u.toObject(), orderCount: orders.length, completedOrderCount: completed.length, totalSpent: parseFloat(totalSpent.toFixed(2)) };
    }));
    res.status(200).json({ success: true, count: users.length, total, totalPages: Math.ceil(total / parseInt(limit)), currentPage: parseInt(page), data: usersWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password -passwordResetCodeHash -cart -wishlist -orderHistory');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const orders = await Order.find({ user: req.params.userId }).populate('items.product', 'name images price category').sort({ createdAt: -1 });
    const completed  = orders.filter(o => o.paymentStatus === 'completed');
    const totalSpent = completed.reduce((s, o) => s + o.totalAmount, 0);
    res.status(200).json({ success: true, data: { user, orders, stats: { totalOrders: orders.length, completedOrders: completed.length, totalSpent: parseFloat(totalSpent.toFixed(2)) } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTransactionSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { paymentStatus: 'completed' };
    if (from || to) { filter.createdAt = {}; if (from) filter.createdAt.$gte = new Date(from); if (to) filter.createdAt.$lte = new Date(new Date(to).setHours(23,59,59,999)); }
    const transactions = await Order.find(filter).populate('user', 'name email phone').populate('items.product', 'name category').sort({ createdAt: -1 });
    const totalRevenue = transactions.reduce((s, t) => s + t.totalAmount, 0);
    const breakdown    = { placed: 0, processing: 0, shipped: 0, delivered: 0 };
    transactions.forEach(t => { if (breakdown[t.deliveryStatus] !== undefined) breakdown[t.deliveryStatus]++; });
    res.status(200).json({ success: true, data: { totalRevenue: parseFloat(totalRevenue.toFixed(2)), totalOrders: transactions.length, deliveryBreakdown: breakdown, transactions } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
