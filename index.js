const express = require("express");
const cors = require("cors");
const session = require("express-session");
require("dotenv").config();
const database = require("./config/database");

const userRouter = require("./api/User");
const photoRouter = require("./api/Photo");
const postRouter = require("./api/Post");

const app = express();
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"], // Thêm OPTIONS
    allowedHeaders: ["Content-Type", "Authorization"], // Thêm các header frontend có thể gửi
  })
);

app.use(
  session({
    secret: "Chibi",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 60 * 60 * 1000,
      httpOnly: true,
      secure: false, // Đặt true nếu dùng HTTPS
      sameSite: "lax", // Cho phép cookie cross-origin
    },
  })
);

app.use(express.json()); // dùng để xử lý Json trong body request
const port = process.env.PORT || 4000;
database.connect();

app.use("/api", userRouter);
app.use("/api", photoRouter);
app.use("/api", postRouter);

app.listen(port, () => {
  console.log(`Ứng dụng đang chạy trên cổng ${port}`);
});
