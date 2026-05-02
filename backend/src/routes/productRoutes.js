const express = require('express');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getFilterOptions
} = require('../controllers/productController');
const { protect, adminOnly } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.get('/filters/options', getFilterOptions);
router.get('/', getProducts);
router.get('/:id', getProduct);

// Multer error wrapper for product image uploads
const handleProductUpload = (req, res, next) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'One or more images exceed the 5 MB limit.'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'Maximum 5 images allowed.'
          : err.message || 'File upload failed.';
      return res.status(400).json({ success: false, message: msg });
    }
    next();
  });
};

// Admin only routes — images uploaded as multipart/form-data (up to 5 files)
router.post('/', protect, adminOnly, handleProductUpload, createProduct);
router.put('/:id', protect, adminOnly, handleProductUpload, updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);

module.exports = router;
