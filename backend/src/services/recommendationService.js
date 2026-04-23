/**
 * recommendationService.js
 * ────────────────────────────────────────────────────────────────────────────
 * Core AI recommendation engine for Smart Home Furnishing.
 *
 * SCORING FORMULAE
 * ─────────────────
 * Trending Score (pre-computed on Product):
 *   trendingScore = purchaseCount * 3 + viewCount * 0.5 + searchCount * 1
 *
 * Personalised Score (computed on-demand per user):
 *   personalScore = categoryMatch * 5 + brandMatch * 3
 *                 + trendingScore * 0.5 + similarUsersBought * 4
 *                 + ratingBoost * 2
 *
 * Both formulae are designed to be ML-ready: each factor maps directly to a
 * feature that could later be fed into a proper ML model (e.g. LightGBM, TF).
 * ────────────────────────────────────────────────────────────────────────────
 */

const Product           = require('../models/Product');
const SearchLog         = require('../models/SearchLog');
const ProductInteraction = require('../models/ProductInteraction');
const Order             = require('../models/Order');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a map of { fieldValue → score } from a frequency array.
 * Higher score → stronger affinity.
 * @param {Array}  arr       - array of values (may have duplicates)
 * @param {number} maxScore  - score assigned to the most frequent value
 */
const buildAffinityMap = (arr, maxScore = 10) => {
  const freq = {};
  arr.forEach(v => { if (v) freq[v] = (freq[v] || 0) + 1; });
  const maxFreq = Math.max(...Object.values(freq), 1);
  const result = {};
  Object.entries(freq).forEach(([k, v]) => {
    result[k] = (v / maxFreq) * maxScore;
  });
  return result;
};

/**
 * Recency decay — returns a multiplier in [0.3, 1] based on how many days
 * ago something happened. Items from today get 1.0; 30-day-old items get ~0.3.
 * @param {Date} date
 */
const recencyDecay = (date) => {
  const daysAgo = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0.3, 1 - daysAgo / 30);
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * 1. TRENDING PRODUCTS
 *    Returns the top N products sorted by pre-computed trendingScore.
 *    Excludes out-of-stock items.
 */
const getTrendingProducts = async (limit = 8) => {
  return Product.find({ stock: { $gt: 0 } })
    .sort({ trendingScore: -1, purchaseCount: -1, createdAt: -1 })
    .limit(limit)
    .select('name price discount images category brand ratings trendingScore purchaseCount');
};

/**
 * 2. MOST SEARCHED TERMS
 *    Aggregates SearchLog over the last 30 days, returns top queries
 *    that had at least one result.
 */
const getMostSearchedTerms = async (limit = 8) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const results = await SearchLog.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        resultsCount: { $gt: 0 },
        query: { $ne: '' },
      },
    },
    {
      $group: {
        _id: '$query',
        count: { $sum: 1 },
        lastSearched: { $max: '$createdAt' },
      },
    },
    // Apply recency weight: count * decay based on last time it was searched
    {
      $addFields: {
        score: {
          $multiply: [
            '$count',
            { $max: [0.3, { $subtract: [1, { $divide: [{ $divide: [{ $subtract: [new Date(), '$lastSearched'] }, 1000 * 60 * 60 * 24] }, 30] }] }] }
          ],
        },
      },
    },
    { $sort: { score: -1 } },
    { $limit: limit },
    { $project: { _id: 0, term: '$_id', count: 1, score: 1 } },
  ]);

  return results;
};

/**
 * 3. MOST BOUGHT PRODUCTS
 *    Returns the top N products sorted by purchaseCount.
 */
const getMostBoughtProducts = async (limit = 8) => {
  return Product.find({ stock: { $gt: 0 }, purchaseCount: { $gt: 0 } })
    .sort({ purchaseCount: -1, ratings: -1 })
    .limit(limit)
    .select('name price discount images category brand ratings purchaseCount');
};

/**
 * 4. AUTOCOMPLETE SUGGESTIONS
 *    Combines:
 *    (a) product name search — flexible multi-word matching
 *    (b) popular past searches matching the input
 *
 *    Uses the same three-strategy approach as the main search so that
 *    "bed sheet" (space) and "bedsheet" (no space) both surface the same
 *    products regardless of how the product name was entered in the DB.
 */
