const express = require("express");
const router = express.Router();
const User = require("../../model/User");

// api xử lý lấy toàn bộ người dùng
router.get("/user/list", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json({ users });
  } catch (error) {
    console.log("Lỗi khi lấy danh sách người dùng: ", error);
    res.status(400).json({
      message: "Lỗi khi lấy danh sách người dùng",
      error: error.message,
    });
  }
});

// api lấy ra từng user theo id
router.get("/user/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({
        message: ` Không tồn tại người dùng có id: ${id} trong database`,
      });
    } else {
      const user = await User.findOne({ _id: id });
      res.status(200).json(user);
    }
  } catch (err) {
    res.status(500).json({
      message: "Lỗi khi lấy thông tin chi tiết người dùng này",
      error: err.message,
    });
  }
});

// api xử lí tạo mới người dùng
router.post("/user", async (req, res) => {
  try {
    const {
      login_name,
      password,
      first_name,
      last_name,
      location,
      description,
      occupation,
    } = req.body;
    if (!login_name || !password || !first_name || !last_name) {
      console.log("Thiếu các trường bắt buộc");
      return res.status(400).json({ message: "Thiếu các trường bắt buộc" });
    }

    //kiểm tra login_name đã tồn tại chưa
    const check_login_name = await User.findOne({ login_name });
    if (check_login_name) {
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
      location,
      description,
      occupation,
    });
    const saveUser = await newUser.save();

    res
      .status(200)
      .json({ message: "Tạo mới thành công người dùng", user: saveUser });
  } catch (err) {
    console.log("lỗi: ", err);
    res
      .status(500)
      .json({ message: "Lỗi khi tạo tài khoản mới", error: err.message });
  }
});
// Middleware kiểm tra đăng nhập
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next(); // đã đăng nhập → tiếp tục
  } else {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }
}

// api xử lý đăng nhập
router.post("/admin/login", async (req, res) => {
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
    } else {
      if (user.password !== password) {
        console.log(`Mật khẩu không chính xác`);
        return res.status(400).json({ message: "Mật khẩu không chính xác" });
      } else {
        req.session.user = {
          _id: user._id,
          login_name: user.login_name,
          first_name: user.first_name,
          last_name: user.last_name,
        };
        return res
          .status(200)
          .json({ message: "Đăng nhập thành công", user: user });
      }
    }
  } catch (err) {
    console.log("Lỗi: ", err);
    return res
      .status(500)
      .json({ message: "Lỗi trong quá trình đăng nhập", error: err.message });
  }
});

// api xử lý logout
router.post("/admin/logout", isAuthenticated, (req, res) => {
  // Xóa session hiện tại
  req.session.destroy((err) => {
    if (err) {
      console.log("Lỗi khi logout: ", err);
      return res.status(500).json({ message: "Lỗi khi đăng xuất" });
    }
    res.clearCookie("connect.sid"); // sid: session Id- là tên mặc định của cookies này
    return res.status(200).json({ message: "Đăng xuất thành công" });
  });
});

module.exports = router;
