const FestivalBanner = require('../models/FestivalBanner');
const Product = require('../models/Product');

// @desc  Get all banners (admin)
// @route GET /api/festival
// @access Admin
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await FestivalBanner.find()
      .populate('products', 'name price images discount')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: banners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get single festival by ID (public)
// @route GET /api/festival/by-id/:id
// @access Public
exports.getBannerById = async (req, res) => {
  try {
    const banner = await FestivalBanner.findById(req.params.id)
      .populate('products', 'name price images discount category brand stock description isCustomizable ratings');
    if (!banner) return res.status(404).json({ success: false, message: 'Festival not found' });
    res.json({ success: true, data: banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get active banner (public)
// @route GET /api/festival/active
// @access Public
exports.getActiveBanner = async (req, res) => {
  try {
    const banner = await FestivalBanner.findOne({ isActive: true })
      .populate('products', 'name price images discount category brand stock');
    res.json({ success: true, data: banner || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get festival products (public)
// @route GET /api/festival/:id/products
// @access Public
exports.getFestivalProducts = async (req, res) => {
  try {
    const banner = await FestivalBanner.findById(req.params.id)
      .populate('products', 'name price images discount category brand stock description');
    if (!banner) return res.status(404).json({ success: false, message: 'Festival not found' });
    res.json({ success: true, data: banner.products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Create banner (admin)
// @route POST /api/festival
// @access Admin
exports.createBanner = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.discountPercent !== undefined) body.discountPercent = Number(body.discountPercent);
    const banner = await FestivalBanner.create(body);
    res.status(201).json({ success: true, data: banner });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc  Update banner (admin)
// @route PUT /api/festival/:id
// @access Admin
exports.updateBanner = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.discountPercent !== undefined) body.discountPercent = Number(body.discountPercent);
    // If setting this banner active, deactivate all others first
    if (body.isActive === true) {
      await FestivalBanner.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
    }
    const banner = await FestivalBanner.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    }).populate('products', 'name price images discount category brand stock');
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, data: banner });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc  Delete banner (admin)
// @route DELETE /api/festival/:id
// @access Admin
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await FestivalBanner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, message: 'Festival banner deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Add product to festival (admin)
// @route POST /api/festival/:id/products
// @access Admin
exports.addProduct = async (req, res) => {
  try {
    const { productId } = req.body;
    const banner = await FestivalBanner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });

    if (banner.products.includes(productId)) {
      return res.status(400).json({ success: false, message: 'Product already in festival' });
    }
    banner.products.push(productId);
    await banner.save();
    await banner.populate('products', 'name price images discount category brand stock');
    res.json({ success: true, data: banner });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc  Remove product from festival (admin)
// @route DELETE /api/festival/:id/products/:productId
// @access Admin
exports.removeProduct = async (req, res) => {
  try {
    const banner = await FestivalBanner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });

    banner.products = banner.products.filter(
      (p) => p.toString() !== req.params.productId
    );
    await banner.save();
    res.json({ success: true, message: 'Product removed from festival' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
