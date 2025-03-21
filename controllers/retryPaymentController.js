const mongoose = require('mongoose');
const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const Razorpay = require('razorpay');

// Initialize Razorpay with environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, 
  key_secret: process.env.RAZORPAY_KEY_SECRET, 
});

// Retry payment for a failed order
exports.retryPayment = async (req, res) => {
  try {
    const { orderId, amount } = req.query;
    const user = req.user;

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    // Find the order
    const order = await Order.findById(orderId).populate('orderedItems.productId');
    if (!order || order.userId.toString() !== user._id.toString()) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
    }

    // Check if order is eligible for retry
    if (order.status !== 'Pending' || order.paymentStatus !== 'Failed') {
      return res.status(400).json({ success: false, message: 'Order is not eligible for payment retry' });
    }

    // Verify product availability
    for (const item of order.orderedItems) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.productId} is no longer available. Please cancel the order.`,
        });
      }
      if (product.stock[item.size] === undefined || product.stock[item.size] < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} (Size: ${item.size}) is out of stock. Please cancel the order.`,
        });
      }
    }

    // Generate Razorpay order
    const paymentOptions = {
      amount: order.totalAmount * 100, // Convert to paise
      currency: 'INR',
      receipt: `order_${order._id}`,
      payment_capture: 1, // Auto-capture payment
    };

    const paymentResponse = await razorpay.orders.create(paymentOptions);

    // Return payment details to frontend
    res.status(200).json({
      success: true,
      paymentUrl: paymentResponse.id, // Razorpay order ID
      orderId: order._id,
      amount: order.totalAmount,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Error in retryPayment:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Handle payment success callback
exports.paymentSuccess = async (req, res) => {
  const { orderId, paymentId } = req.body;

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Update order status
    order.paymentStatus = 'Completed';
    order.status = 'Pending'; // Or 'Processing' depending on your flow
    order.paymentId = paymentId; // Store Razorpay payment ID
    await order.save();

    res.status(200).json({ success: true, message: 'Payment completed successfully' });
  } catch (error) {
    console.error('Error in paymentSuccess:', error);
    res.status(500).json({ success: false, message: 'Payment processing failed' });
  }
};