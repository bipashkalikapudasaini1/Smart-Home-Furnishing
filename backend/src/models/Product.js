const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a product name'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please provide a product description']
  },
  price: {
    type: Number,
    required: [true, 'Please provide a price'],
    min: 0
  },
  category: {
    type: String,
    required: [true, 'Please provide a category'],
    enum: ['Sofa', 'Chair', 'Table', 'Bed', 'Cabinet', 'Desk', 'Wardrobe', 'Shelf', 'Dining Set', 'Decor', 'Other']
  },
  brand: {
    type: String,
  },
  
  images: [{
    type: String,
    required: [true, 'Please provide product images']
  }],
  stock: {
    type: Number,
    required: [true, 'Please provide stock quantity'],
    min: 0,
    default: 0
  },
  // Customization options
  availableFabrics: [{
    type: String
  }],
  availableColors: [{
    type: String
  }],
  availableSizes: [{
    type: String
  }],
  
  // Material for filtering
 material: {
  type: String,
  required: [true, 'Please provide a material'],
  trim: true
},
  dimensions: {
    width: { type: Number },
    height: { type: Number },
    depth: { type: Number },
    unit: { type: String, default: 'cm' }
  },
  weight: {
    value: Number,
    unit: { type: String, default: 'kg' }
  },
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    createdAt: { type: Date, default: Date.now }
  }],
  featured: {
    type: Boolean,
    default: false
  },
  discount: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  isCustomizable: {
    type: Boolean,
    default: false
  },

  // ── Recommendation / Engagement Counters ─────────────────────────────────
  // These are incremented asynchronously and are intentionally denormalised
  // onto the Product document so trending queries need no expensive aggregation.

  // Total times this product appeared in a search result set
  searchCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Total page-view events (from ProductInteraction logs)
  viewCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Total units sold across all verified (paid) orders
  purchaseCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Pre-computed trending score: refreshed on every interaction
  // Formula: purchaseCount * 3 + viewCount * 0.5 + searchCount * 1
  trendingScore: {
    type: Number,
    default: 0,
    min: 0,
  },
}, {
  timestamps: true
});

// Index for search and filter optimization
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ brand: 1 });
// Recommendation engine indexes
productSchema.index({ trendingScore: -1 });
productSchema.index({ purchaseCount: -1 });
productSchema.index({ viewCount: -1 });

module.exports = mongoose.model('Product', productSchema);
