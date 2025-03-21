const razorpayInstance = require("../config/razorpay");
const Order = require("../models/orderModel");
const Cart = require("../models/cartModel"); // Assuming a cart model exists
const HttpStatus = require("http-status-codes");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User=require('../models/userModel')
const walletHistoryModel=require('../models/wallethistoryModel')

exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("Request body:", req.body); // Log incoming request
    const { userId, cartId, shippingAddress, paymentMethod, totalAmount } = req.body;

    // Validate required fields
    if (!userId || !cartId || !shippingAddress || !paymentMethod || !totalAmount) {
      await session.abortTransaction();
      session.endSession();
      console.log("Missing fields:", { userId, cartId, shippingAddress, paymentMethod, totalAmount });
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Missing required fields" });
    }

    // Fetch cart to populate order items
    const cart = await Cart.findById(cartId).populate("products.productId").session(session);
    if (!cart) {
      await session.abortTransaction();
      session.endSession();
      console.log("Cart not found:", cartId);
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Cart not found" });
    }

    // Prepare ordered items from cart
    const orderedItems = cart.products.map((item) => ({
      productId: item.productId._id,
      pname: item.productId.name,
      pimages: item.productId.images,
      originalPrice: item.productId.rate,
      price: item.productId.rate,
      quantity: item.quantity,
      size: item.size,
      offerDiscount: 0,
      status: "Pending",
    }));

    let paymentId = null;
    let paymentStatus = "Pending";

    // Handle payment methods
    const method = paymentMethod.toLowerCase().replace(/\s+/g, "");
    if (method === "razorpay") {
      const razorpayOrder = await razorpayInstance.orders.create({
        amount: Math.round(totalAmount * 100), // Convert to paise
        currency: "INR",
        receipt: `order_${new mongoose.Types.ObjectId()}`,
      });
      paymentId = razorpayOrder.id; // Razorpay order ID, not payment ID yet
      console.log("Razorpay order created:", paymentId);
    } else if (method === "styleovawallet") {
      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        console.log("User not found:", userId);
        return res.status(HttpStatus.NOT_FOUND).json({ message: "User not found" });
      }

      if (user.wallet < totalAmount) {
        await session.abortTransaction();
        session.endSession();
        console.log("Insufficient wallet balance:", user.wallet, "vs", totalAmount);
        return res.status(HttpStatus.BAD_REQUEST).json({ message: "Insufficient wallet balance" });
      }

      user.wallet -= totalAmount;
      await user.save({ session });
      paymentStatus = "Completed";
      paymentId = `wallet_${new mongoose.Types.ObjectId()}`; // Unique ID for wallet payment

      // Record wallet debit in history
      await walletHistoryModel.findOneAndUpdate(
        { userId },
        {
          $push: {
            history: {
              amount: totalAmount,
              originalAmount: totalAmount,
              discount: 0,
              type: "debit",
              walletBalance: user.wallet,
              dateCreated: new Date(),
              reason: "Order Payment",
              orderId: null, // Will be updated after order creation
            },
          },
        },
        { upsert: true, new: true, session }
      );
      console.log("Wallet debited:", totalAmount);
    }

    // Create the order
    const order = new Order({
      userId,
      name: req.user?.name || "Unknown", // Safe check for req.user
      orderedItems,
      shippingAddress,
      paymentMethod,
      paymentStatus,
      paymentId: method === "razorpay" ? null : paymentId, // Set paymentId for wallet, null for Razorpay
      totalAmount,
      orderedDate: new Date(),
      status: "Pending",
      couponApplied: {
        code: cart.couponCode || "",
        discount: cart.discountAmount || 0,
      },
    });

    await order.save({ session });

    // Update wallet history with orderId if wallet payment
    if (method === "styleovawallet") {
      await walletHistoryModel.findOneAndUpdate(
        { userId, "history.orderId": null },
        { $set: { "history.$.orderId": order._id } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    console.log("Order created (pending payment if Razorpay):", order._id);
    return res.status(HttpStatus.OK).json({
      success: true,
      message: method === "razorpay" ? "Order created, awaiting payment verification" : "Order created successfully",
      orderId: order._id,
      razorpayOrderId: method === "razorpay" ? paymentId : undefined,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating order:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Error creating order",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
exports.verifyPayment = async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, cartId, finalAmount, shippingAddress, paymentMethod } = req.body;

  try {
    // Check authentication
    if (!req.user) {
      console.log("Unauthorized attempt to verify payment");
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Validate inputs
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !cartId) {
      console.log("Missing payment details or cartId:", req.body);
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Missing required payment details or cart ID",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(cartId)) {
      console.log("Invalid cartId:", cartId);
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid Cart ID",
      });
    }

    // Verify signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      console.log("Invalid signature:", { generatedSignature, razorpay_signature });
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Payment verification failed: invalid signature",
      });
    }

    // Verify payment status
    const payment = await razorpayInstance.payments.fetch(razorpay_payment_id);
    if (payment.status !== "captured") {
      console.log("Payment not captured:", payment.status);
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Payment not captured: status is ${payment.status}`,
      });
    }

    // Validate payment amount
    if (payment.amount !== Math.round(parseFloat(finalAmount) * 100)) {
      console.log("Amount mismatch:", payment.amount, "vs", finalAmount);
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Payment amount does not match order amount",
      });
    }

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Fetch cart to populate order items (for verification)
      const cart = await Cart.findById(cartId).populate("products.productId").session(session);
      if (!cart) {
        console.log("Cart not found:", cartId);
        throw new Error("Cart not found");
      }

      // Find the existing order by cartId
      let order = await Order.findOne({ cartId }).session(session);
      if (!order) {
        // If no order exists, create one (though ideally it should exist from createOrder)
        const orderedItems = cart.products.map((item) => ({
          productId: item.productId._id,
          pname: item.productId.name,
          pimages: item.productId.images,
          originalPrice: item.productId.rate,
          price: item.productId.rate,
          quantity: item.quantity,
          size: item.size,
          offerDiscount: 0,
          status: "Pending",
        }));

        order = new Order({
          userId: req.user._id,
          cartId,
          totalAmount: finalAmount,
          shippingAddress,
          paymentMethod: paymentMethod || "Razorpay",
          paymentStatus: "Completed",
          paymentId: razorpay_payment_id, // Use paymentId as per your schema
          orderedDate: new Date(),
          status: "Pending",
          orderedItems,
          couponApplied: {
            code: cart.couponCode || "",
            discount: cart.discountAmount || 0,
          },
        });
      } else {
        // Update existing order with payment details
        order.paymentId = razorpay_payment_id;
        order.paymentStatus = "Completed";
      }

      // Save order and clean up cart
      await order.save({ session });
      await Cart.findByIdAndDelete(cartId, { session });

      await session.commitTransaction();
      session.endSession();

      console.log("Payment verified and order saved:", order._id);
      res.status(HttpStatus.OK).json({
        success: true,
        message: "Payment verified successfully",
        orderId: order._id,
      });
    } catch (dbError) {
      await session.abortTransaction();
      session.endSession();
      console.error("Database error in verifyPayment:", dbError);
      throw dbError;
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Payment verification failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = exports;