const mongoose = require('mongoose');

/**
 * ProductInteraction — lightweight event log for every meaningful user action
 * on a product (view, add-to-cart, wishlist-add).
 *
 * These events feed the trending score and collaborative-filtering logic inside
 * recommendationService.js without polluting the Product document itself with
 * unbounded arrays.
 */
const productInteractionSchema = new mongoose.Schema(
  {
    // Null for anonymous visitors
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    // Interaction type — determines weight in trending score
    type: {
      type: String,
      enum: ['view', 'cart_add', 'wishlist_add'],
      required: true,
    },
  },
  { timestamps: true }
);

// Aggregate per product + type (trending score queries)
productInteractionSchema.index({ product: 1, type: 1, createdAt: -1 });
// User-specific history for personalisation
productInteractionSchema.index({ user: 1, type: 1, createdAt: -1 });
// General recency window
productInteractionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ProductInteraction', productInteractionSchema);
