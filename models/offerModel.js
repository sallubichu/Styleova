const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["Product", "Category", "Referral"],
    },
    discountType: {
      type: String,
      required: true,
      enum: ["Percentage", "Fixed"],
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null, // Optional field, only set for Category offers
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null, // Optional field, only set for Product offers
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to validate dates
offerSchema.pre("save", function (next) {
  if (this.startDate >= this.endDate) {
    next(new Error("End date must be after the start date."));
  } else {
    next();
  }
});

const Offer = mongoose.model("Offer", offerSchema);

module.exports = Offer;