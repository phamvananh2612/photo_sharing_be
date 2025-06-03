const mongoose = require("mongoose");

module.exports.connect = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log("Kết nối thành công đến Mongodb atlas");
  } catch (error) {
    console.log("Kết nối không thành công tới Mongodb atlas");
  }
};
