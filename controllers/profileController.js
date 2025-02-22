const jwt = require("jsonwebtoken");
const User = require("../models/userModel"); // Assuming you have a User model
const Order = require("../models/orderModel"); // Assuming you have an Order model
const WalletHistory = require("../models/wallethistoryModel");
const addressModel = require("../models/addressModel");
const mongoose = require("mongoose");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");


const JWT_SECRET_KEY = "your-secret-key"; // Same secret used when creating the token

exports.profile = async (req, res) => {
  // Extract the JWT token from the cookies
  try {
    if (req.user) {
      // Fetch the user details from the database using req.user (which is the userId)
      const user = await User.findById(req.user); // Find the user by userId from JWT
      if (!user) {
        return res.redirect("/?msg=nouser");
      }
      console.log(user);
      // Render the profile page with the user data
      res.render("user/profile/Profile", { user });
    } else {
      res.redirect("/?msg=nouser");
    }
  } catch (ex) {
    console.log(ex.message);
    return res.status(400).send("Invalid Token: " + ex.message);
  }
};

exports.address = async (req, res) => {
  try {
    let user = req.user;
    if (!user) {
      return res.redirect("/?msg=nouser"); // Ensure you return the redirect
    }
    const vilasam = await addressModel.find({ user: user._id });
    return res.render("user/profile/Address", { user, vilasam });
  } catch (ex) {
    console.error("Error in address controller:", ex);
    return res.status(400).send("Invalid Token: " + ex.message);
  }
};

