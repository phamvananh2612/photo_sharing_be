const mongoose = require("mongoose");

const photoSchema = new mongoose.Schema({
  file_name: {
    type: String,
    required: true,
  },
  date_time: {
    type: Date,
    required: true,
    default: Date.now,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  comments: [
    {
      comment: { type: String, required: true },
      date_time: { type: Date, required: true, default: Date.now },
      user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    },
  ],
});

const Photo = mongoose.model("Photo", photoSchema, "photos");
module.exports = Photo;
