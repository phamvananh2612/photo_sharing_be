const express = require("express");
const router = express.Router();
const Photo = require("../../model/Photo");
const { isAuthenticated } = require("../../middleware/auth");
const { upload } = require("../../middleware/upload");
const { uploadToS3 } = require("../../config/s3");
const path = require("path");

// Lấy toàn bộ ảnh của 1 người dùng
router.get("/users/:userId/photos", async (req, res) => {
  try {
    const userId = req.params.userId;

    const photos = await Photo.find({ user_id: userId }).lean();
    const photosWithLikesCount = photos.map((photo) => ({
      ...photo,
      likesCount: photo.likes ? photo.likes.length : 0,
    }));
    return res.status(200).json({
      photos: photosWithLikesCount,
      message:
        photos.length === 0
          ? "Người dùng này chưa đăng bất kì ảnh nào"
          : undefined,
    });
  } catch (error) {
    console.log("Lỗi khi lấy danh sách ảnh: ", error);
    return res.status(500).json({
      message: "Lỗi khi lấy danh sách ảnh",
      error: error.message,
    });
  }
});
// tạo bài đăng mới ảnh kèm caption
router.post(
  "/photos",
  isAuthenticated,
  upload.single("image"),
  async (req, res) => {
    console.log("Session:", req.session);
    console.log("User in session:", req.session.user);

    try {
      if (!req.file) {
        return res.status(400).json({ message: "Chưa chọn file để upload" });
      }
      const { caption } = req.body;
      const file = req.file;
      const user = req.session.user;

      // Tạo key (tên file) unique trong S3
      const ext = path.extname(file.originalname) || "";
      const key = `photos/${user._id}-${Date.now()}${ext}`;

      // Upload ảnh lên S3
      const imageUrl = await uploadToS3(file.buffer, key, file.mimetype);
      // lưu vào mongoDb
      const newPhoto = new Photo({
        file_name: imageUrl,
        date_time: new Date(),
        user_id: user._id,
        caption: caption || "",
        comments: [],
      });

      const savePhoto = await newPhoto.save();

      return res.status(200).json({
        message: "Upload ảnh & lưu database thành công",
        photo: savePhoto,
      });
    } catch (error) {
      console.log("Lỗi khi upload ảnh:", error);
      return res.status(500).json({
        message: "Lỗi khi upload ảnh",
        error: error.message,
      });
    }
  }
);

// Cập nhật caption
router.patch("/photos/:photoId", isAuthenticated, async (req, res) => {
  try {
    const { photoId } = req.params;
    const { caption } = req.body;
    const userId = req.session.user._id;

    // Validate input
    if (typeof caption !== "string") {
      return res.status(400).json({ message: "Caption không hợp lệ" });
    }

    // Tìm ảnh
    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ message: "Không tìm thấy ảnh" });
    }

    if (photo.user_id.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền sửa ảnh này" });
    }

    // Cập nhật
    photo.caption = caption;
    await photo.save();

    return res.status(200).json({
      message: "Cập nhật caption thành công",
      photo,
    });
  } catch (err) {
    console.error("Lỗi cập nhật caption:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

// Tạo mới comment cho 1 photo
router.post("/photos/:photoId/comments", isAuthenticated, async (req, res) => {
  const { photoId } = req.params;
  const { comment } = req.body;
  const userId = req.session.user._id;

  if (!comment || comment.trim() === "") {
    return res.status(400).json({ message: "Bình luận không được để trống." });
  }

  try {
    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ message: "Không tìm thấy ảnh." });
    }

    photo.comments.push({
      comment,
      user_id: userId,
      date_time: new Date(),
    });

    const savePhoto = await photo.save();

    return res
      .status(200)
      .json({ message: "Thêm comment thành công", photo: savePhoto });
  } catch (err) {
    console.error("Lỗi khi thêm bình luận:", err);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

// Xóa ảnh
router.delete("/photos/:id", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user._id;

    const photo = await Photo.findById(id);
    if (!photo) {
      console.log("Không tồn tại ảnh trong database");
      return res
        .status(400)
        .json({ message: "Không tìm tìm thấy ảnh trong database" });
    }

    if (photo.user_id.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "Bạn không được phép xóa ảnh này vì nó của người dùng khác",
      });
    }

    await photo.deleteOne();
    return res.status(200).json({ message: "Xóa ảnh thành công" });
  } catch (err) {
    console.log("Lỗi trong quá trình xóa ảnh: ", err);
    return res.status(500).json({
      message: "Lỗi trong quá trình xóa ảnh",
      error: err.message,
    });
  }
});

