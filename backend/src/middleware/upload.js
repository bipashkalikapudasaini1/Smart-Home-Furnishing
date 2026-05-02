const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directories exist
const productUploadDir = path.join(__dirname, "../../uploads/products");
const avatarUploadDir  = path.join(__dirname, "../../uploads/avatars");
if (!fs.existsSync(productUploadDir)) fs.mkdirSync(productUploadDir, { recursive: true });
if (!fs.existsSync(avatarUploadDir))  fs.mkdirSync(avatarUploadDir,  { recursive: true });

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpg, png, webp, gif) are allowed."));
  }
};

// ── Product images (up to 5 files, 5 MB each) ──────────────────────────────
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, productUploadDir),
  filename:    (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: productStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// ── Avatar image (single file, 2 MB max) ───────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarUploadDir),
  filename:    (req, file, cb) => {
    const uniqueName = "avatar-" + Date.now() + path.extname(file.originalname).toLowerCase();
    cb(null, uniqueName);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

module.exports = { upload, uploadAvatar };
