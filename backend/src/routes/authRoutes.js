const express = require('express');
const {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
  uploadAvatar,
  deleteAccount,
  verifyEmail,
  resendVerification,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { uploadAvatar: avatarUpload } = require('../middleware/upload');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// Email verification (on registration)
router.post('/verify-email',        verifyEmail);
router.post('/resend-verification', resendVerification);

// Forgot Password routes (admin + user)
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Profile routes (private — logged-in users & admins)
router.put('/update-profile',  protect, updateProfile);
router.put('/change-password', protect, changePassword);
// Wrap multer so its errors return a clean JSON response instead of the generic 500 handler
router.post('/upload-avatar', protect, (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is too large. Maximum size is 10 MB.'
        : err.message || 'File upload failed.';
      return res.status(400).json({ success: false, message: msg });
    }
    next();
  });
}, uploadAvatar);
router.delete('/delete-account', protect, deleteAccount);

module.exports = router;
