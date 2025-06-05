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

// api tạo mới comment
router.post("/commentsOfPhoto/:photo_id", async (req, res) => {
  const { photo_id } = req.params;
  const { comment } = req.body;
  const userId = req.session?.user?._id;

  if (!userId) {
    return res.status(401).json({ message: "Chưa đăng nhập." });
  }
  if (!comment || comment.trim() === "") {
    return res.status(400).json({ message: "Bình luận không được để trống." });
  }
  try {
    const photo = await Photo.findById(photo_id);
    if (!photo) {
      return res.status(404).json({ message: "Không tìm thấy ảnh." });
    }
    // đẩy comment vào trong mảng photo
    photo.comments.push({
      comment,
      user_id: userId,
      date_time: new Date(),
    });

    const savePhoto = await photo.save();
    res.status(200).json({ message: "Thêm comment thành công", photo: photo });
  } catch (err) {
    console.error("Lỗi khi thêm bình luận:", err);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

module.exports = router;
