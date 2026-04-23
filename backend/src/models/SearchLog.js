const mongoose = require('mongoose');

/**
 * SearchLog — records every search query made on the platform.
 * Used by the recommendation engine to surface trending/popular search terms
 * and to power per-user personalized recommendations.
 */
const searchLogSchema = new mongoose.Schema(
  {
    // Null for anonymous (guest) visitors
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Normalised query string (lowercase, trimmed)
    query: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    // How many results came back (helps filter empty-result queries)
    resultsCount: {
      type: Number,
      default: 0,
    },
    // Category context if the search was done with a category filter active
    categoryContext: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Fast aggregate by query (most-searched terms)
searchLogSchema.index({ query: 1, createdAt: -1 });
// User-specific search history for personalisation
searchLogSchema.index({ user: 1, createdAt: -1 });
// Recency-based pruning / trending window
searchLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SearchLog', searchLogSchema);
