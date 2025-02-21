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
      enum: ["Product", "Category", "Referral"], // Only allow these types
    },
    discountType: {
      type: String,
      required: true,
      enum: ["Percentage", "Fixed"], // Only allow these discount types
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0, // Ensure discount value is non-negative
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
      enum: ["Active", "Inactive"], // Only allow these statuses
      default: "Active",
    },
  },
  {
    timestamps: true, // Automatically add `createdAt` and `updatedAt` fields
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
