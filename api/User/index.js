const express = require("express");
const router = express.Router();
const User = require("../../model/User");
const { isAuthenticated } = require("../../middleware/auth");
const { upload } = require("../../middleware/upload");
const { uploadToS3 } = require("../../config/s3");
const path = require("path");

// Lấy toàn bộ người dùng
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    return res.status(200).json({ users });
  } catch (error) {
    console.log("Lỗi khi lấy danh sách người dùng: ", error);
    return res.status(400).json({
      message: "Lỗi khi lấy danh sách người dùng",
      error: error.message,
    });
  }
});

// Lấy chi tiết 1 user theo id
router.get("/users/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({
        message: `Không tồn tại người dùng có id: ${id} trong database`,
      });
    }

    return res.status(200).json(user);
  } catch (err) {
    console.log("Lỗi khi lấy thông tin chi tiết người dùng: ", err);
    return res.status(500).json({
      message: "Lỗi khi lấy thông tin chi tiết người dùng này",
      error: err.message,
    });
  }
});

// Tạo mới người dùng
router.post("/users", async (req, res) => {
  try {
    const { login_name, password, first_name, last_name } = req.body;

    if (!login_name || !password || !first_name || !last_name) {
      console.log("Thiếu các trường bắt buộc");
      return res.status(400).json({ message: "Thiếu các trường bắt buộc" });
    }

    // Kiểm tra login_name đã tồn tại chưa
    const existed = await User.findOne({ login_name });
    if (existed) {
      console.log("Tên người dùng đã được sử dụng, vui lòng đặt tên khác!");
      return res.status(400).json({
        message: "Tên người dùng đã được sử dụng, vui lòng đặt tên khác!",
      });
    }

    const newUser = new User({
      login_name,
      password,
      first_name,
      last_name,
    });

    const saveUser = await newUser.save();

    return res
      .status(200)
      .json({ message: "Tạo mới thành công người dùng", user: saveUser });
  } catch (err) {
    console.log("Lỗi khi tạo tài khoản mới: ", err);
    return res.status(500).json({
      message: "Lỗi khi tạo tài khoản mới",
      error: err.message,
    });
  }
});

// Đăng nhập
router.post("/auth/login", async (req, res) => {
  try {
    const { login_name, password } = req.body;

    if (!login_name || !password) {
      console.log("Thiếu thông tin đăng nhập");
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin đăng nhập" });
    }

    const user = await User.findOne({ login_name });
    if (!user) {
      console.log(
        `Không tồn tại người dùng có tên đăng nhập ${login_name} trong database`
      );
      return res.status(400).json({
        message: `Không tồn tại người dùng có tên đăng nhập ${login_name} trong database`,
      });
    }

    if (user.password !== password) {
      console.log("Mật khẩu không chính xác");
      return res.status(400).json({ message: "Mật khẩu không chính xác" });
    }

    // Lưu user vào session
    req.session.user = {
      _id: user._id,
      login_name: user.login_name,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    const userSafe = user.toObject();
    delete userSafe.password;

    return res.status(200).json({
      message: "Đăng nhập thành công",
      user: userSafe,
    });
  } catch (err) {
    console.log("Lỗi trong quá trình đăng nhập: ", err);
    return res.status(500).json({
      message: "Lỗi trong quá trình đăng nhập",
      error: err.message,
    });
  }
});

// Cập nhật thông tin người dùng
// PATCH /users/:id - Cập nhật thông tin user + avatar
router.patch(
  "/users/:id",
  isAuthenticated,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const id = req.params.id;
      // Chỉ cho sửa chính mình
      if (req.session.user._id.toString() !== id.toString()) {
        return res
          .status(403)
          .json({ message: "Bạn không có quyền cập nhật user này" });
      }
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ message: "User không tồn tại" });
      }

      const {
        login_name,
        first_name,
        last_name,
        email,
        description,
        occupation,
        location,
      } = req.body;

      if (login_name && login_name !== user.login_name) {
        const existed = await User.findOne({
          login_name: login_name,
          _id: { $ne: id },
        });

        if (existed) {
          return res
            .status(400)
            .json({ message: "login_name đã tồn tại, vui lòng chọn tên khác" });
        }

        user.login_name = login_name;
      }

      if (first_name !== undefined) user.first_name = first_name;
      if (last_name !== undefined) user.last_name = last_name;
      if (description !== undefined) user.description = description;
      if (occupation !== undefined) user.occupation = occupation;
      if (location !== undefined) user.location = location;
      if (email !== undefined) user.email = email;
      if (req.file) {
        const file = req.file;
        const ext = path.extname(file.originalname) || "";
        const key = `avatars/${id}-${Date.now()}${ext}`;

        const avatarUrl = await uploadToS3(file.buffer, key, file.mimetype);
        user.avatar = avatarUrl;
      }
      await user.save();

      const userSafe = user.toObject();
      delete userSafe.password;

      return res.status(200).json({
        message: "Cập nhật thông tin thành công",
        user: userSafe,
      });
    } catch (error) {
      console.error("Lỗi update user:", error);

      return res.status(500).json({
        message: error.message || "Có lỗi xảy ra khi cập nhật user",
      });
    }
  }
);

// Logout (dùng middleware isAuthenticated)
router.post("/auth/logout", isAuthenticated, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("Lỗi khi logout: ", err);
      return res.status(500).json({ message: "Lỗi khi đăng xuất" });
    }

    res.clearCookie("connect.sid");
    return res.status(200).json({ message: "Đăng xuất thành công" });
  });
});

module.exports = router;