exports.addAddress = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(400).send("No user logged in!");
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

    // Validate input
    if (
      !name ||
      !mobileNumber ||
      !pincode ||
      !locality ||
      !address ||
      !district ||
      !state
    ) {
      return res.status(400).send("All required fields must be provided");
    }

    // Validate mobile number (10 digits)
    if (!/^\d{10}$/.test(mobileNumber)) {
      return res.status(400).send("Invalid mobile number");
    }

    // Validate pincode (6 digits)
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).send("Invalid pincode");
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
    return res.status(500).send("Failed to add address");
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "nouser" });
    }

    const id = req.params.id;
    const address = await addressModel.findById(id);

    if (!address) {
      return res
        .status(404)
        .json({ success: false, message: "Address not found" });
    }

    // Ensure the address belongs to the logged-in user
    if (address.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    await addressModel.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "success" });
  } catch (e) {
    console.error("Error deleting address:", e);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete address" });
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
      return res.status(404).send("Address not found or unauthorized");
    }

    res.render("user/profile/editAddress", { address: dbData, user: req.user });
  } catch (e) {
    console.error("Error in editAddress controller:", e);
    res.status(500).json({ message: "Update data page render error" });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    // Check if token exists
    const token = req.cookies.token;
    if (!token) {
      return res
        .status(401)
        .json({ message: "Access Denied: No Token Provided!" });
    }

    // Verify token and fetch user
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const { id } = req.params;
    let {
      name,
      mobileNumber,
      mobilenumber, // Some requests may send this instead
      pincode,
      locality,
      address,
      district,
      state,
      landmark = "",
      alternateMobile,
      alternatemobile, // Some requests may send this instead
    } = req.body;

    // 🚀 Ensure correct field handling
    mobileNumber = mobileNumber || mobilenumber || "";
    alternateMobile = alternateMobile || alternatemobile || "";

    // 🚀 Debugging logs
    console.log("Received Request Body:", req.body);
    console.log(
      "Before Trim - mobileNumber:",
      mobileNumber,
      "Type:",
      typeof mobileNumber
    );
    console.log(
      "Before Trim - alternateMobile:",
      alternateMobile,
      "Type:",
      typeof alternateMobile
    );

    // Convert to string and trim safely
    mobileNumber = String(mobileNumber).trim();
    alternateMobile = String(alternateMobile).trim();

    console.log(
      "After Trim - mobileNumber:",
      mobileNumber,
      "Length:",
      mobileNumber.length
    );
    console.log(
      "After Trim - alternateMobile:",
      alternateMobile,
      "Length:",
      alternateMobile.length
    );

    // Ensure mobile number exists
    if (!mobileNumber) {
      console.log("❌ Mobile number is missing or empty");
      return res.status(400).json({ message: "Mobile number is required" });
    }

    // Validate mobile number (10 digits, starts with 6-9)
    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      console.log("❌ Invalid mobile number:", mobileNumber);
      return res.status(400).json({ message: "Invalid mobile number" });
    }

    // Validate alternate mobile number (if provided)
    if (alternateMobile && !/^[6-9]\d{9}$/.test(alternateMobile)) {
      console.log("❌ Invalid alternate mobile number:", alternateMobile);
      return res
        .status(400)
        .json({ message: "Invalid alternate mobile number" });
    }

    // Prevent duplicate mobile numbers
    if (mobileNumber === alternateMobile) {
      console.log("❌ Duplicate mobile numbers detected");
      return res.status(400).json({
        message:
          "Alternate mobile number cannot be the same as the primary mobile number",
      });
    }

    // Validate pincode (6 digits)
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ message: "Invalid pincode" });
    }

    // Ensure the address belongs to the logged-in user
    const existingAddress = await addressModel.findOne({
      _id: id,
      user: decoded.userId,
    });

    if (!existingAddress) {
      return res
        .status(404)
        .json({ message: "Address not found or unauthorized" });
    }

    // ✅ Fix: Correct field names in update
    const updatedAddress = await addressModel.findByIdAndUpdate(
      id,
      {
        name,
        mobileNumber, // Correct field name
        pincode,
        locality,
        address,
        district,
        state,
        landmark,
        alternateMobile, // Correct field name
      },
      { new: true }
    );

    if (!updatedAddress) {
      return res
        .status(404)
        .json({ message: "Address not found or failed to update" });
    }

    return res.status(200).json({
      message: "Address updated successfully",
      updatedAddress,
    });
  } catch (ex) {
    console.error("❌ Error in updateAddress controller:", ex);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.editUser = async (req, res) => {
  try {
    const { name, email } = req.body;

    // Validate input
    if (!name || !email) {
      req.flash("error", "Name and email are required");
      return res.redirect("/user/profile");
    }

    // Check if email exists
    const existingUser = await User.findOne({
      email: email,
      _id: { $ne: req.user._id },
    });
    if (existingUser) {
      req.flash("error", "Email already in use");
      return res.redirect("/user/profile");
    }

    // Update user
    await User.findByIdAndUpdate(req.user._id, {
      name: name,
      email: email,
    });

    req.flash("success", "Profile updated successfully");
    res.redirect("/user/profile");
  } catch (error) {
    console.error(error);
    req.flash("error", "Error updating profile");
    res.redirect("/user/profile");
  }
};

exports.orders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; 
    const limit = 5; // 
    const skip = (page - 1) * limit; // 

    const totalOrders = await Order.countDocuments({ userId: req.user._id }); 
    const totalPages = Math.ceil(totalOrders / limit); 

    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip) // Skip orders based on current page
      .limit(limit); 

    res.render("user/profile/myOrders", {
      user: req.user,
      orders,
      totalPages,
      currentPage: page, // Pass the current page to the template
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

exports.viewOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId)
      .populate("userId", "username email")
      .populate("orderedItems.productId", "name imageUrl pimages")
      .populate(
        "shippingAddress",
        "name address city state pincode mobileNumber"
      );

    console.log("Fetched Order:", order);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!order.shippingAddress) {
      return res.status(400).json({ message: "Shipping address not found" });
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
    res.status(500).json({ message: "Internal Server Error" });
  }
};



