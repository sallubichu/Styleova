const mongoose = require("mongoose");

const walletHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  history: [
    {
      amount: { type: Number, required: true }, // Amount paid (post-discount)
      originalAmount: { type: Number, default: 0 }, // Pre-discount total
      discount: { type: Number, default: 0 }, // Discount applied
      type: { type: String, enum: ["debit", "credit"], required: true },
      walletBalance: { type: Number, required: true },
      dateCreated: { type: Date, default: Date.now }, // Keep as dateCreated
      reason: { type: String, default: "N/A" }, // Optional context
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    },
  ],
});


const WalletHistory = mongoose.models.walletHistory || mongoose.model("walletHistory", walletHistorySchema);

module.exports = WalletHistory;