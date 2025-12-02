const express = require("express");
const cors = require("cors");
const session = require("express-session");
require("dotenv").config();
const database = require("./config/database");

const userRouter = require("./api/User");
const photoRouter = require("./api/Photo");
const postRouter = require("./api/Post");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://photo-sharing-fe.vercel.app",
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // cho Postman, server-side
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"], // Thêm OPTIONS
    allowedHeaders: ["Content-Type", "Authorization"], // Thêm các header frontend có thể gửi
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Render = true
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
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
