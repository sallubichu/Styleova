const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  listing: {
    type: Boolean,
    default: true,
    required: true,
  },
});

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
