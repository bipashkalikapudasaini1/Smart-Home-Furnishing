const RewardItem  = require('../models/RewardItem');
const RewardClaim = require('../models/RewardClaim');
const User        = require('../models/User');

// ADMIN — Create a reward item (with image upload)
// POST /api/rewards
exports.createRewardItem = async (req, res) => {
  try {
    const { name, description, pointsRequired, stock, isActive } = req.body;
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
      isActive: isActive === 'false' || isActive === false ? false : true
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
    if (name           !== undefined) updates.name           = name;
    if (description    !== undefined) updates.description    = description;
    if (pointsRequired !== undefined) updates.pointsRequired = parseInt(pointsRequired);
    if (stock          !== undefined) updates.stock          = parseInt(stock);
    if (isActive       !== undefined) updates.isActive       = isActive === 'true' || isActive === true;
    if (req.file)                     updates.image          = `/uploads/products/${req.file.filename}`;

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

// ADMIN — Update claim delivery status
// PUT /api/rewards/claims/:claimId/delivery
// body: { deliveryStatus, adminNote?, trackingNumber? }
//
// Mirrors orderController.updateDeliveryStatus.
// If admin cancels a claim → user points + stock are restored automatically.
exports.updateClaimDelivery = async (req, res) => {
  try {
    const { deliveryStatus, adminNote, trackingNumber } = req.body;
    const validStatuses = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(deliveryStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Choose: ${validStatuses.join(', ')}`
      });
    }

    const claim = await RewardClaim.findById(req.params.claimId);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });

    const wasAlreadyCancelled = claim.deliveryStatus === 'cancelled';

    // ── Admin is CANCELLING a non-cancelled claim ─────────────────────────────
    if (deliveryStatus === 'cancelled' && !wasAlreadyCancelled) {
      // Restore points
      await User.findByIdAndUpdate(claim.user, { $inc: { rewardPoints: claim.pointsSpent } });
      // Restore stock (if limited)
      const item = await RewardItem.findById(claim.rewardItem);
      if (item && item.stock !== -1) {
        item.stock += 1;
        await item.save();
      }
      claim.cancelledAt  = new Date();
      claim.cancelReason = adminNote || 'Cancelled by admin';
    }

    // ── Admin is UN-CANCELLING (moving back to a delivery stage) ──────────────
    if (wasAlreadyCancelled && deliveryStatus !== 'cancelled') {
      const userDoc = await User.findById(claim.user);
      if (!userDoc || userDoc.rewardPoints < claim.pointsSpent) {
        return res.status(400).json({
          success: false,
          message: "User no longer has enough points to re-activate this claim."
        });
      }
      await User.findByIdAndUpdate(claim.user, { $inc: { rewardPoints: -claim.pointsSpent } });
      const item = await RewardItem.findById(claim.rewardItem);
      if (item && item.stock !== -1) {
        if (item.stock <= 0) {
          return res.status(400).json({ success: false, message: 'Reward item is out of stock.' });
        }
        item.stock -= 1;
        await item.save();
      }
      claim.cancelledAt  = null;
      claim.cancelReason = '';
    }

    claim.deliveryStatus = deliveryStatus;
    if (adminNote      !== undefined) claim.adminNote      = adminNote;
    if (trackingNumber !== undefined) claim.trackingNumber = trackingNumber;
    await claim.save();

    res.status(200).json({
      success: true,
      message: `Delivery status updated to "${deliveryStatus}"`,
      data: claim
    });
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
// body: { shippingAddress: { name, phone, street, city } }
//
// Points are deducted immediately. Claim is placed with deliveryStatus='placed'.
// No admin approval step — admin manages delivery just like a regular order.
exports.claimReward = async (req, res) => {
  try {
    const { shippingAddress } = req.body;

    // Validate shipping address
    if (
      !shippingAddress?.name  ||
      !shippingAddress?.phone ||
      !shippingAddress?.street ||
      !shippingAddress?.city
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required delivery fields (Name, Phone, Street, City).'
      });
    }

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

    // Deduct points immediately
    user.rewardPoints -= item.pointsRequired;
    await user.save();

    // Reduce stock if limited
    if (item.stock !== -1) {
      item.stock -= 1;
      await item.save();
    }

    // Create claim — auto-placed, no admin approval needed
    const claim = await RewardClaim.create({
      user:            user._id,
      rewardItem:      item._id,
      pointsSpent:     item.pointsRequired,
      shippingAddress: {
        name:    shippingAddress.name.trim(),
        phone:   shippingAddress.phone.trim(),
        street:  shippingAddress.street.trim(),
        city:    shippingAddress.city.trim(),
        state:   shippingAddress.state?.trim()   || '',
        zipCode: shippingAddress.zipCode?.trim() || '',
        country: shippingAddress.country?.trim() || 'Nepal'
      },
      deliveryStatus: 'placed'
    });

    res.status(201).json({
      success: true,
      message: `"${item.name}" claimed successfully! We will deliver it to your address.`,
      data: { claim, newPointsBalance: user.rewardPoints }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// USER — Cancel a claim
// PUT /api/rewards/claims/:claimId/cancel
//
// Allowed only while status is 'placed' or 'processing'.
// Points and stock are restored automatically.
exports.cancelClaim = async (req, res) => {
  try {
    const claim = await RewardClaim.findById(req.params.claimId);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });

    if (claim.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorised to cancel this claim.' });
    }

    if (claim.deliveryStatus === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Claim is already cancelled.' });
    }

    if (['shipped', 'delivered'].includes(claim.deliveryStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a claim that has already been shipped or delivered.'
      });
    }

    // Restore points
    await User.findByIdAndUpdate(claim.user, { $inc: { rewardPoints: claim.pointsSpent } });

    // Restore stock
    const item = await RewardItem.findById(claim.rewardItem);
    if (item && item.stock !== -1) {
      item.stock += 1;
      await item.save();
    }

    claim.deliveryStatus = 'cancelled';
    claim.cancelReason   = req.body.reason || 'Cancelled by user';
    claim.cancelledAt    = new Date();
    await claim.save();

    const updatedUser = await User.findById(claim.user);

    res.status(200).json({
      success: true,
      message: 'Claim cancelled. Your points have been restored.',
      data: { claim, newPointsBalance: updatedUser.rewardPoints }
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
