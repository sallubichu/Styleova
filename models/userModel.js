const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ["active", "blocked"],
    default: "active", // Default value is 'active'
  },


  password: {
    type: String,
  },
  wallet: {
    type: Number,
    default: 0,
  },
  dateCreated: {
    type: Date,
    default: Date.now, // Automatically set the creation date
  },
  defaultAddress: { type: mongoose.Schema.Types.ObjectId, ref: "address" },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
