const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const Order = require("../models/orderModel");
const WalletHistory = require("../models/wallethistoryModel");
const addressModel = require("../models/addressModel");
const mongoose = require("mongoose");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const HttpStatus = require('../utils/httpStatus'); // Import the enum
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const JWT_SECRET_KEY = "your-secret-key"; // Same secret used when creating the token

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "salmansulaiman0313@gmail.com",
    pass: "cauwfkxdqvrmmpis",
  },
});

const otpStore = new Map();

exports.editUser = async (req, res) => {
  try {
    let { name, email } = req.body;

    name = name?.trim();
    email = email?.trim();

    if (!name || !email) {
      return res.redirect("/user/profile?alert=error&message=Name and email are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.redirect("/user/profile?alert=error&message=Invalid email format");
    }

    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      return res.redirect("/user/profile?alert=error&message=User not found");
    }

    if (email !== currentUser.email) {
      const existingUser = await User.findOne({
        email: email,
        _id: { $ne: req.user._id },
      });
      if (existingUser) {
        return res.redirect("/user/profile?alert=error&message=Email already in use");
      }

      const otp = crypto.randomInt(100000, 999999).toString();
      otpStore.set(req.user._id.toString(), {
        email,
        otp,
        expires: Date.now() + 10 * 60 * 1000,
      });

      const mailOptions = {
        from: "salmansulaiman0313@gmail.com",
        to: email,
        subject: "Verify Your New Email - OTP",
        text: `Your OTP to verify your new email is: ${otp}. It is valid for 10 minutes.`,
      };

      await transporter.sendMail(mailOptions);
      console.log(`OTP sent to ${email}: ${otp}`);

      req.session.pendingUpdate = { name, email };
      return res.redirect("/user/verify-otp?alert=info&message=An OTP has been sent to your new email. Please verify.");
    }

    await User.findByIdAndUpdate(req.user._id, { name, email });
    res.redirect("/user/profile?alert=success&message=Profile updated successfully");
  } catch (error) {
    console.error("Error updating user:", error);
    res.redirect("/user/profile?alert=error&message=Error updating profile");
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const userId = req.user._id.toString();
    const storedData = otpStore.get(userId);

    if (!storedData || storedData.expires < Date.now()) {
      otpStore.delete(userId);
      return res.redirect("/user/verify-otp?alert=error&message=OTP has expired or is invalid");
    }

    if (storedData.otp !== otp) {
      return res.redirect("/user/verify-otp?alert=error&message=Invalid OTP");
    }

    const { name, email } = req.session.pendingUpdate;
    await User.findByIdAndUpdate(userId, { name, email });

    otpStore.delete(userId);
    delete req.session.pendingUpdate;

    res.redirect("/user/profile?alert=success&message=Profile updated successfully");
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.redirect("/user/verify-otp?alert=error&message=Error verifying OTP");
  }
};

exports.profile = async (req, res) => {
  try {
    if (req.user) {
      const user = await User.findById(req.user);
      if (!user) {
        return res.redirect("/?msg=nouser");
      }
      res.render("user/profile/Profile", { user });
    } else {
      res.redirect("/?msg=nouser");
    }
  } catch (ex) {
    console.log(ex.message);
    return res.status(HttpStatus.BAD_REQUEST).send("Invalid Token: " + ex.message);
  }
};


exports.address = async (req, res) => {
  try {
    let user = req.user;
    if (!user) {
      return res.redirect("/?msg=nouser");
    }
    const vilasam = await addressModel.find({ user: user._id });
    return res.render("user/profile/Address", { user, vilasam });
  } catch (ex) {
    console.error("Error in address controller:", ex);
    return res.status(HttpStatus.BAD_REQUEST).send("Invalid Token: " + ex.message);
  }
};

