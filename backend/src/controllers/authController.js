const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const sendEmail = require("../utils/sendEmail");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Register user — sends verification OTP, account inactive until verified
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const expireMin = parseInt(process.env.VERIFY_CODE_EXPIRE_MIN || '15', 10);

    const userExists = await User.findOne({ email });
    if (userExists) {
      // If already registered but not verified, resend a fresh code
      if (!userExists.isEmailVerified) {
        const code     = crypto.randomInt(100000, 999999).toString();
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        // Use updateOne to avoid triggering the password pre-save hook
        await User.updateOne({ _id: userExists._id }, {
          emailVerifyCodeHash: codeHash,
          emailVerifyExpires:  new Date(Date.now() + expireMin * 60 * 1000)
        });
        await sendEmail({
          to: userExists.email,
          subject: 'Smart Home Furnishing – Verify Your Email',
          html: verifyEmailHtml(code, expireMin)
        });
        return res.status(200).json({
          success: true,
          message: 'A new verification code has been sent to your email.',
          data: { email: userExists.email, requiresVerification: true }
        });
      }
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // ── Generate OTP BEFORE creating user so everything goes in one save ──
    const code     = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    // Single User.create() call — password hashed once by pre-save hook
    const user = await User.create({
      name,
      email,
      password,
      phone,
      isEmailVerified:    false,
      emailVerifyCodeHash: codeHash,
      emailVerifyExpires:  new Date(Date.now() + expireMin * 60 * 1000)
    });

    await sendEmail({
      to: user.email,
      subject: 'Smart Home Furnishing – Verify Your Email',
      html: verifyEmailHtml(code, expireMin)
    });

    return res.status(201).json({
      success: true,
      message: 'Account created! Please check your email for the verification code.',
      data: { email: user.email, requiresVerification: true }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper — email HTML template
const verifyEmailHtml = (code, expireMin) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 480px; margin: auto;">
    <h2 style="color: #2c3e50;">Verify Your Email</h2>
    <p>Welcome to <b>Smart Home Furnishing</b>! Use the code below to verify your email address:</p>
    <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea;
                background: #f0f4ff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
      ${code}
    </div>
    <p>This code expires in <b>${expireMin} minutes</b>.</p>
    <p style="color: #999; font-size: 13px;">If you didn't create an account, you can safely ignore this email.</p>
  </div>
`;

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        _id:          user._id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        avatar:       user.avatar       || '',
        rewardPoints: user.rewardPoints || 0,
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    // req.user is already loaded by protect — return it directly (no extra DB query)
    res.status(200).json({
      success: true,
      data: req.user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

//  FORGOT PASSWORD: send code to email (admin + user)
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with that email address."
      });
    }

    // 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const expireMin = parseInt(process.env.RESET_CODE_EXPIRE_MIN || "10", 10);

    // Use findOneAndUpdate to avoid triggering the password pre-save validator
    await User.findOneAndUpdate({ email }, {
      passwordResetCodeHash: codeHash,
      passwordResetExpires: new Date(Date.now() + expireMin * 60 * 1000)
    });

    await sendEmail({
      to: user.email,
      subject: "Smart Home Furnishing - Password Reset Code",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Password Reset Code</h2>
          <p>Use this code to reset your password:</p>
          <h1 style="letter-spacing: 4px;">${code}</h1>
          <p>This code will expire in <b>${expireMin} minutes</b>.</p>
          <p>If you didn’t request this, ignore this email.</p>
        </div>
      `
    });

    return res.status(200).json({
      success: true,
      message: "A password reset code has been sent to your email."
    });

  } catch (error) {
    console.log("FORGOT PASSWORD ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack
    });
  }
};



// @desc    Reset password using code
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, code, and newPassword are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    const user = await User.findOne({ email }).select("+passwordResetCodeHash");

    if (!user || !user.passwordResetCodeHash || !user.passwordResetExpires) {
      return res.status(400).json({ success: false, message: "Invalid or expired code" });
    }

    if (user.passwordResetExpires.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: "Code expired" });
    }

    if (user.passwordResetCodeHash !== codeHash) {
      return res.status(400).json({ success: false, message: "Invalid code" });
    }

    // set new password (will hash in pre-save)
    user.password = newPassword;
    user.passwordResetCodeHash = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful. Please login."
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update profile (name, phone, address)
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name.trim();
    if (phone !== undefined) updateFields.phone = phone;

    if (address) {
      // req.user already loaded by protect — use it directly for address merge
      const cur = req.user.address || {};
      updateFields.address = {
        street:  address.street  || cur.street  || '',
        city:    address.city    || cur.city    || '',
        state:   address.state   || cur.state   || '',
        zipCode: address.zipCode || cur.zipCode || '',
        country: address.country || cur.country || 'Nepal',
      };
    }

    // Use findByIdAndUpdate to avoid triggering the password pre-save validator
    const user = await User.findByIdAndUpdate(req.user._id, updateFields, { new: true, runValidators: false });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id:          user._id,
        name:         user.name,
        email:        user.email,
        phone:        user.phone,
        address:      user.address,
        avatar:       user.avatar,
        role:         user.role,
        rewardPoints: user.rewardPoints,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change password while logged in
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save(); // pre-save hook hashes the new password — only runs when password is modified

    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload avatar
// @route   POST /api/auth/upload-avatar
// @access  Private
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    // protect middleware already loaded req.user — use _id directly (no extra DB query)
    const oldAvatar = req.user.avatar;

    await User.findByIdAndUpdate(req.user._id, { avatar: avatarPath });

    // Delete old file after successful DB update (non-critical — wrap separately)
    if (oldAvatar && oldAvatar.startsWith('/uploads/avatars/')) {
      try {
        const oldPath = path.join(__dirname, '../../', oldAvatar);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (_) { /* stale file — ignore */ }
    }

    return res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: { avatar: avatarPath }
    });
  } catch (error) {
    console.error('uploadAvatar error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete account
// @route   DELETE /api/auth/delete-account
// @access  Private
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to delete account' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect password' });
    }

    await User.findByIdAndDelete(req.user._id);

    return res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify email with OTP
// @route   POST /api/auth/verify-email
// @access  Public
exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    const codeHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
    const user = await User.findOne({ email }).select('+emailVerifyCodeHash');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }
    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified. Please login.' });
    }
    if (!user.emailVerifyCodeHash || !user.emailVerifyExpires) {
      return res.status(400).json({ success: false, message: 'No verification code found. Please request a new one.' });
    }
    if (user.emailVerifyExpires.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
    }
    if (user.emailVerifyCodeHash !== codeHash) {
      return res.status(400).json({ success: false, message: 'Incorrect code. Please try again.' });
    }

    user.isEmailVerified    = true;
    user.emailVerifyCodeHash = undefined;
    user.emailVerifyExpires  = undefined;
    await user.save();

    return res.status(200).json({ success: true, message: 'Email verified! You can now log in.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Resend email verification code
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ success: true, message: 'If that email exists, a code has been sent.' });
    }
    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified.' });
    }

    const code     = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expireMin = parseInt(process.env.VERIFY_CODE_EXPIRE_MIN || '15', 10);
    user.emailVerifyCodeHash = codeHash;
    user.emailVerifyExpires  = new Date(Date.now() + expireMin * 60 * 1000);
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'Smart Home Furnishing – New Verification Code',
      html: verifyEmailHtml(code, expireMin)
    });

    return res.status(200).json({ success: true, message: 'A new verification code has been sent to your email.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
