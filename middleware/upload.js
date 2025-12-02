const multer = require("multer");

// Lưu file vào RAM (buffer) để upload thẳng lên S3, không lưu vào ổ cứng
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Chỉ cho phép upload file ảnh"), false);
    }
    cb(null, true);
  },
});

module.exports = { upload };
