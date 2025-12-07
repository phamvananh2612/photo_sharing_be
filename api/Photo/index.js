const express = require("express");
const router = express.Router();
const Photo = require("../../model/Photo");
const User = require("../../model/User");
const { isAuthenticated } = require("../../middleware/auth");
const { upload } = require("../../middleware/upload");
const { uploadToS3 } = require("../../config/s3");
const path = require("path");

const buildPhotoResponse = (photo, currentUserId) => {
  if (!photo) return null;

  const author = photo.user_id
    ? {
        _id: photo.user_id._id || photo.user_id,
        login_name: photo.user_id.login_name,
        avatar: photo.user_id.avatar || null,
      }
    : null;

  const formattedComments = (photo.comments || []).map((c) => ({
    _id: c._id,
    comment: c.comment,
    date_time: c.date_time,
    user_id: c.user_id?._id || c.user_id || null,
    login_name: c.user_id?.login_name || c.login_name || "Người dùng",
    avatar: c.user_id?.avatar || c.avatar || null,
  }));

  const likes = Array.isArray(photo.likes) ? photo.likes : [];
  const currentUserIdStr = currentUserId ? currentUserId : null;

  return {
    ...photo,
    user: author,
    comments: formattedComments,
    likesCount: likes.length,
    isLiked: currentUserIdStr
      ? likes.some((id) => id === currentUserIdStr)
      : false,
  };
};

// Helper: lấy lại 1 photo theo id, populate đầy đủ + format
const getFormattedPhotoById = async (photoId, currentUserId) => {
  const raw = await Photo.findById(photoId)
    .populate("comments.user_id", "login_name avatar")
    .populate("user_id", "login_name avatar")
    .lean();

  return buildPhotoResponse(raw, currentUserId);
};

// Lấy toàn bộ ảnh của 1 người dùng
router.get("/users/:userId/photos", async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.session?.user?._id || null;

    const photos = await Photo.find({ user_id: userId })
      .sort({ date_time: -1 })
      .populate("comments.user_id", "login_name avatar")
      .populate("user_id", "login_name avatar")
      .lean();

    const photosWithMeta = photos.map((p) =>
      buildPhotoResponse(p, currentUserId)
    );

    return res.status(200).json({
      photos: photosWithMeta,
      message:
        photosWithMeta.length === 0
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

      const ext = path.extname(file.originalname) || "";
      const key = `photos/${user._id}-${Date.now()}${ext}`;

      const imageUrl = await uploadToS3(file.buffer, key, file.mimetype);

      const newPhoto = new Photo({
        file_name: imageUrl,
        date_time: new Date(),
        user_id: user._id,
        caption: caption || "",
        comments: [],
        likes: [],
      });

      const savePhoto = await newPhoto.save();

      const formatted = {
        ...savePhoto.toObject(),
        user: {
          _id: user._id,
          login_name: user.login_name,
          avatar: user.avatar || null,
        },
        comments: [],
        likesCount: 0,
        isLiked: false,
      };

      return res.status(200).json({
        message: "Upload ảnh & lưu database thành công",
        photo: formatted,
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

    if (!caption || caption.trim() === "") {
      return res.status(400).json({ message: "Caption không được để trống" });
    }

    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy ảnh trong database" });
    }

    if (photo.user_id.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "Bạn không có quyền cập nhật ảnh này",
      });
    }

    photo.caption = caption.trim();
    await photo.save();

    // Refetch + populate + format
    const formatted = await getFormattedPhotoById(photoId, userId);

    return res.status(200).json({
      message: "Cập nhật caption thành công",
      photo: formatted,
    });
  } catch (err) {
    console.log("Lỗi khi cập nhật caption: ", err);
    return res.status(500).json({
      message: "Lỗi khi cập nhật caption",
      error: err.message,
    });
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
      comment: comment.trim(),
      user_id: userId,
      date_time: new Date(),
    });

    await photo.save();

    // Refetch với populate + lean
    const populated = await Photo.findById(photoId)
      .populate("comments.user_id", "login_name avatar")
      .populate("user_id", "login_name avatar")
      .lean();

    const photoWithMeta = buildPhotoResponse(populated, userId);

    return res.status(200).json({
      message: "Thêm comment thành công",
      photo: photoWithMeta,
    });
  } catch (err) {
    console.error("Lỗi khi thêm bình luận:", err);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

// API lấy thông tin 1 ảnh theo ID + user author + user comment
router.get("/photos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.session?.user?._id || null;

    const photo = await Photo.findById(id)
      .populate("comments.user_id", "login_name avatar")
      .populate("user_id", "login_name avatar")
      .lean();

    if (!photo) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy ảnh trong database" });
    }

    const photoWithMeta = buildPhotoResponse(photo, currentUserId);

    return res.status(200).json({
      message: "Lấy thông tin ảnh thành công",
      photo: photoWithMeta,
    });
  } catch (err) {
    console.log("Lỗi GET ảnh theo ID:", err);
    return res.status(500).json({
      message: "Lỗi trong quá trình lấy thông tin ảnh",
      error: err.message,
    });
  }
});

//  APi xóa ảnh
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
    const currentUserId = req.session?.user?._id || null;

    const photos = await Photo.find()
      .sort({ date_time: -1 })
      .populate("comments.user_id", "login_name avatar")
      .populate("user_id", "login_name avatar")
      .lean();

    const photosWithMeta = photos.map((p) =>
      buildPhotoResponse(p, currentUserId)
    );

    return res.status(200).json({
      photos: photosWithMeta,
      message: photosWithMeta.length === 0 ? "Chưa có ảnh nào" : undefined,
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
      console.log("BODY UPDATE:", req.body);
      console.log("SESSION USER:", req.session.user);

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

      comment.comment = commentUp.trim();
      await photo.save();

      // Refetch + populate + format
      const populated = await Photo.findById(photo_id)
        .populate("comments.user_id", "login_name avatar")
        .populate("user_id", "login_name avatar")
        .lean();

      const photoWithMeta = buildPhotoResponse(populated, userId);

      return res.status(200).json({
        message: "Sửa cmt thành công",
        photo: photoWithMeta,
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
      .populate("comments.user_id", "login_name avatar")
      .populate("user_id", "login_name avatar")
      .lean();

    const photosWithMeta = photos.map((p) =>
      buildPhotoResponse(p, currentUserId)
    );

    const isSelf = targetUserId.toString() === currentUserId.toString();

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
    const userId = req.session.user._id;

    const photo = await Photo.findById(photoId);
    if (!photo) {
      return res.status(404).json({ message: "Không tìm thấy ảnh" });
    }

    const userIdStr = userId.toString();
    const isLiked = photo.likes.some((id) => id.toString() === userIdStr);

    if (isLiked) {
      photo.likes = photo.likes.filter((id) => id.toString() !== userIdStr);
    } else {
      photo.likes.push(userId);
    }

    await photo.save();

    const populated = await Photo.findById(photoId)
      .populate("user_id", "login_name avatar")
      .populate("comments.user_id", "login_name avatar")
      .lean();

    const formatted = buildPhotoResponse(populated, userId);

    return res.status(200).json({
      message: isLiked ? "Unliked" : "Liked",
      photo: formatted,
    });
  } catch (err) {
    console.log("Lỗi like ảnh:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
});

module.exports = router;
