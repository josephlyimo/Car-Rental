const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const productUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
const profileUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'profiles');

if (!fs.existsSync(productUploadDir)) {
  fs.mkdirSync(productUploadDir, { recursive: true });
}
if (!fs.existsSync(profileUploadDir)) {
  fs.mkdirSync(profileUploadDir, { recursive: true });
}

// Multer storage for product images
const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, productUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer storage for profile images
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, profileUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadProductImage = multer({ storage: productStorage });
const uploadProfileImage = multer({ storage: profileStorage });

module.exports = {
  uploadProductImage,
  uploadProfileImage
};
