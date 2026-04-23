/**
 * aiRecommendationService.js
 * ════════════════════════════════════════════════════════════════════════════
 * AI-powered recommendation engine for Smart Home Furnishing.
 *
 * Implements three machine-learning / information-retrieval techniques:
 *
 *  1. USER-BASED COLLABORATIVE FILTERING  (Cosine Similarity)
 *     Finds users whose interaction histories resemble the current user's,
 *     then recommends products those similar users engaged with.
 *     Formula:  sim(u, v) = (u · v) / (‖u‖ × ‖v‖)
 *
 *  2. CONTENT-BASED FILTERING  (Feature Vectors + Cosine Similarity)
 *     Encodes every product as a numerical feature vector (category one-hot,
 *     price bucket, rating). Builds a user profile as the weighted average of
 *     the vectors of products they interacted with, then ranks unseen products
 *     by cosine similarity to that profile.
 *
 *  3. TF-IDF SEARCH RANKING  (Natural Language Processing)
 *     Re-ranks search results using Term Frequency × Inverse Document Frequency
 *     so the most relevant products float to the top regardless of insertion order.
 *     TF(t,d)  = occurrences(t, d) / totalTerms(d)
 *     IDF(t)   = log(1 + N / (1 + docsContaining(t)))
 *     Score(d) = Σ TF(t,d) × IDF(t)  for each query term t
 *
 *  4. HYBRID MODEL  (CF + Content-Based)
 *     Merges both scores: hybridScore = α·cfScore + (1-α)·cbScore + β·trending
 *     α adapts to the richness of the user's interaction history — CF dominates
 *     for active users; Content-Based takes over for cold-start (new) users.
 *
 *  5. ITEM-ITEM SIMILARITY  (for "Similar Products" on product detail pages)
 *     Combined score = 0.6 × contentSimilarity + 0.4 × coPurchaseFrequency
 * ════════════════════════════════════════════════════════════════════════════
 */

const mongoose         = require('mongoose');
const Product          = require('../models/Product');
const Order            = require('../models/Order');
const ProductInteraction = require('../models/ProductInteraction');

// ─── Configuration ───────────────────────────────────────────────────────────

/** Interaction type weights for building user vectors */
const WEIGHTS = { purchase: 5, cart_add: 3, view: 1 };

/** Cap view contribution per product to prevent gaming via repeated page loads */
const MAX_VIEW_SCORE = 5;

/** Product categories used for one-hot encoding (must match Product model enum) */
const CATEGORIES = [
  'Sofa', 'Chair', 'Table', 'Bed', 'Cabinet',
  'Desk', 'Wardrobe', 'Shelf', 'Dining Set', 'Decor', 'Other',
];

/** Price range breakpoints in NPR for one-hot bucket encoding */
const PRICE_BREAKS = [0, 5_000, 15_000, 30_000, 60_000, Infinity];

/** Look-back window for view / cart-add interactions */
const INTERACTION_WINDOW_DAYS = 90;

// ════════════════════════════════════════════════════════════════════════════
// §1  LINEAR ALGEBRA UTILITIES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Dot product of two SPARSE vectors represented as plain objects.
 * Only iterates over the shorter vector's keys for efficiency.
 */
const sparseDot = (v1, v2) => {
  const [small, large] =
    Object.keys(v1).length <= Object.keys(v2).length ? [v1, v2] : [v2, v1];
  let sum = 0;
  for (const k of Object.keys(small)) {
    if (large[k] !== undefined) sum += small[k] * large[k];
  }
  return sum;
};

/** L2 norm (Euclidean magnitude) of a sparse vector */
const sparseNorm = (v) =>
  Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0));

/**
 * Cosine similarity of two SPARSE vectors → [0, 1].
 * Returns 0 if either vector has zero magnitude.
 */
const cosineSimilaritySparse = (v1, v2) => {
  const n1 = sparseNorm(v1);
  const n2 = sparseNorm(v2);
  if (n1 === 0 || n2 === 0) return 0;
  return sparseDot(v1, v2) / (n1 * n2);
};

/**
 * Cosine similarity of two DENSE vectors (arrays of equal length) → [0, 1].
 */
const cosineSimilarityDense = (v1, v2) => {
  let dot = 0, n1 = 0, n2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    n1  += v1[i] * v1[i];
    n2  += v2[i] * v2[i];
  }
  if (n1 === 0 || n2 === 0) return 0;
  return dot / (Math.sqrt(n1) * Math.sqrt(n2));
};

/** Safely convert a string to a Mongoose ObjectId (returns null on failure) */
const toObjectId = (id) => {
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
};

// ════════════════════════════════════════════════════════════════════════════
// §2  USER INTERACTION VECTOR
// ════════════════════════════════════════════════════════════════════════════

