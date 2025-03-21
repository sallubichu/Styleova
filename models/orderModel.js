const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    name: {
      type: String,
      required: true,
    },
    orderedItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        pname: String,
        pimages: [String],
        originalPrice: Number,
        price: Number,
        quantity: Number,
        size: { type: String, required: true },
        offerDiscount: { type: Number, default: 0 },
        status: {
          type: String,
          default: "Pending",
          enum: ["Pending", "Delivered", "Cancelled", "Returned","Return Requested"],
        },
        returned:{type:Boolean,default:false},
        returnRequested: { type: Boolean, default: false },
        returnReason: { type: String }
      },
    ],
    orderedDate: {
      type: Date,
      default: Date.now,
    },
    deliveredDate: {
      type: Date,
    },
    status: {
      type: String,
      default: "Pending",
      enum: ["Pending", "Delivered", "Cancelled", "Returned"],
    },
    shippingAddress: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "address",
      required: true,
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    paymentStatus: {
      type: String,
      default: "Completed",
      enum: ["Pending", "Completed", "Failed", "Refunded"],
      required: true,
    },
    paymentId: { type: String, default: null }, // Stores Razorpay payment ID
    totalAmount: {
      type: Number,
      required: true,
    },
    couponApplied: {
      code: { type: String, default: "" },
      discount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

const orderModel = mongoose.model("order", orderSchema);

module.exports = orderModel;