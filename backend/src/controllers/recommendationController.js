/**
* recommendationController.js
* HTTP handlers for the AI recommendation system.
* All endpoints are intentionally non-blocking for the analytics writes —
* the response is sent immediately and the DB update runs in the background.
*/
const Product            = require('../models/Product');
const ProductInteraction = require('../models/ProductInteraction');
const recommendationService   = require('../services/recommendationService');
const aiRecommendationService = require('../services/aiRecommendationService');

//  Search / Discovery Endpoints 

/**
 * GET /api/recommendations/trending
 * Returns the top trending products by pre-computed trendingScore.
 * Public — no auth required.
 */
exports.getTrending = async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit) || 8, 20);
    const products = await recommendationService.getTrendingProducts(limit);

    res.status(200).json({
      success: true,
      count:   products.length,
      data:    products,
    });
  } catch (error) {
    console.error('getTrending error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/recommendations/most-searched
 * Returns the most frequently searched terms in the last 30 days.
 * Public — no auth required.
 */
exports.getMostSearched = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 8, 20);
    const terms  = await recommendationService.getMostSearchedTerms(limit);

    res.status(200).json({
      success: true,
      count:   terms.length,
      data:    terms,
    });
  } catch (error) {
    console.error('getMostSearched error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/recommendations/most-bought
 * Returns the best-selling products (highest purchaseCount).
 * Public — no auth required.
 */
exports.getMostBought = async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit) || 8, 20);
    const products = await recommendationService.getMostBoughtProducts(limit);

    res.status(200).json({
      success: true,
      count:   products.length,
      data:    products,
    });
  } catch (error) {
    console.error('getMostBought error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/recommendations/autocomplete?q=<query>
 * Smart autocomplete: returns matching product names + popular past search terms.
 * Public — no auth required.
 */
exports.getAutocomplete = async (req, res) => {
  try {
    const query = (req.query.q || '').trim();

    if (!query) {
      return res.status(200).json({ success: true, data: { products: [], terms: [] } });
    }

    const results = await recommendationService.getAutocompleteSuggestions(query, {
      productLimit: parseInt(req.query.productLimit) || 5,
      termLimit:    parseInt(req.query.termLimit)    || 4,
    });

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('getAutocomplete error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/recommendations/for-you
 * Returns personalised product recommendations for the logged-in user.
 * Uses the Hybrid AI model (Collaborative Filtering + Content-Based Filtering +
 * Trending boost) from aiRecommendationService.
 * Protected — JWT required.
 */
exports.getForYou = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 12, 24);

    //  Trying Hybrid AI recommendations first 
    // getHybridRecommendations combines:
    //   • User-based Collaborative Filtering (cosine similarity on sparse vectors)
    //   • Content-Based Filtering (17-dim feature vectors)
    //   • Trending score boost
    // Falls back to rule-based scoring if the user has no interaction history.
    let products = [];
    try {
      products = await aiRecommendationService.getHybridRecommendations(req.user._id, limit);
    } catch (aiErr) {
      console.warn('AI recommendation failed, falling back to rule-based:', aiErr.message);
      products = await recommendationService.getPersonalisedRecommendations(req.user._id, limit);
    }

    // If still empty (new user with no history), fall back to trending products (max 8)
    if (!products || products.length === 0) {
      products = await recommendationService.getTrendingProducts(Math.min(limit, 8));
    }

    // Always cap at 8 for new users with no real personalisation yet
    products = products.slice(0, 8);

    res.status(200).json({
      success: true,
      count:   products.length,
      data:    products,
      // Meta exposed to client (useful for FYP demo / debugging)
      meta: {
        algorithm: 'hybrid-cf-cb-trending',
        version:   '1.0',
      },
    });
  } catch (error) {
    console.error('getForYou error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/recommendations/similar/:productId
 * Returns products similar to the given product.
 * Uses Item-Item similarity: 60% content-based cosine similarity + 40% co-purchase.
 * Public — no auth required.
 */
exports.getSimilarProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 6, 12);

    // Validate that the product exists
    const exists = await Product.exists({ _id: productId });
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const products = await aiRecommendationService.getSimilarProducts(productId, limit);

    res.status(200).json({
      success: true,
      count:   products.length,
      data:    products,
      meta: {
        algorithm: 'item-item-content-copurchase',
        version:   '1.0',
      },
    });
  } catch (error) {
    console.error('getSimilarProducts error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

//  Interaction Tracking Endpoints 

/**
 * POST /api/recommendations/log-view
 * Logs a product page view and increments viewCount + trendingScore.
 * Optional auth — works for guests too.
 * Body: { productId }
 */
exports.logView = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }

    // Respond immediately — don't block the client
    res.status(200).json({ success: true });

    // ── Background: record interaction + update counters ──────────────────
    setImmediate(async () => {
      try {
        await ProductInteraction.create({
          user:    req.user?._id || null,
          product: productId,
          type:    'view',
        });

        await Product.findByIdAndUpdate(productId, { $inc: { viewCount: 1 } });
        await recommendationService.refreshTrendingScore(productId);
      } catch (err) {
        console.error('logView background error:', err.message);
      }
    });
  } catch (error) {
    console.error('logView error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/recommendations/log-cart-add
 * Logs an add-to-cart event.
 * Optional auth.
 * Body: { productId }
 */
exports.logCartAdd = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }

    res.status(200).json({ success: true });

    setImmediate(async () => {
      try {
        await ProductInteraction.create({
          user:    req.user?._id || null,
          product: productId,
          type:    'cart_add',
        });
      } catch (err) {
        console.error('logCartAdd background error:', err.message);
      }
    });
  } catch (error) {
    console.error('logCartAdd error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
