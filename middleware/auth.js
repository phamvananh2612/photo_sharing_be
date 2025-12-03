const isAuthenticated = (req, res, next) => {
  // req.session được tạo bởi express-session
  if (req.session && req.session.user) {
    // Gắn luôn user vào req cho tiện dùng ở các route sau
    req.user = req.session.user;
    return next();
  }

  return res.status(401).json({ message: "Bạn chưa đăng nhập" });
};

module.exports = { isAuthenticated };
