const mongoose = require('mongoose');

const rewardItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Reward item name is required'],
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: ''   // stored as /uploads/products/filename.jpg
  },
  pointsRequired: {
    type: Number,
    required: [true, 'Points required to claim this item is required'],
    min: 1
  },
  stock: {
    type: Number,
    default: -1   // -1 = unlimited
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('RewardItem', rewardItemSchema);
