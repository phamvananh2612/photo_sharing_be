const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  login_name: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  first_name: {
    type: String,
    required: true,
  },
  last_name: {
    type: String,
    required: true,
  },
  location: {
    type: String,
  },
  description: {
    type: String,
  },
  occupation: {
    type: String,
  },
});

const User = mongoose.model("User", userSchema, "users");
// User: tên Schema
// userSchema: định nghĩa bên trên
// users: tên Collection trong Mongodb atlas
module.exports = User;
