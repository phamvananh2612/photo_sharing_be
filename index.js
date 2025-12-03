const express = require("express");
const cors = require("cors");
const session = require("express-session");
require("dotenv").config();
const database = require("./config/database");

const userRouter = require("./api/User");
const photoRouter = require("./api/Photo");
const postRouter = require("./api/Post");

const app = express();

const isProduction = process.env.NODE_ENV === "production";
console.log("NODE_ENV =", process.env.NODE_ENV);

//  Nếu deploy sau proxy
if (isProduction) {
  app.set("trust proxy", 1);
}

const allowedOrigins = [
  "http://localhost:3000",
  "https://photo-sharing-fe.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

database.connect();

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 60 * 60 * 1000,
      httpOnly: true,
      secure: isProduction, // https thì true
      sameSite: isProduction ? "none" : "lax", // cross-site thì phải 'none'
    },
  })
);

// Routers
app.use("/api", userRouter);
app.use("/api", photoRouter);
app.use("/api", postRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Ứng dụng đang chạy trên cổng ${port}`);
});