exports.addAddress = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(HttpStatus.BAD_REQUEST).send("No user logged in!");
    }

    const {
      name,
      mobileNumber,
      pincode,
      locality,
      address,
      district,
      state,
      landmark,
      alternateMobile,
    } = req.body;

    if (
      !name ||
      !mobileNumber ||
      !pincode ||
      !locality ||
      !address ||
      !district ||
      !state
    ) {
      return res.status(HttpStatus.BAD_REQUEST).send("All required fields must be provided");
    }

    if (!/^\d{10}$/.test(mobileNumber)) {
      return res.status(HttpStatus.BAD_REQUEST).send("Invalid mobile number");
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(HttpStatus.BAD_REQUEST).send("Invalid pincode");
    }

    const newAddress = new addressModel({
      user: user._id,
      name,
      mobileNumber,
      pincode,
      locality,
      address,
      district,
      state,
      landmark,
      alternateMobile,
    });

    await newAddress.save();
    res.redirect("/user/address");
  } catch (err) {
    console.error("Error adding address:", err);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send("Failed to add address");
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: "nouser" });
    }

    const id = req.params.id;
    const address = await addressModel.findById(id);

    if (!address) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Address not found" });
    }

    if (address.user.toString() !== req.user._id.toString()) {
      return res.status(HttpStatus.FORBIDDEN).json({ success: false, message: "Unauthorized" });
    }

    await addressModel.findByIdAndDelete(id);
    return res.status(HttpStatus.OK).json({ success: true, message: "success" });
  } catch (e) {
    console.error("Error deleting address:", e);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to delete address" });
  }
};

exports.editAddress = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect("/?msg=nouser");
    }

    const id = req.params.id;
    const dbData = await addressModel.findOne({ _id: id, user: req.user._id });

    if (!dbData) {
      return res.status(HttpStatus.NOT_FOUND).send("Address not found or unauthorized");
    }

    res.render("user/profile/editAddress", { address: dbData, user: req.user });
  } catch (e) {
    console.error("Error in editAddress controller:", e);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Update data page render error" });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ message: "Access Denied: No Token Provided!" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "User not found" });
    }

    const { id } = req.params;
    let {
      name,
      mobileNumber,
      mobilenumber,
      pincode,
      locality,
      address,
      district,
      state,
      landmark = "",
      alternateMobile,
      alternatemobile,
    } = req.body;

    mobileNumber = mobileNumber || mobilenumber || "";
    alternateMobile = alternateMobile || alternatemobile || "";

    console.log("Received Request Body:", req.body);
    console.log("Before Trim - mobileNumber:", mobileNumber, "Type:", typeof mobileNumber);
    console.log("Before Trim - alternateMobile:", alternateMobile, "Type:", typeof alternateMobile);

    mobileNumber = String(mobileNumber).trim();
    alternateMobile = String(alternateMobile).trim();

    console.log("After Trim - mobileNumber:", mobileNumber, "Length:", mobileNumber.length);
    console.log("After Trim - alternateMobile:", alternateMobile, "Length:", alternateMobile.length);

    if (!mobileNumber) {
      console.log("❌ Mobile number is missing or empty");
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Mobile number is required" });
    }

    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      console.log("❌ Invalid mobile number:", mobileNumber);
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid mobile number" });
    }

    if (alternateMobile && !/^[6-9]\d{9}$/.test(alternateMobile)) {
      console.log("❌ Invalid alternate mobile number:", alternateMobile);
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid alternate mobile number" });
    }

    if (mobileNumber === alternateMobile) {
      console.log("❌ Duplicate mobile numbers detected");
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: "Alternate mobile number cannot be the same as the primary mobile number",
      });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid pincode" });
    }

    const existingAddress = await addressModel.findOne({
      _id: id,
      user: decoded.userId,
    });

    if (!existingAddress) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Address not found or unauthorized" });
    }

    const updatedAddress = await addressModel.findByIdAndUpdate(
      id,
      {
        name,
        mobileNumber,
        pincode,
        locality,
        address,
        district,
        state,
        landmark,
        alternateMobile,
      },
      { new: true }
    );

    if (!updatedAddress) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Address not found or failed to update" });
    }

    return res.status(HttpStatus.OK).json({
      message: "Address updated successfully",
      updatedAddress,
    });
  } catch (ex) {
    console.error("❌ Error in updateAddress controller:", ex);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
  }
};



