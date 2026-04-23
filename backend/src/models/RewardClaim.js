const mongoose = require('mongoose');

const rewardClaimSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rewardItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RewardItem',
    required: true
  },
  pointsSpent: {
    type: Number,
    required: true
  },

  // Delivery address provided by user at claim time
  shippingAddress: {
    name:    { type: String, default: '' },
    phone:   { type: String, default: '' },
    street:  { type: String, default: '' },
    city:    { type: String, default: '' },
    state:   { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: 'Nepal' }
  },

  // Mirrors the regular order delivery pipeline — no admin approval needed
  deliveryStatus: {
    type: String,
    enum: ['placed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'placed'
  },

  adminNote:      { type: String, default: '' },
  trackingNumber: { type: String, default: '' },
  cancelReason:   { type: String, default: '' },
  cancelledAt:    { type: Date,   default: null }

}, { timestamps: true });

rewardClaimSchema.index({ user: 1, createdAt: -1 });
rewardClaimSchema.index({ deliveryStatus: 1 });

module.exports = mongoose.model('RewardClaim', rewardClaimSchema);
