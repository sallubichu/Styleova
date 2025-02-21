const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Error connecting to database: ", error);
    process.exit(1); // Exit the process if the database connection fails
  }
};

module.exports = connectDB;