// Lấy toàn bộ ảnh trong db
router.get("/photos", async (req, res) => {
  try {
    // dùng lean() để có object thuần, dễ thêm field mới
    const photos = await Photo.find().sort({ date_time: -1 }).lean();

    // thêm likesCount cho mỗi ảnh
    const photosWithLikes = photos.map((photo) => ({
      ...photo,
      likesCount: photo.likes ? photo.likes.length : 0,
    }));

    return res.status(200).json({
      photos: photosWithLikes,
      message: photos.length === 0 ? "Chưa có ảnh nào" : undefined,
    });
  } catch (error) {
    console.log("Lỗi khi lấy danh sách ảnh: ", error);
    return res.status(500).json({
      message: "Lỗi khi lấy danh sách ảnh",
      error: error.message,
    });
  }
});

// Xóa comment
router.delete(
  "/photos/:photo_id/comments/:comment_id",
  isAuthenticated,
  async (req, res) => {
    try {
      const { photo_id, comment_id } = req.params;
      const userId = req.session.user._id;

      const photo = await Photo.findById(photo_id);
      if (!photo) {
        return res
          .status(400)
          .json({ message: "Không tìm thấy ảnh trong database" });
      }

      const comment = photo.comments.id(comment_id);
      if (!comment) {
        return res.status(404).json({ message: "Không tìm thấy bình luận" });
      }

      if (comment.user_id.toString() !== userId.toString()) {
        return res.status(403).json({
          message: "Bạn không có quyền xóa comment này vì nó của người khác",
        });
      }

      comment.deleteOne();
      await photo.save();

      return res.status(200).json({
        message: "Xóa cmt thành công",
      });
    } catch (err) {
      console.log("Lỗi trong quá trình xóa cmt: ", err);
      return res.status(500).json({
        message: "Lỗi trong quá trình xóa cmt",
        error: err.message,
      });
    }
  }
);

// Cập nhật comment
router.patch(
  "/photos/:photo_id/comments/:comment_id",
  isAuthenticated,
  async (req, res) => {
    try {
      const { photo_id, comment_id } = req.params;
      const { commentUp } = req.body;
      const userId = req.session.user._id;

      if (!commentUp || commentUp.trim() === "") {
        return res.status(400).json({
          message: "Nội dung bình luận không được để trống",
        });
      }

      const photo = await Photo.findById(photo_id);
      if (!photo) {
        return res
          .status(400)
          .json({ message: "Không tìm thấy ảnh trong database" });
      }

      const comment = photo.comments.id(comment_id);
      if (!comment) {
        return res.status(404).json({ message: "Không tìm thấy bình luận" });
      }

      if (comment.user_id.toString() !== userId.toString()) {
        return res.status(403).json({
          message:
            "Bạn không có quyền cập nhật comment này vì nó của người khác",
        });
      }

      comment.comment = commentUp;
      await photo.save();

      return res.status(200).json({
        message: "Sửa cmt thành công",
        photo: photo,
      });
    } catch (err) {
      console.log("Lỗi trong quá trình cập nhật cmt: ", err);
      return res.status(500).json({
        message: "Lỗi trong quá trình cập nhật cmt",
        error: err.message,
      });
    }
  }
);

// API lấy ra danh sách ảnh yêu thích của 1 user
router.get("/photos/:userId/favorite", isAuthenticated, async (req, res) => {
  try {
    const currentUserId = req.session.user._id;
    const targetUserId = req.params.userId;

    const photos = await Photo.find({ likes: targetUserId })
      .sort({ date_time: -1 })
      .lean();

    const photosWithMeta = photos.map((p) => {
      const likes = p.likes || [];

      return {
        ...p,
        likesCount: likes.length,
        // current user có tym ảnh này không
        isLiked: likes.some((id) => id === currentUserId),
      };
    });

    const isSelf = targetUserId === currentUserId;

    return res.status(200).json({
      photos: photosWithMeta,
      message:
        photosWithMeta.length === 0
          ? isSelf
            ? "Bạn chưa tym bức ảnh nào"
            : "Người dùng này chưa tym bức ảnh nào"
          : undefined,
    });
  } catch (error) {
    console.log("Lỗi khi lấy danh sách ảnh yêu thích: ", error);
    return res.status(500).json({
      message: "Lỗi khi lấy danh sách ảnh yêu thích",
      error: error.message,
    });
  }
});

// API like/unlike ảnh
router.patch("/photos/:photoId/like", isAuthenticated, async (req, res) => {
  try {
    const { photoId } = req.params;

    // Lấy đúng user đang đăng nhập
    const userId = req.session.user._id;

    if (!userId) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }

    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ message: "Không tìm thấy ảnh" });
    }

    // So sánh ObjectId cho đúng kiểu
    const userIdStr = userId.toString();
    const liked = photo.likes.some((id) => id.toString() === userIdStr);

    if (liked) {
      // Bỏ like
      photo.likes = photo.likes.filter((id) => id.toString() !== userIdStr);
    } else {
      // Thêm like
      photo.likes.push(userId);
    }

    await photo.save();

    res.json({
      message: liked ? "Unliked" : "Liked",
      likesCount: photo.likes.length,
      isLiked: !liked,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Lỗi server" });
  }
});

module.exports = router;