exports.cancelSingle = async (req, res) => {
  try {
    const userId = req.user._id;
    const orderId = req.params.oid;
    const productId = req.query.pid;
    const size = req.query.size; // Add size to the request query

    // Validate orderId, productId, and size
    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(productId) ||
      !size
    ) {
      return res.status(400).json({ success: false, message: "Invalid order, product ID, or size." });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order || order.userId.toString() !== userId.toString()) {
      return res.status(404).json({ success: false, message: "Order not found or unauthorized." });
    }

    // Find the ordered item based on productId AND size
    const orderedItem = order.orderedItems.find(
      (item) =>
        item.productId.toString() === productId &&
        item.size === size // Check the size
    );
    if (!orderedItem) {
      return res.status(404).json({ success: false, message: "Product with the specified size not found in the order." });
    }

    // Check if the item is already canceled
    if (orderedItem.status === "Cancelled") {
      return res.status(400).json({ success: false, message: "This item is already canceled." });
    }

    // Mark the item as canceled
    orderedItem.status = "Cancelled";

    // Calculate refund amount
    let refundAmount = 0;
    if (order.paymentStatus === "Completed") {
      refundAmount = orderedItem.price - orderedItem.offerDiscount;

      // Update user wallet
      const user = await User.findById(userId);
      user.wallet += refundAmount;
      await user.save();

      // Update wallet history
      await WalletHistory.findOneAndUpdate(
        { userId: userId },
        {
          $push: {
            history: {
              amount: refundAmount,
              type: "credit",
              walletBalance: user.wallet,
              dateCreated: new Date(),
            },
          },
        },
        { new: true, upsert: true } // Create a new document if it doesnt exist
      );
    }

    // Restore product stock for the specific size
    const product = await Product.findById(productId);
    if (product) {
      if (product.stock && product.stock[size] !== undefined) {
        product.stock[size] += orderedItem.quantity;
        await product.save();
      }
    }

    // Check if all items in the order are canceled
    const allCancelled = order.orderedItems.every((item) => item.status === "Cancelled");
    if (allCancelled) {
      order.status = "Cancelled";
      if (order.paymentStatus === "Completed") {
        order.paymentStatus = "Refunded";
      }
    }

    // Save the updated order
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Item has been canceled successfully.",
      refundAmount: refundAmount,
    });
  } catch (error) {
    console.error("Error in cancelSingle:", error);
    return res.status(500).json({ success: false, message: "An error occurred while canceling the item." });
  }
};

exports.cancelOrder = async (req, res) => {
  console.log('cancelOrder triggered');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const orderId = req.params.oid;

    // Find the order and check if it belongs to the user
    const userOrder = await Order.findById(orderId)
      .populate("orderedItems.productId")
      .populate("shippingAddress")
      .session(session);

    if (!userOrder || userOrder.userId.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Order not found or unauthorized to cancel.",
      });
    }

    // Check if the order is already cancelled or delivered
    if (["Cancelled", "Delivered"].includes(userOrder.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled.",
      });
    }

    // Update order status
    const wasPaid = userOrder.paymentStatus === "Completed";
    userOrder.status = "Cancelled";
    userOrder.paymentStatus = wasPaid ? "Refunded" : "Cancelled";

    // Refund the wallet if paid
    if (wasPaid) {
      const refundAmount = userOrder.totalAmount;

      // Update user wallet
      const user = await User.findById(userId).session(session);
      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({ message: "User not found" });
      }

      user.wallet += refundAmount;
      await user.save({ session });

      console.log("Wallet Updated:", user.wallet);

      // Update wallet history
      await WalletHistory.findOneAndUpdate(
        { userId: userId },
        {
          $push: {
            history: {
              amount: refundAmount,
              type: "credit",
              walletBalance: user.wallet,
              dateCreated: new Date(),
              reason: "Order Cancellation Refund",
            },
          },
        },
        { new: true, upsert: true, session }
      );

      console.log("Wallet History Updated");
    }

    // Restock the cancelled items
    for (const orderedItem of userOrder.orderedItems) {
      const { productId, quantity, size } = orderedItem;

      const product = await Product.findById(productId).session(session);
      if (product && product.stock[size] !== undefined) {
        product.stock[size] += quantity; // Restore stock for the correct size
        await product.save({ session });
        console.log("Stock Updated for Product:", productId, "Size:", size, "New Stock:", product.stock[size]);
      }
    }

    // Remove applied coupon if necessary
    if (userOrder.couponApplied && userOrder.couponApplied.code) {
      userOrder.couponApplied = null;
    }

    await userOrder.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Order cancelled and stock restored successfully.",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Error in cancelOrder:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while cancelling the order.",
      error,
    });
  }
};



exports.getWalletHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1; // Get page number from query params
    const limit = 10; // Number of items per page
    const skip = (page - 1) * limit;

    // Fetch wallet history
    const walletHistory = await WalletHistory.findOne({ userId }).populate('userId');

    if (!walletHistory) {
      return res.status(404).render('wallet', { history: [], user: req.user, page, totalPages: 0 });
    }

    // Sort history by newest first (descending order)
    const sortedHistory = walletHistory.history.sort((a, b) => b.dateCreated - a.dateCreated);

    const totalRecords = sortedHistory.length;
    const totalPages = Math.ceil(totalRecords / limit);

    // Paginate history
    const paginatedHistory = sortedHistory.slice(skip, skip + limit);

    res.render('user/profile/wallet', { history: paginatedHistory, user: req.user, page, totalPages });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

