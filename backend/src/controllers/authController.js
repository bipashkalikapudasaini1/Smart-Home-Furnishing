const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
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
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
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
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
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

    // Security: don't reveal if email exists
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If that email exists, a reset code has been sent."
      });
    }

    // 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();

    // hash the code (store only hash in DB)
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    const expireMin = parseInt(process.env.RESET_CODE_EXPIRE_MIN || "10", 10);

    user.passwordResetCodeHash = codeHash;
    user.passwordResetExpires = new Date(Date.now() + expireMin * 60 * 1000);
    await user.save();

    // send email
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
      message: "If that email exists, a reset code has been sent."
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
