const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    rating: { type: Number, default: 0 },
    rate: { type: Number, required: true },

    offerApplied: { type: Boolean, default: false },
    listing: { type: Boolean, default: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    images: [{ type: String, required: true }],

    // Store stock separately for each size
    stock: {
      Small: { type: Number, default: 0 },
      Medium: { type: Number, default: 0 },
      Large: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