/**
 * Build a weighted interaction vector for `userId`.
 *
 * Vector: { [productId]: interactionScore }
 *
 * interactionScore = purchaseQty × 5  +  cartAdds × 3  +  min(views, 5) × 1
 *
 * Purchases come from completed Orders (all time).
 * Views / cart-adds come from ProductInteraction (last 90 days).
 */
const buildUserVector = async (userId) => {
  const since = new Date(Date.now() - INTERACTION_WINDOW_DAYS * 86_400_000);

  const [orders, interactions] = await Promise.all([
    Order.find({ user: userId, paymentStatus: 'completed' })
      .select('items.product items.quantity')
      .lean(),
    ProductInteraction.find({ user: userId, createdAt: { $gte: since } })
      .select('product type')
      .lean(),
  ]);

  const vector    = {};
  const viewCount = {};

  // Purchases
  for (const order of orders) {
    for (const item of order.items) {
      const pid = item.product?.toString();
      if (pid) vector[pid] = (vector[pid] || 0) + item.quantity * WEIGHTS.purchase;
    }
  }

  // Views and cart-adds
  for (const ia of interactions) {
    const pid = ia.product?.toString();
    if (!pid) continue;
    if (ia.type === 'cart_add') {
      vector[pid] = (vector[pid] || 0) + WEIGHTS.cart_add;
    } else if (ia.type === 'view') {
      viewCount[pid] = (viewCount[pid] || 0) + 1;
    }
  }

  // Add capped view scores
  for (const [pid, cnt] of Object.entries(viewCount)) {
    vector[pid] = (vector[pid] || 0) + Math.min(cnt, MAX_VIEW_SCORE) * WEIGHTS.view;
  }

  return vector;
};

// ════════════════════════════════════════════════════════════════════════════
// §3  USER-BASED COLLABORATIVE FILTERING
// ════════════════════════════════════════════════════════════════════════════

/**
 * Retrieve top-K users (excluding `userId`) who have completed at least one
 * order, compute their cosine similarity to the target user, and return them
 * sorted by similarity descending.
 */
const findSimilarUsers = async (userId, targetVector, topK = 15) => {
  // Only consider users who've made a purchase (meaningful signal)
  const candidateIds = await Order.distinct('user', {
    user:          { $ne: userId },
    paymentStatus: 'completed',
  });

  const results = [];

  for (const uid of candidateIds) {
    const vec = await buildUserVector(uid.toString());
    if (Object.keys(vec).length === 0) continue;

    const sim = cosineSimilaritySparse(targetVector, vec);
    if (sim > 0) results.push({ userId: uid.toString(), similarity: sim, vector: vec });
  }

  return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
};

/**
 * Collaborative Filtering — returns { productId, cfScore } pairs.
 *
 * Predicted rating for unseen product p:
 *   r̂(u, p) = Σ sim(u,v)·r(v,p)  /  Σ sim(u,v)
 *              v∈N(u)                  v∈N(u), r(v,p)>0
 */
const getCollaborativeFilteringScores = async (userId, limit = 30) => {
  const targetVector = await buildUserVector(userId);
  if (Object.keys(targetVector).length === 0) return [];

  const similarUsers = await findSimilarUsers(userId, targetVector, 15);
  if (similarUsers.length === 0) return [];

  const scoreAcc  = {};   // weighted sum
  const simAcc    = {};   // sum of similarities (for normalisation)

  for (const { similarity, vector } of similarUsers) {
    for (const [pid, score] of Object.entries(vector)) {
      if (targetVector[pid]) continue;           // skip already-interacted products
      scoreAcc[pid] = (scoreAcc[pid] || 0) + similarity * score;
      simAcc[pid]   = (simAcc[pid]   || 0) + similarity;
    }
  }

  return Object.entries(scoreAcc)
    .map(([productId, s]) => ({ productId, cfScore: s / simAcc[productId] }))
    .sort((a, b) => b.cfScore - a.cfScore)
    .slice(0, limit);
};

// ════════════════════════════════════════════════════════════════════════════
// §4  CONTENT-BASED FILTERING
// ════════════════════════════════════════════════════════════════════════════

/**
 * Encode a product as a fixed-length dense feature vector:
 *
 *  Dimensions:
 *   [0 … 10]  Category one-hot  (11 dims — matches CATEGORIES array)
 *   [11 … 15] Price bucket one-hot  (5 dims — PRICE_BREAKS has 6 breakpoints)
 *   [16]      Normalised average rating  (1 dim, range [0, 1])
 *
 *  Total: 17 dimensions
 */
