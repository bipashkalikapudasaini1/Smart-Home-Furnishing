const RewardItem  = require('../models/RewardItem');
const RewardClaim = require('../models/RewardClaim');
const User        = require('../models/User');

// ADMIN — Create a reward item (with image upload)
// POST /api/rewards
exports.createRewardItem = async (req, res) => {
  try {
    const { name, description, pointsRequired, stock } = req.body;
    if (!name || !pointsRequired) {
      return res.status(400).json({ success: false, message: 'Name and pointsRequired are required.' });
    }
    const image = req.file ? `/uploads/products/${req.file.filename}` : '';
    const item = await RewardItem.create({
      name,
      description: description || '',
      image,
      pointsRequired: parseInt(pointsRequired),
      stock: stock !== undefined ? parseInt(stock) : -1,
      isActive: true
    });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ADMIN — Update a reward item
// PUT /api/rewards/:id
exports.updateRewardItem = async (req, res) => {
  try {
    const { name, description, pointsRequired, stock, isActive } = req.body;
    const updates = {};
    if (name         !== undefined) updates.name           = name;
    if (description  !== undefined) updates.description    = description;
    if (pointsRequired !== undefined) updates.pointsRequired = parseInt(pointsRequired);
    if (stock        !== undefined) updates.stock          = parseInt(stock);
    if (isActive     !== undefined) updates.isActive       = isActive === 'true' || isActive === true;
    if (req.file)                   updates.image          = `/uploads/products/${req.file.filename}`;

    const item = await RewardItem.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Reward item not found.' });
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ADMIN — Delete a reward item
// DELETE /api/rewards/:id
exports.deleteRewardItem = async (req, res) => {
  try {
    await RewardItem.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Reward item deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ADMIN — Get all claims (with user + item info)
// GET /api/rewards/claims
exports.getAllClaims = async (req, res) => {
  try {
    const claims = await RewardClaim.find()
      .populate('user',       'name email phone')
      .populate('rewardItem', 'name image pointsRequired')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: claims });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ADMIN — Update claim status (fulfilled / rejected)
// PUT /api/rewards/claims/:claimId
exports.updateClaimStatus = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['pending', 'fulfilled', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const claim = await RewardClaim.findById(req.params.claimId);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });

    // If rejecting a previously pending/fulfilled claim → restore user points
    if (status === 'rejected' && claim.status !== 'rejected') {
      await User.findByIdAndUpdate(claim.user, { $inc: { rewardPoints: claim.pointsSpent } });
    }
    // If un-rejecting (pending/fulfilled) a previously rejected claim → re-deduct points
    if (claim.status === 'rejected' && status !== 'rejected') {
      await User.findByIdAndUpdate(claim.user, { $inc: { rewardPoints: -claim.pointsSpent } });
    }

    claim.status    = status;
    claim.adminNote = adminNote || claim.adminNote;
    await claim.save();

    res.status(200).json({ success: true, data: claim });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// PUBLIC / USER — Get all active reward items
// GET /api/rewards
exports.getRewardItems = async (req, res) => {
  try {
    const items = await RewardItem.find({ isActive: true }).sort({ pointsRequired: 1 });
    res.status(200).json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ADMIN — Get ALL reward items (including inactive)
// GET /api/rewards/admin/all
exports.getAllRewardItems = async (req, res) => {
  try {
    const items = await RewardItem.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// USER — Claim a reward item
// POST /api/rewards/:id/claim
exports.claimReward = async (req, res) => {
  try {
    const item = await RewardItem.findById(req.params.id);
    if (!item || !item.isActive) {
      return res.status(404).json({ success: false, message: 'Reward item not found or inactive.' });
    }

    const user = await User.findById(req.user._id);
    if (user.rewardPoints < item.pointsRequired) {
      return res.status(400).json({
        success: false,
        message: `You need ${item.pointsRequired} points to claim this. You have ${user.rewardPoints} points.`
      });
    }

    // Check stock
    if (item.stock !== -1 && item.stock <= 0) {
      return res.status(400).json({ success: false, message: 'This reward item is out of stock.' });
    }

    // Deduct points
    user.rewardPoints -= item.pointsRequired;
    await user.save();

    // Reduce stock if limited
    if (item.stock !== -1) {
      item.stock -= 1;
      await item.save();
    }

    // Create claim record
    const claim = await RewardClaim.create({
      user:        user._id,
      rewardItem:  item._id,
      pointsSpent: item.pointsRequired,
      status:      'pending'
    });

    res.status(201).json({
      success: true,
      message: `Successfully claimed "${item.name}"! Your request is pending admin approval.`,
      data: { claim, newPointsBalance: user.rewardPoints }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// USER — Get my claims
// GET /api/rewards/my-claims
exports.getMyClaims = async (req, res) => {
  try {
    const claims = await RewardClaim.find({ user: req.user._id })
      .populate('rewardItem', 'name image pointsRequired')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: claims });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
