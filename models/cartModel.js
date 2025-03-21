const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      quantity: {
        type: Number,
        min: 1,
        required: true,
        default: 1,
      },
      size: {
        type: String,
        required: true,
        enum: ["Small", "Medium", "Large"],
      },
    },
  ],
  discountAmount: {
    type: Number,
    default: 0,
  },
  finalAmount: {
    type: Number,
    default: 0,
  },
  couponApplied: { // Added
    type: Boolean,
    default: false,
  },
  couponCode: {   // Added
    type: String,
    default: null,
  },
});

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;