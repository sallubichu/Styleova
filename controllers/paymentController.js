const razorpayInstance = require("../config/razorpay");
const Order = require("../models/orderModel");

exports.createOrder = async (req, res) => {
  console.log('create order triggered');
  const { amount } = req.body;

  try {
    const options = {
      amount: parseFloat(amount) * 100, 
      currency: "INR",
      receipt: "order_receipt_" + Math.floor(Math.random() * 1000),
      payment_capture: 1, // Auto-capture payment
    };

    const order = await razorpayInstance.orders.create(options);

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyPayment = async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  const crypto = require("crypto");
  const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);

  hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
  const generatedSignature = hmac.digest("hex");

  if (generatedSignature === razorpay_signature) {
    res.status(200).json({ success: true, message: "Payment verified successfully" });
  } else {
    res.status(400).json({ success: false, message: "Payment verification failed" });
  }
};