const buildProductVector = (product) => {
  // Category one-hot
  const catVec = CATEGORIES.map(c => (product.category === c ? 1 : 0));

  // Price bucket one-hot
  const finalPrice = product.discount
    ? product.price - (product.price * product.discount) / 100
    : product.price;
  const priceVec = PRICE_BREAKS.slice(0, -1).map(
    (lo, i) => (finalPrice >= lo && finalPrice < PRICE_BREAKS[i + 1] ? 1 : 0)
  );

  // Normalised rating
  const ratingVec = [(product.ratings?.average || 0) / 5];

  return [...catVec, ...priceVec, ...ratingVec];
};

/**
 * Construct the user's content profile as the interaction-weighted average
 * of the feature vectors of products they have engaged with.
 */
const buildContentProfile = (interactionVector, products) => {
  const dim     = CATEGORIES.length + (PRICE_BREAKS.length - 1) + 1; // 17
  const profile = new Array(dim).fill(0);
  let totalW    = 0;

  for (const product of products) {
    const w = interactionVector[product._id.toString()] || 0;
    if (w === 0) continue;
    const vec = buildProductVector(product);
    for (let i = 0; i < dim; i++) profile[i] += w * vec[i];
    totalW += w;
  }

  if (totalW > 0) {
    for (let i = 0; i < profile.length; i++) profile[i] /= totalW;
  }

  return profile;
};

/**
 * Content-Based Filtering — returns { productId, cbScore } pairs.
 */
const getContentBasedScores = async (userId, limit = 30) => {
  const interactionVector = await buildUserVector(userId);
  const interactedIds     = Object.keys(interactionVector);
  if (interactedIds.length === 0) return [];

  // Load products the user has already interacted with to build their profile
  const interactedProducts = await Product.find({ _id: { $in: interactedIds } })
    .select('category price discount ratings')
    .lean();

  const userProfile = buildContentProfile(interactionVector, interactedProducts);

  // Score all other in-stock products
  const excludeOids = interactedIds.map(toObjectId).filter(Boolean);
  const candidates  = await Product.find({
    stock: { $gt: 0 },
    _id:   { $nin: excludeOids },
  }).select('_id category price discount ratings').lean();

  return candidates
    .map(p => ({
      productId: p._id.toString(),
      cbScore:   cosineSimilarityDense(userProfile, buildProductVector(p)),
    }))
    .sort((a, b) => b.cbScore - a.cbScore)
    .slice(0, limit);
};

// ════════════════════════════════════════════════════════════════════════════
// §5  HYBRID RECOMMENDATION  (CF  +  Content-Based)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Merge Collaborative Filtering and Content-Based scores into a single ranking.
 *
 * Both score arrays are normalised to [0, 1] before merging so they are on
 * the same scale.
 *
 * α (CF weight) adapts based on richness of CF signal:
 *   - Many CF matches  → α = 0.60  (trust what similar users liked)
 *   - Few CF matches   → α = 0.20  (rely on content similarity instead)
 *
 * A small trending bonus (β = 0.10) keeps globally popular products visible.
 */
const getHybridRecommendations = async (userId, limit = 12) => {
  const [cfScores, cbScores] = await Promise.all([
    getCollaborativeFilteringScores(userId, 40),
    getContentBasedScores(userId, 40),
  ]);

  // Adaptive CF weight
  const cfWeight = cfScores.length >= 5 ? 0.60 : 0.20;
  const cbWeight = 1 - cfWeight - 0.10;   // 0.10 reserved for trending bonus

  // Normalise CF to [0, 1]
  const maxCF = Math.max(...cfScores.map(s => s.cfScore), 1);
  const cfMap  = Object.fromEntries(cfScores.map(s => [s.productId, s.cfScore / maxCF]));

  // Normalise CB to [0, 1]
  const maxCB = Math.max(...cbScores.map(s => s.cbScore), 1);
  const cbMap  = Object.fromEntries(cbScores.map(s => [s.productId, s.cbScore / maxCB]));

  // Union of all candidate IDs
  const allIds = [...new Set([...Object.keys(cfMap), ...Object.keys(cbMap)])];

  // Cold-start fallback — no interactions at all
  if (allIds.length === 0) {
    return Product.find({ stock: { $gt: 0 } })
      .sort({ trendingScore: -1 })
      .limit(limit)
      .select('name price discount images category brand ratings trendingScore purchaseCount')
      .lean();
  }

  // Fetch product metadata (we need trendingScore for the bonus)
  const candidates = await Product.find({
    stock: { $gt: 0 },
    _id:   { $in: allIds.map(toObjectId).filter(Boolean) },
  }).select('name price discount images category brand ratings trendingScore purchaseCount').lean();

  const maxTrending = Math.max(...candidates.map(p => p.trendingScore || 0), 1);

  const scored = candidates.map(product => {
    const pid          = product._id.toString();
    const hybridScore  =
      cfWeight  * (cfMap[pid]  || 0) +
      cbWeight  * (cbMap[pid]  || 0) +
      0.10      * ((product.trendingScore || 0) / maxTrending);

    return { product, hybridScore };
  });

  return scored
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, limit)
    .map(s => s.product);
};