exports.orders = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(HttpStatus.UNAUTHORIZED).redirect('/login');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments({ userId: req.user._id });
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find({ userId: req.user._id })
      .sort({ orderedDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('orderedItems.productId');

    res.render("user/profile/myOrders", {
      user: req.user,
      orders,
      totalPages,
      currentPage: page,
      limit,
      total: totalOrders
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('error', { 
      message: 'An error occurred while fetching your orders. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
};

exports.viewOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate("userId", "username email")
      .populate("orderedItems.productId", "name imageUrl pimages")
      .populate("shippingAddress", "name address city state pincode mobileNumber");

    console.log("Fetched Order:", order);

    if (!order) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Order not found" });
    }

    if (!order.shippingAddress) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Shipping address not found" });
    }

    const user = await User.findById(order.userId);

    order.orderedItems.forEach((item) => {
      if (!item.productId.pimages || item.productId.pimages.length === 0) {
        item.productId.pimages = ["default.jpg"];
      }
    });

    res.render("user/profile/viewOrder", {
      order,
      user,
      name: user ? user.name : "Guest",
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error" });
  }
};

exports.cancelSingle = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const orderId = req.params.oid;
    const productId = req.query.pid;
    const size = req.query.size;

    console.log(`CancelSingle triggered: orderId=${orderId}, productId=${productId}, size=${size}`);

    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(productId) ||
      !size
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Invalid order, product ID, or size." });
    }

    const order = await Order.findById(orderId).session(session);
    if (!order || order.userId.toString() !== userId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Order not found or unauthorized." });
    }

    const orderedItem = order.orderedItems.find(
      (item) => item.productId.toString() === productId && item.size === size
    );
    if (!orderedItem) {
      await session.abortTransaction();
      session.endSession();
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Product with the specified size not found in the order." });
    }

    if (orderedItem.status === "Cancelled") {
      await session.abortTransaction();
      session.endSession();
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "This item is already canceled." });
    }

    // Update the status and log it
    orderedItem.status = "Cancelled";
    console.log(`Item status updated to Cancelled: productId=${productId}, size=${size}`);

    let refundAmount = 0;
    if (order.paymentStatus === "Completed") {
      // Calculate totals based on quantity
      const unitPrice = orderedItem.price; // Per-unit price
      const totalOriginalPrice = unitPrice * orderedItem.quantity; // Total price before discount
      const totalDiscount = orderedItem.offerDiscount || 0; // Total discount (not per-unit)
      refundAmount = totalOriginalPrice - totalDiscount; // Total refund amount

      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return res.status(HttpStatus.NOT_FOUND).json({ message: "User not found" });
      }

      user.wallet += refundAmount;
      await user.save({ session });

      console.log("Refund Amount:", refundAmount);
      console.log("Total Original Amount:", totalOriginalPrice);
      console.log("Total Discount:", totalDiscount);

      const walletHistoryUpdate = await WalletHistory.findOneAndUpdate(
        { userId: userId },
        {
          $push: {
            history: {
              amount: refundAmount, // Total refunded amount
              originalAmount: totalOriginalPrice, // Total price before discount
              discount: totalDiscount, // Total discount applied
              type: "credit",
              walletBalance: user.wallet,
              dateCreated: new Date(),
              reason: "Partial Order Cancellation Refund",
              orderId: order._id,
            },
          },
        },
        { new: true, upsert: true, session }
      );

      console.log("Wallet Updated:", user.wallet);
      console.log("Wallet History Updated:", JSON.stringify(walletHistoryUpdate, null, 2));
    }

    // Update stock
    const product = await Product.findById(productId).session(session);
    if (product && product.stock[size] !== undefined) {
      product.stock[size] += orderedItem.quantity;
      await product.save({ session });
      console.log(`Stock Updated: productId=${productId}, size=${size}, newStock=${product.stock[size]}`);
    }

    // Check if all items are cancelled
    const allCancelled = order.orderedItems.every((item) => item.status === "Cancelled");
    if (allCancelled) {
      order.status = "Cancelled";
      if (order.paymentStatus === "Completed") {
        order.paymentStatus = "Refunded";
      }
    }

    await order.save({ session });
    console.log("Order saved with updated status");

    await session.commitTransaction();
    session.endSession();

    console.log(`Cancellation completed: orderId=${orderId}, productId=${productId}, size=${size}`);

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "Item has been canceled successfully.",
      refundAmount: refundAmount,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error in cancelSingle:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred while canceling the item.",
      error: error.message,
    });
  }
};