const getAutocompleteSuggestions = async (query, { productLimit = 5, termLimit = 4 } = {}) => {
  if (!query || query.trim().length < 1) return { products: [], terms: [] };

  const q     = query.trim();
  const esc   = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const terms = q.split(/\s+/).filter(Boolean);

  // ── Build flexible name-match query ──────────────────────────────────────
  let nameQuery;
  if (terms.length === 1) {
    // Single token: simple substring match
    nameQuery = { name: { $regex: esc(terms[0]), $options: 'i' } };
  } else {
    // Multi-word: exact phrase | no-space version | all words anywhere in name
    const exactPat   = esc(terms.join(' '));  // "bed sheet"
    const noSpacePat = esc(terms.join(''));   // "bedsheet"
    nameQuery = {
      $or: [
        { name: { $regex: exactPat,   $options: 'i' } },
        { name: { $regex: noSpacePat, $options: 'i' } },
        { $and: terms.map(t => ({ name: { $regex: esc(t), $options: 'i' } })) },
      ],
    };
  }

  // ── Past search terms: match any of the typed words ──────────────────────
  const termMatchCondition = terms.length === 1
    ? { query: { $regex: esc(terms[0]), $options: 'i' } }
    : { $or: terms.map(t => ({ query: { $regex: esc(t), $options: 'i' } })) };

  const [products, termDocs] = await Promise.all([
    Product.find({ ...nameQuery, stock: { $gt: 0 } })
      .sort({ trendingScore: -1 })
      .limit(productLimit)
      .select('name price discount images category brand trendingScore'),

    SearchLog.aggregate([
      {
        $match: {
          ...termMatchCondition,
          resultsCount: { $gt: 0 },
        },
      },
      { $group: { _id: '$query', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: termLimit },
      { $project: { _id: 0, term: '$_id', count: 1 } },
    ]),
  ]);

  return { products, terms: termDocs };
};

/**
 * 5. PERSONALISED RECOMMENDATIONS (For You)
 *    Multi-signal scoring for a specific logged-in user:
 *
 *    Signal A – Category affinity: categories the user has searched / bought
 *    Signal B – Brand affinity:    brands they've purchased
 *    Signal C – Trending boost:    product's own trendingScore
 *    Signal D – Collaborative:     products bought by users who bought the
 *                                  same items as this user (simplified CF)
 *    Signal E – Rating quality:    reward highly-rated products
 *
 *    Products already purchased by the user are excluded.
 */
const getPersonalisedRecommendations = async (userId, limit = 12) => {
  // ── Gather user signals ─────────────────────────────────────────────────

  // A. User's recent searches (last 90 days)
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const searchHistory = await SearchLog.find({
    user: userId,
    createdAt: { $gte: since90 },
  }).select('query categoryContext').limit(200);

  // B. User's purchase history (completed orders)
  const purchasedOrders = await Order.find({
    user: userId,
    paymentStatus: 'completed',
  })
    .populate('items.product', 'category brand _id')
    .select('items');

  const purchasedProductIds = new Set();
  const purchasedCategories = [];
  const purchasedBrands     = [];

  purchasedOrders.forEach(order => {
    order.items.forEach(item => {
      if (item.product) {
        purchasedProductIds.add(item.product._id.toString());
        purchasedCategories.push(item.product.category);
        purchasedBrands.push(item.product.brand);
      }
    });
  });

  // C. User's view / cart-add interactions
  const viewInteractions = await ProductInteraction.find({
    user: userId,
    type: { $in: ['view', 'cart_add'] },
    createdAt: { $gte: since90 },
  })
    .populate('product', 'category brand')
    .select('product type createdAt')
    .limit(200);

  const viewedCategories = viewInteractions.map(i => i.product?.category).filter(Boolean);
  const viewedBrands     = viewInteractions.map(i => i.product?.brand).filter(Boolean);

  // Build weighted affinity maps
  const searchTerms        = searchHistory.map(s => s.query);
  const allCategories      = [...purchasedCategories, ...viewedCategories, ...searchHistory.map(s => s.categoryContext).filter(Boolean)];
  const allBrands          = [...purchasedBrands, ...viewedBrands];

  const categoryAffinity   = buildAffinityMap(allCategories, 10);
  const brandAffinity      = buildAffinityMap(allBrands,    10);

  // ── Collaborative filtering (simplified) ────────────────────────────────
  // Find other users who bought the same products, then collect what else they bought
  let collaborativeProductIds = [];

  if (purchasedProductIds.size > 0) {
    const productIdArray = Array.from(purchasedProductIds);

    // Users who share at least one purchased product
    const similarUserOrders = await Order.find({
      paymentStatus: 'completed',
      user: { $ne: userId },
      'items.product': { $in: productIdArray },
    })
      .select('items.product')
      .limit(50);

    const coOccurrence = {};
    similarUserOrders.forEach(order => {
      order.items.forEach(item => {
        const pid = item.product?.toString();
        if (pid && !purchasedProductIds.has(pid)) {
          coOccurrence[pid] = (coOccurrence[pid] || 0) + 1;
        }
      });
    });

    // Top 20 collaboratively recommended product IDs
    collaborativeProductIds = Object.entries(coOccurrence)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id]) => id);
  }

  // ── Score all candidate products ────────────────────────────────────────

  // Determine top category (for fallback when user is new)
  const topCategory = Object.entries(categoryAffinity).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Fetch candidate products (exclude out-of-stock and already purchased)
  const excludeIds = Array.from(purchasedProductIds);

  // If user has category preferences, bias the pool; otherwise use trending
  let query = { stock: { $gt: 0 } };
  if (excludeIds.length > 0) {
    const mongoose = require('mongoose');
    query._id = { $nin: excludeIds.map(id => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } }).filter(Boolean) };
  }

  const candidates = await Product.find(query)
    .sort({ trendingScore: -1 })
    .limit(80)
    .select('name price discount images category brand ratings trendingScore purchaseCount viewCount');

  // Score each candidate
  const scored = candidates.map(product => {
    const pid = product._id.toString();

    // Signal A: Category affinity
    const catScore  = categoryAffinity[product.category] || 0;

    // Signal B: Brand affinity
    const brandScore = brandAffinity[product.brand] || 0;

    // Signal C: Trending
    const trendScore = Math.log1p(product.trendingScore) * 0.5;

    // Signal D: Collaborative filtering
    const collabScore = collaborativeProductIds.includes(pid) ? 4 : 0;

    // Signal E: Rating quality
    const ratingScore = (product.ratings?.average || 0) > 4 ? 2 : 0;

    // Signal F: Name relevance to search history (keyword match)
    const nameRelevance = searchTerms.some(term =>
      product.name.toLowerCase().includes(term) ||
      product.category.toLowerCase().includes(term)
    ) ? 2 : 0;

    const totalScore = catScore * 5 + brandScore * 3 + trendScore + collabScore + ratingScore + nameRelevance;

    return { product, score: totalScore };
  });

  // Sort by score descending, return top N
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.product);
};

/**
 * 6. UPDATE TRENDING SCORE (utility — called after each interaction)
 *    Recomputes and persists the trendingScore on a Product document.
 */
const refreshTrendingScore = async (productId) => {
  try {
    const product = await Product.findById(productId).select('purchaseCount viewCount searchCount');
    if (!product) return;

    const score =
      (product.purchaseCount || 0) * 3 +
      (product.viewCount     || 0) * 0.5 +
      (product.searchCount   || 0) * 1;

    await Product.findByIdAndUpdate(productId, { trendingScore: parseFloat(score.toFixed(4)) });
  } catch (err) {
    // Non-critical — log and swallow
    console.error('refreshTrendingScore error:', err.message);
  }
};

module.exports = {
  getTrendingProducts,
  getMostSearchedTerms,
  getMostBoughtProducts,
  getAutocompleteSuggestions,
  getPersonalisedRecommendations,
  refreshTrendingScore,
};