// ════════════════════════════════════════════════════════════════════════════
// §6  TF-IDF SEARCH RANKING
// ════════════════════════════════════════════════════════════════════════════

/**
 * Tokenise text → lowercase alphanumeric words, stripping punctuation.
 */
const tokenise = (text = '') =>
  text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

/**
 * Re-rank an array of Product documents by TF-IDF relevance to `query`.
 *
 * The document for each product is:
 *   name (×2, double weight) + description + category + brand + material
 *
 * @param {Array}  products - Mongoose / plain product objects
 * @param {string} query    - Raw search string from the user
 * @returns {Array} Same product objects, sorted by tfidfScore descending
 */
const rankByTFIDF = (products, query) => {
  if (!products.length || !query) return products;

  const queryTerms = [...new Set(tokenise(query))];
  if (queryTerms.length === 0) return products;

  const N = products.length;

  // Build tokenised document per product
  // Doubling the name gives it twice the term-frequency contribution
  const docs = products.map(p =>
    tokenise(
      `${p.name} ${p.name} ${p.description || ''} ${p.category || ''} ` +
      `${p.brand || ''} ${p.material || ''}`
    )
  );

  // IDF: how rare is each query term across the corpus?
  const idf = {};
  for (const term of queryTerms) {
    const df   = docs.filter(d => d.includes(term)).length;
    idf[term]  = Math.log(1 + N / (1 + df));
  }

  // Score each product
  const scored = products.map((product, idx) => {
    const doc        = docs[idx];
    const totalTerms = doc.length || 1;
    let   tfidf      = 0;

    for (const term of queryTerms) {
      // TF: fraction of doc tokens that match the query term
      const tf = doc.filter(t => t === term).length / totalTerms;
      tfidf   += tf * (idf[term] || 0);
    }

    return { product, tfidf };
  });

  return scored
    .sort((a, b) => b.tfidf - a.tfidf)
    .map(s => s.product);
};

// ════════════════════════════════════════════════════════════════════════════
// §7  ITEM-ITEM SIMILARITY  (Similar Products)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Find products most similar to `productId` using a combined score:
 *
 *   similarity = 0.6 × contentSimilarity   (feature-vector cosine distance)
 *              + 0.4 × coPurchaseScore      (normalised co-purchase frequency)
 *
 * Content similarity captures structural product likeness (same category, price
 * tier, rating band); co-purchase frequency captures behavioural affinity
 * ("customers who bought X also bought Y").
 *
 * @param {string} productId
 * @param {number} limit
 * @returns {Array} Product lean objects sorted by similarity descending
 */
const getSimilarProducts = async (productId, limit = 6) => {
  const source = await Product.findById(productId)
    .select('category price discount ratings')
    .lean();
  if (!source) return [];

  const sourceVec = buildProductVector(source);

  // Co-purchase frequency
  const coOrders = await Order.find({
    'items.product': productId,
    paymentStatus:   'completed',
  }).select('items.product').lean();

  const coCount = {};
  for (const order of coOrders) {
    for (const item of order.items) {
      const pid = item.product?.toString();
      if (pid && pid !== productId) coCount[pid] = (coCount[pid] || 0) + 1;
    }
  }
  const maxCo = Math.max(...Object.values(coCount), 1);

  // Score all other in-stock products
  const candidates = await Product.find({
    stock: { $gt: 0 },
    _id:   { $ne: toObjectId(productId) },
  }).select('name price discount images category brand ratings trendingScore _id').lean();

  const scored = candidates.map(p => {
    const pid       = p._id.toString();
    const contSim   = cosineSimilarityDense(sourceVec, buildProductVector(p));
    const coPurchase = (coCount[pid] || 0) / maxCo;
    return { product: p, similarity: contSim * 0.6 + coPurchase * 0.4 };
  });

  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(s => s.product);
};

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  getHybridRecommendations,   // §5 — For You section
  rankByTFIDF,                // §6 — Search result re-ranking
  getSimilarProducts,         // §7 — Product detail page
  // Exposed for unit-testing / academic reporting:
  buildUserVector,
  getCollaborativeFilteringScores,
  getContentBasedScores,
  cosineSimilaritySparse,
  cosineSimilarityDense,
  buildProductVector,
};
