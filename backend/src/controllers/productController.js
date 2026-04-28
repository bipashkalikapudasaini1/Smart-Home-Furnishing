const Product            = require('../models/Product');
const SearchLog          = require('../models/SearchLog');
const { refreshTrendingScore } = require('../services/recommendationService');
const { rankByTFIDF }          = require('../services/aiRecommendationService');

// @desc    Get all products with filters
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      brand,
      material,
      color,
      fabric,
      size,
      search,
      sort = '-createdAt',
      page = 1,
      limit = 12
    } = req.query;

    // Build query object
    let query = {};

    // Category filter
    if (category) {
      query.category = category;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Brand filter
    if (brand) {
      query.brand = brand;
    }

    // Material filter
    if (material) {
      query.material = material;
    }

    // Color filter
    if (color) {
      query.availableColors = { $in: [color] };
    }

    // Fabric filter
    if (fabric) {
      query.availableFabrics = { $in: [fabric] };
    }

    //  Flexible multi-word search 
    // Problem with MongoDB $text: it tokenises by whitespace, so "bed sheet"
    // never matches a product named "Bedsheet" (one token), and "bedsheet"
    // never matches "Bed Sheet" (two tokens).
    //
    // Strategy — try all three patterns so spacing differences are bridged:
    //   1. Exact phrase   : /bed sheet/i  → "Bed Sheet"
    //   2. No-space join  : /bedsheet/i   → "Bedsheet"
    //   3. All words AND  : /bed/i & /sheet/i anywhere in name/description
    if (search) {
      const esc   = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const terms = search.trim().split(/\s+/).filter(Boolean);

      if (terms.length === 1) {
        // Single word — simple contains across name, description, category, brand
        const pat = esc(terms[0]);
        query.$or = [
          { name:        { $regex: pat, $options: 'i' } },
          { description: { $regex: pat, $options: 'i' } },
          { category:    { $regex: pat, $options: 'i' } },
          { brand:       { $regex: pat, $options: 'i' } },
        ];
      } else {
        // Multi-word: run all three strategies in a single $or
        const exactPat   = esc(terms.join(' '));   // "bed sheet"
        const noSpacePat = esc(terms.join(''));     // "bedsheet"
        // Every word must appear somewhere in the name (order-independent)
        const allWordsInName = {
          $and: terms.map(t => ({ name: { $regex: esc(t), $options: 'i' } })),
        };
        // Every word must appear somewhere in the description (fallback)
        const allWordsInDesc = {
          $and: terms.map(t => ({ description: { $regex: esc(t), $options: 'i' } })),
        };

        query.$or = [
          { name: { $regex: exactPat,   $options: 'i' } },  // "Bed Sheet" exact
          { name: { $regex: noSpacePat, $options: 'i' } },  // "Bedsheet" one-word
          allWordsInName,                                     // "Bed" AND "Sheet" anywhere
          allWordsInDesc,                                     // description fallback
        ];
      }
    }

    // Execute query
    let products = await Product.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    //  TF-IDF Re-ranking for search queries 
    // When the user has typed a search query, re-rank the MongoDB results by
    // TF-IDF relevance score so that the most semantically relevant products
    // appear first rather than just the most recently added ones.
    //
    // TF-IDF Formula (implemented in aiRecommendationService.rankByTFIDF):
    //   TF(t,d)  = occurrences of term t in document d / total terms in d
    //   IDF(t)   = log(1 + N / (1 + df(t)))   [smoothed, avoids ÷0]
    //   score(d) = Σ TF(t,d) × IDF(t)  for each query term t
    // Product name is weighted 2× by duplicating it in the "document".
    if (search && search.trim() && products.length > 1) {
      try {
        products = rankByTFIDF(products, search.trim());
      } catch (tfidfErr) {
        // Non-critical — if TF-IDF fails, keep original MongoDB order
        console.warn('TF-IDF re-ranking skipped:', tfidfErr.message);
      }
    }

    // Get total count for pagination
    const count = await Product.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      data: products
    });

    //  Background: log search & update searchCount on matched products 
    // This runs after the response is sent so the client is never delayed.
    if (search && search.trim()) {
      setImmediate(async () => {
        try {
          // Extract optional user id from the Authorization header (soft auth)
          let userId = null;
          const authHeader = req.headers?.authorization;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const jwt = require('jsonwebtoken');
            try {
              const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
              userId = decoded?.id || null;
            } catch (_) { /* ignore invalid tokens */ }
          }

          await SearchLog.create({
            user:            userId,
            query:           search.trim().toLowerCase(),
            resultsCount:    products.length,
            categoryContext: category || null,
          });

          // Increment searchCount on the returned products (non-blocking)
          if (products.length > 0) {
            const productIds = products.map(p => p._id);
            await Product.updateMany(
              { _id: { $in: productIds } },
              { $inc: { searchCount: 1 } }
            );
            // Refresh trendingScore for each affected product
            for (const pid of productIds) {
              await refreshTrendingScore(pid);
            }
          }
        } catch (err) {
          console.error('Search logging error:', err.message);
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('reviews.user', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper — parse a comma-separated or array field from FormData
const parseArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(v => v.split(',').map(s => s.trim())).filter(Boolean);
  return value.split(',').map(s => s.trim()).filter(Boolean);
};

// @desc    Create new product
// @route   POST /api/products  (multipart/form-data)
// @access  Private/Admin
exports.createProduct = async (req, res) => {
  try {
    const body = req.body;

    // Build image list from uploaded files
    const uploadedImages = (req.files || []).map(
      f => `/uploads/products/${f.filename}`
    );

    const productData = {
      name: body.name,
      description: body.description,
      price: Number(body.price),
      category: body.category,
      brand: body.brand || '',
      material: body.material,
      stock: Number(body.stock),
      discount: Number(body.discount) || 0,
      isCustomizable: body.isCustomizable === 'true' || body.isCustomizable === true,
      images: uploadedImages,
      availableColors: parseArray(body.availableColors),
      availableFabrics: parseArray(body.availableFabrics),
      availableSizes: parseArray(body.availableSizes),
    };

    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id  (multipart/form-data)
// @access  Private/Admin
exports.updateProduct = async (req, res) => {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const body = req.body;

    // New uploaded files
    const newImages = (req.files || []).map(
      f => `/uploads/products/${f.filename}`
    );

    // Existing image URLs the admin chose to keep (sent as existingImages[])
    const keptImages = parseArray(body.existingImages);

    // Final image list = kept existing + newly uploaded
    const finalImages = [...keptImages, ...newImages];

    const updateData = {
      name: body.name,
      description: body.description,
      price: Number(body.price),
      category: body.category,
      brand: body.brand || '',
      material: body.material,
      stock: Number(body.stock),
      discount: Number(body.discount) || 0,
      isCustomizable: body.isCustomizable === 'true' || body.isCustomizable === true,
      images: finalImages,
      availableColors: parseArray(body.availableColors),
      availableFabrics: parseArray(body.availableFabrics),
      availableSizes: parseArray(body.availableSizes),
    };

    product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get filter options
// @route   GET /api/products/filters/options
// @access  Public
exports.getFilterOptions = async (req, res) => {
  try {
    const brands = await Product.distinct('brand');
    const materials = await Product.distinct('material');
    const categories = await Product.distinct('category');
    const colors = await Product.distinct('availableColors');
    const fabrics = await Product.distinct('availableFabrics');

    const priceRange = await Product.aggregate([
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        brands,
        materials,
        categories,
        colors,
        fabrics,
        priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
