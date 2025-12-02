const express = require("express");
const router = express.Router();
const Post = require("../../model/Post");

// api xử lý lấy toàn bộ bài viết
router.get("/post/list", async (req, res) => {
  try {
    const posts = await Post.find();
    console.log(posts);
    res.status(200).json({ message: "Danh sách các bài post", posts: posts });
  } catch (err) {
    console.log("Lỗi khi lấy danh sách bài viết");
    res
      .status(500)
      .json({ message: "lỗi khi lấy danh sách bài viết", error: err.message });
  }
});
module.exports = router;
