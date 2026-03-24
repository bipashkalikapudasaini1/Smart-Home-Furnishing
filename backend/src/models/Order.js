const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name:           { type: String, required: true },
  price:          { type: Number, required: true },
  quantity:       { type: Number, required: true, min: 1 },
  selectedColor:  { type: String, default: '' },
  selectedSize:   { type: String, default: '' },
  selectedFabric: { type: String, default: '' },
  image:          { type: String, default: '' }
}, { _id: true });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],

  // Shipping / Billing Address
  shippingAddress: {
    name:    { type: String, required: true },
    phone:   { type: String, required: true },
    street:  { type: String, required: true },
    city:    { type: String, required: true },
    state:   { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: 'Nepal' }
  },

  // Pricing
  subtotal:       { type: Number, required: true },
  deliveryCharge: { type: Number, default: 500 },
  totalAmount:    { type: Number, required: true },

  // Khalti payment details
  khaltiPidx:          { type: String, default: '' }, // Khalti payment identifier (pidx)
  khaltiTransactionId: { type: String, default: '' }, // Khalti transaction_id after payment
  khaltiMobile:        { type: String, default: '' }, // payer's Khalti-registered mobile

  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },

  // 4-stage delivery tracking + cancellation
  deliveryStatus: {
    type: String,
    enum: ['placed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'placed'
  },

  cancelReason: { type: String, default: '' },
  cancelledAt:  { type: Date, default: null },

  adminNote:      { type: String, default: '' },
  trackingNumber: { type: String, default: '' }

}, { timestamps: true });

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ deliveryStatus: 1 });
orderSchema.index({ khaltiPidx: 1 });

module.exports = mongoose.model('Order', orderSchema);
