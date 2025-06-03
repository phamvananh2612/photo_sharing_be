const express = require("express");
const router = express.Router();
const Photo = require("../../model/Photo");

// api lấy ra toàn bộ ảnh của 1 người dùng
router.get("/api/photos/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const photos = await Photo.find({ user_id: userId });
    if (photos.length > 0) {
      res.status(200).json({ photos: photos });
    } else {
      res.status(400).json({
        message: "Người dùng này chưa đăng bất kì ảnh nào",
        photos: [],
      });
    }
  } catch (error) {
    res.status(500).json({
      message: "Lỗi khi lấy danh sách người dùng",
      error: error.message,
    });
  }
});

// api tai ảnh mới lên
router.post("/photo/new", async (req, res) => {
  console.log("Session:", req.session); // Log session
  console.log("User in session:", req.session.user);
  try {
    const { file_name } = req.body;

    if (!req.session.user) {
      res.status(400).json({ message: "Bạn chưa đăng nhập" });
    }
    // lưu ảnh mới
    const newPhoto = new Photo({
      file_name: file_name,
      date_time: new Date(),
      user_id: req.session.user._id,
      comments: [],
    });
    const savePhoto = await newPhoto.save();
    res
      .status(200)
      .json({ message: "Lưu ảnh mới thành công", photo: savePhoto });
  } catch (error) {
    console.log("lỗi: ", error);
    res.status(500).json({ message: "Lỗi khi lưu ảnh", error: error.message });
  }
});

module.exports = router;