exports.cancelOrder = async (req, res) => {
  console.log('cancelOrder triggered');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const orderId = req.params.oid;

    const userOrder = await Order.findById(orderId)
      .populate("orderedItems.productId")
      .populate("shippingAddress")
      .session(session);

    if (!userOrder || userOrder.userId.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "Order not found or unauthorized to cancel.",
      });
    }

    if (["Cancelled", "Delivered"].includes(userOrder.status)) {
      await session.abortTransaction();
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Order cannot be cancelled.",
      });
    }

    const wasPaid = userOrder.paymentStatus === "Completed";
    userOrder.status = "Cancelled";
    userOrder.paymentStatus = wasPaid ? "Refunded" : "Cancelled";

    if (wasPaid) {
      const refundAmount = userOrder.totalAmount;

      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        return res.status(HttpStatus.NOT_FOUND).json({ message: "User not found" });
      }

      user.wallet += refundAmount;
      await user.save({ session });

      console.log("Wallet Updated:", user.wallet);

      await WalletHistory.findOneAndUpdate(
        { userId: userId },
        {
          $push: {
            history: {
              amount: refundAmount,
              originalAmount: userOrder.couponApplied ? userOrder.totalAmount + userOrder.couponApplied.discount : userOrder.totalAmount,
              discount: userOrder.couponApplied ? userOrder.couponApplied.discount : 0,
              type: "credit",
              walletBalance: user.wallet,
              dateCreated: new Date(),
              reason: "Order Cancellation Refund",
              orderId: userOrder._id,
            },
          },
        },
        { new: true, upsert: true, session }
      );

      console.log("Wallet History Updated");
    }

    for (const orderedItem of userOrder.orderedItems) {
      const { productId, quantity, size } = orderedItem;

      const product = await Product.findById(productId).session(session);
      if (product && product.stock[size] !== undefined) {
        product.stock[size] += quantity;
        await product.save({ session });
        console.log("Stock Updated for Product:", productId, "Size:", size, "New Stock:", product.stock[size]);
      }
    }

    if (userOrder.couponApplied && userOrder.couponApplied.code) {
      userOrder.couponApplied = null;
    }

    await userOrder.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "Order cancelled and stock restored successfully.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error in cancelOrder:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Something went wrong while cancelling the order.",
      error,
    });
  }
};

exports.getWalletHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const walletHistory = await WalletHistory.findOne({ userId }).populate('userId');

    if (!walletHistory) {
      return res.status(HttpStatus.NOT_FOUND).render('user/profile/wallet', { history: [], user: req.user, page, totalPages: 0 });
    }

    const sortedHistory = walletHistory.history.sort((a, b) => b.dateCreated - a.dateCreated);

    const totalRecords = sortedHistory.length;
    const totalPages = Math.ceil(totalRecords / limit);

    const paginatedHistory = sortedHistory.slice(skip, skip + limit);

    res.render('user/profile/wallet', { history: paginatedHistory, user: req.user, page, totalPages });
  } catch (error) {
    console.error(error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Internal Server Error');
  }
};