const mongoose = require('mongoose');

const festivalBannerSchema = new mongoose.Schema({
  festivalName: {
    type: String,
    required: true,
    enum: ['Dashain', 'Tihar', 'Chatt', 'Eid', 'Christmas', 'Custom'],
  },
  customFestivalName: {
    type: String, // used when festivalName === 'Custom'
    default: '',
  },
  title: {
    type: String,
    required: true,
    default: 'Festival Sale!',
  },
  subtitle: {
    type: String,
    default: 'Shop the best deals this festive season',
  },
  discountText: {
    type: String,
    required: true,
    default: 'Up to 50% Off',
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  colorTheme: {
    type: String,
    enum: ['red', 'gold', 'green', 'purple', 'blue', 'orange'],
    default: 'gold',
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  products: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
  ],
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
  },
}, { timestamps: true });

module.exports = mongoose.model('FestivalBanner', festivalBannerSchema);
