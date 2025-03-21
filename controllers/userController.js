const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const JWT_SECRET = "your_jwt_secret";
const validator = require("validator");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const cartModel = require("../models/cartModel");
const addressModel = require("../models/addressModel");
const passport = require("passport");
const orderModel = require("../models/orderModel");
const mongoose = require("mongoose");
const walletHistoryModel = require("../models/wallethistoryModel");
const OTP = require("../models/otpModel");
const HttpStatus = require('../utils/httpStatus');
const razorpayInstance = require("../config/razorpay");

const JWT_SECRET_KEY = "your_jwt_secret";

// Nodemailer Transporter Setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "salmansulaiman0313@gmail.com", // Replace with your Gmail
    pass: "cauwfkxdqvrmmpis", // Replace with your email password
  },
});

// Function to generate a 6-digit OTP
function generateNumericOtp(length = 6) {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

async function sendOTP(email, otp) {
  const mailOptions = {
    from: "salmansulaiman0313@gmail.com", // Replace with your email
    to: email,
    subject: "Your OTP for Sign-Up",
    text: `Your OTP for sign-up is: ${otp}`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent", info.response);
    return true;
  } catch (e) {
    console.error("Error: ", e);
    return false;
  }
}

// Controller to handle user registration and OTP generation

exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email" });
    }

    if (
      !password ||
      !validator.isStrongPassword(password, {
        minLength: 8,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      })
    ) {
      return res.status(400).json({ message: "Weak password!" });
    }

    // Check if the user already exists (fully registered)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate OTP
    const otp = generateNumericOtp();

    // Hash OTP before storing
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Save OTP in the otps collection with expiration (5 mins)
    await OTP.updateOne(
      { email },
      { $set: { otp: hashedOtp, otpExpires: Date.now() + 5 * 60 * 1000 } },
      { upsert: true }
    );

    // Send OTP via email
    const otpSent = await sendOTP(email, otp);
    if (!otpSent) {
      return res.status(500).json({ message: "Failed to send OTP." });
    }

    res.status(200).json({ message: "OTP sent to your email." });
  } catch (error) {
    console.error("Error during registration: ", error);
    res.status(500).json({ message: "Error during registration." });
  }
};

exports.renderSignup = (req, res) => {
  res.render("user/signup", { errorMessage: null });
};

// Verify OTP entered by the user

exports.verifyOtp = async (req, res) => {
  const { email, otp, name, password } = req.body;

  try {
    // Validate password
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
      });
    }

    // Find the OTP record for the email
    const otpRecord = await OTP.findOne({
      email,
      otpExpires: { $gt: Date.now() },
    });
    if (!otpRecord) {
      return res.status(400).json({
        message: "OTP has expired or is invalid. Please request a new one.",
      });
    }

    // Compare the OTP entered by the user with the stored OTP
    const isOtpValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isOtpValid) {
      return res
        .status(400)
        .json({ message: "Invalid OTP. Please try again." });
    }

    // Check if the user already exists (fully registered)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists." });
    }

    // Hash the password before saving it
    const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

    // Create a new user with the hashed password
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });

    // Save the user to the database
    await newUser.save();

    // Delete the OTP record after successful verification
    await OTP.deleteOne({ email });

    // Respond with a success message and redirect URL
    res.status(200).json({
      message: "User registered successfully!",
      redirectUrl: "/user/login", // The URL to redirect to after registration
    });
  } catch (error) {
    console.error("Error during OTP verification: ", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
};
// Resend OTP function
exports.resendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    // Generate a new OTP
    const otp = generateNumericOtp();

    // Set OTP and expiration time in cookies (expires in 5 minutes)
    const expirationTime = Date.now() + 5 * 60 * 1000; // 5 minutes expiration time
    res.cookie("otp", otp, { httpOnly: true, maxAge: expirationTime });
    res.cookie("otpExpiresAt", expirationTime, {
      httpOnly: true,
      maxAge: expirationTime,
    });

    // Send OTP to user email
    sendOTP(email, otp);

    // Respond with a success message
    res.json({ message: "OTP resent to your email." });
  } catch (error) {
    console.error("Error during OTP resend: ", error);
    res.status(500).send("Error during OTP resend");
  }
};

exports.loginRender = async (req, res) => {
  res.render("user/login");
};
// Assuming Category model exists

exports.userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.redirect('/user/login?msg=invalid+password+or+username');
    }

    // Check if the user is blocked
    if (user.status === 'blocked') {
      return res.redirect('/user/login?msg=block');
    }

    // Check if password field exists in the user object
    if (!user.password) {
      console.error('Password field is missing for user:', user);
      return res.redirect('/user/login?msg=invalid+password+or+username');
    }

    // Debugging logs
    console.log('Plaintext Password:', password);
    console.log('Hashed Password:', user.password);

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.redirect('/user/login?msg=invalid+password+or+username');
    }

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: '1h',
    });

    // Generate Refresh Token
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_SECRET_KEY,
      {
        expiresIn: '7d',
      }
    );

    // Set tokens in cookies
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Secure in production
      sameSite: 'strict',
      maxAge: 3600000, // 1 hour in milliseconds
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Secure in production
      sameSite: 'strict',
      maxAge: 604800000, // 7 days in milliseconds
    });

    // Fetch categories (if needed for the dashboard)
    const categories = await Category.find();

    // Redirect to the dashboard after successful login
    return res.redirect('/user/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};



exports.showDashboard = async (req, res) => {
  try {
    const user = req.user; // From verifyUser middleware
    console.log("Dashboard user:", user ? user.email : "No user found"); // Debug user

    // Fetch only listed categories
    const category = await Category.find({ listing: true });
    console.log("Listed categories fetched:", category.length); // Debug number of listed categories

    // Pass user as a boolean to match EJS expectation
    res.render("user/index", {
      user: !!user, // Convert to boolean: true if user exists, false otherwise
      category, // Array of only listed categories
    });
  } catch (error) {
    console.error("Error in showDashboard:", error);
    res.redirect("/user/login?msg=dashboarderror"); // Graceful redirect on error
  }
};

exports.productDetailed = async (req, res) => {
  try {
    let user = req.user;

    const data = await Product.findById(req.params.id).populate("category");
    const similar = await Product.find({ listing: true })
      .populate("category")
      .limit(4);

    if (!data || data.listing === false) {
      return res.redirect("/?msg=noexists");
    }

    res.render("user/productDetailed", { data, user, similar });
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
};

exports.logout = (req, res) => {
  res.clearCookie("token");
  res.clearCookie("refreshToken");
  res.status(200).json({ message: "Logged out successfully" });
};
exports.forgot = async (req, res) => {
  try {
    if (req.user) {
      const userEmail = req.user.email;

      // Check if the user has a password set
      if (!req.user.password) {
        return res.redirect("/user/profile?msg=noPass");
      }

      return res.render("user/profile/forgotPassword", { user: userEmail });
    } else {
      return res.render("user/profile/forgotPassword", { user: "loggedout" });
    }
  } catch (error) {
    console.error("Error in forgotPassword:", error.message);
    res.status(500).send("Internal Server Error!");
  }
};


exports.placeOrder = async (req, res) => {
  console.log("Received Request Body:", req.body);
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = req.user;
    if (!user || !user._id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        error: "User not authenticated",
      });
    }

    const { cartId, paymentMethod, paymentStatus, shippingAddress, finalAmount, razorpayPaymentId, initiateRazorpay } = req.body;

    // Check for existing order unconditionally
    const existingOrder = await orderModel.findOne({ cartId }).session(session);
    if (existingOrder) {
      console.log("Duplicate order detected for cartId:", cartId, "Existing order:", existingOrder._id);
      await session.abortTransaction();
      session.endSession();
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: "Order already exists for this cart",
        existingOrderId: existingOrder._id,
      });
    }

    const [cart, address] = await Promise.all([
      cartModel.findById(cartId).populate("products.productId", "name images rate stock").session(session),
      addressModel.findById(shippingAddress).session(session),
    ]);

    if (!cart || !cart.products || cart.products.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: "Cart is empty or invalid",
      });
    }
    if (!address) {
      await session.abortTransaction();
      session.endSession();
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: "Shipping address not found",
      });
    }

    // Calculate original total and discount
    let originalTotal = 0;
    cart.products.forEach((item) => (originalTotal += item.productId.rate * item.quantity));
    
    const discountAmount = parseFloat(cart.discountAmount) || 0;
    const totalAmount = parseFloat(finalAmount) || (originalTotal - discountAmount);
    const amountInPaise = Math.round(totalAmount * 100);

    console.log("Original Total (INR):", originalTotal);
    console.log("Discount Amount (INR):", discountAmount);
    console.log("Amount Paid (INR):", totalAmount);

    // Distribute discount across items proportionally
    const orderedItems = cart.products.map((item) => {
      const itemTotal = item.productId.rate * item.quantity;
      let offerDiscount = 0;
      if (discountAmount > 0 && originalTotal > 0) {
        offerDiscount = Math.round((itemTotal / originalTotal) * discountAmount);
      }
      return {
        productId: item.productId._id,
        pname: item.productId.name,
        pimages: item.productId.images,
        originalPrice: item.productId.rate,
        price: item.productId.rate,
        quantity: item.quantity,
        size: item.size,
        offerDiscount: offerDiscount,
        status: "Pending",
      };
    });

    // Verify stock availability
    const productIds = orderedItems.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).session(session);

    for (const item of orderedItems) {
      const product = products.find((p) => p._id.toString() === item.productId.toString());
      if (!product || !product.stock[item.size] || product.stock[item.size] < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: `Insufficient stock for ${item.pname} (${item.size})`,
        });
      }
    }

    let resolvedPaymentStatus = paymentStatus || "Pending";
    let paymentId = null;
    let updatedUser = null;

    if (paymentMethod.toLowerCase().replace(/\s+/g, "") === "razorpay") {
      if (initiateRazorpay) {
        const razorpayOrder = await razorpayInstance.orders.create({
          amount: amountInPaise,
          currency: "INR",
          receipt: `order_${cartId}`,
        });
        await session.abortTransaction();
        session.endSession();
        return res.status(HttpStatus.OK).json({
          success: true,
          razorpayOrderId: razorpayOrder.id,
          message: "Razorpay order initiated",
        });
      } else if (razorpayPaymentId) {
        const payment = await razorpayInstance.payments.fetch(razorpayPaymentId);
        console.log("Razorpay payment details:", payment);
        if (payment.status === "captured" && payment.amount === amountInPaise) {
          resolvedPaymentStatus = "Completed";
          paymentId = razorpayPaymentId;
        } else {
          resolvedPaymentStatus = "Failed";
          paymentId = razorpayPaymentId;
        }
      } else if (paymentStatus === "Failed") {
        resolvedPaymentStatus = "Failed";
        paymentId = null;
      } else {
        await session.abortTransaction();
        session.endSession();
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: "Missing Razorpay payment ID or invalid payment status",
        });
      }
    } else if (paymentMethod === "Styleova Wallet") {
      const userWallet = await User.findById(user._id).select("wallet").session(session);
      if (!userWallet || userWallet.wallet < totalAmount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: "Insufficient wallet balance",
        });
      }

      updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $inc: { wallet: -totalAmount } },
        { new: true, session }
      );
      resolvedPaymentStatus = "Completed";
    } else if (paymentMethod.toLowerCase().replace(/\s+/g, "") === "cod") {
      resolvedPaymentStatus = "Pending"; // COD remains pending until delivery
    }

    const order = new orderModel({
      userId: user._id,
      name: address.name,
      orderedItems,
      orderedDate: new Date(),
      status: "Pending",
      shippingAddress: address._id,
      paymentMethod,
      paymentStatus: resolvedPaymentStatus,
      paymentId,
      totalAmount,
      couponApplied: {
        code: cart.couponCode || "",
        discount: discountAmount,
      },
      cartId, // Store cartId explicitly for reference
    });

    await order.save({ session });

    if (paymentMethod === "Styleova Wallet" && updatedUser) {
      await walletHistoryModel.findOneAndUpdate(
        { userId: user._id },
        {
          $push: {
            history: {
              amount: totalAmount,
              originalAmount: originalTotal,
              discount: discountAmount,
              type: "debit",
              walletBalance: updatedUser.wallet,
              dateCreated: new Date(),
              reason: "Order Payment",
              orderId: order._id,
            },
          },
        },
        { new: true, upsert: true, session }
      );
    }

    // Delete cart regardless of payment status to prevent reuse
    await cartModel.findByIdAndDelete(cartId, { session });

    // Update stock only if payment is completed (not for COD or failed payments)
    if (resolvedPaymentStatus === "Completed") {
      for (const item of orderedItems) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { [`stock.${item.size}`]: -item.quantity } },
          { session }
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    console.log("Order placed successfully:", order._id);
    return res.status(HttpStatus.OK).json({
      success: true,
      message: resolvedPaymentStatus === "Failed" ? "Order created with payment failure" : "Order placed successfully",
      order: {
        orderId: order._id,
        paymentStatus: order.paymentStatus,
        orderDate: order.orderedDate,
        orderStatus: order.status,
        originalAmount: originalTotal,
        discountAmount: discountAmount,
        amountPaid: totalAmount,
        paymentMethod: order.paymentMethod,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error placing order:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Something went wrong. Please try again.",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.forgotPassword = async (req, res) => {
  console.log("forgot triggered");
  const { email } = req.body;

  try {
    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate OTP
    const otp = generateNumericOtp();

    // Set OTP and expiration time in cookies
    res.cookie("forgotPasswordOtp", otp, {
      httpOnly: true,
      maxAge: 5 * 60 * 1000, // 5 minutes
      secure: process.env.NODE_ENV === "production",
    });

    // Send OTP to the user email
    const otpSent = await sendOTP(email, otp);
    if (!otpSent) {
      return res
        .status(500)
        .json({ message: "Failed to send OTP. Please try again later." });
    }

    // Respond with success message
    res
      .status(200)
      .json({ message: "OTP sent to your email for password reset." });
  } catch (error) {
    console.error("Error during forgot password OTP send: ", error);
    res
      .status(500)
      .json({ message: "An error occurred. Please try again later." });
  }
};

exports.verifyForgotPasswordOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    // Check if the OTP stored in cookies matches the OTP entered by the user
    const storedOtp = req.cookies.forgotPasswordOtp;

    if (!storedOtp) {
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new one." });
    }

    // Compare the OTP entered by the user with the stored OTP
    if (otp !== storedOtp) {
      return res
        .status(400)
        .json({ message: "Invalid OTP. Please try again." });
    }

    // Respond with success message
    res.status(200).json({
      message: "OTP verified successfully. You can now reset your password.",
    });
  } catch (error) {
    console.error("Error during OTP verification for forgot password: ", error);
    res
      .status(500)
      .json({ message: "An error occurred. Please try again later." });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate the new password
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user password
    user.password = hashedPassword;
    await user.save();

    // Clear the OTP cookie
    res.clearCookie("forgotPasswordOtp");

    // Respond with success message
    res.status(200).json({
      message:
        "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Error during password reset: ", error);
    res
      .status(500)
      .json({ message: "An error occurred. Please try again later." });
  }
};

exports.logout = async (req, res) => {
  try {
    res.clearCookie("token");
    res.redirect("/user/login?msg=loggedout");
  } catch (e) {
    console.log(e);
    res.status(500).send("Error");
  }
};


exports.filterSort = async (req, res) => {
  try {
    const user = req.user;
    const {
      search = "", // Default to empty string if undefined
      sort = "objectId",
      filter = [],
      limit = 5,
    } = req.query;
    let { page = 1 } = req.query;

    // Ensure filters is an array
    const filters = Array.isArray(filter) ? filter : filter ? [filter] : [];

    // Fetch listed category IDs
    const listedCategoryIds = await Category.find({ listing: true }).distinct('_id');
    console.log("Listed category IDs:", listedCategoryIds.map(id => id.toString()));

    // Fetch popular products from listed categories
    const popularProducts = await Product.find({
      listing: true,
      category: { $in: listedCategoryIds },
    })
      .sort({ rating: -1 })
      .limit(4)
      .populate("category");
    console.log("Popular products:", popularProducts.map(p => ({
      name: p.name,
      category: p.category.name,
      categoryListing: p.category.listing,
    })));

    // Validate and filter category IDs from query
    const validFilters = filters.filter(id => 
      mongoose.Types.ObjectId.isValid(id) && listedCategoryIds.some(lid => lid.toString() === id)
    );
    console.log("Valid filters:", validFilters);

    // Define sort options
    const sortOptions = {
      price_lowtohigh: { rate: 1 },
      price_hightolow: { rate: -1 },
      name_lowtohigh: { name: 1 },
      name_hightolow: { name: -1 },
      objectId: { _id: -1 },
    };
    const sortCriteria = sortOptions[sort] || sortOptions.objectId;

    // Build query for products
    const query = {
      name: { $regex: search, $options: "i" },
      listing: true,
      category: { $in: listedCategoryIds }, // Restrict to listed categories
    };
    if (validFilters.length > 0) {
      query.category = { $in: validFilters }; // Override with user-selected filters
    }

    // Pagination
    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    page = Math.max(1, Math.min(totalPages, parseInt(page)));

    // Fetch products
    const products = await Product.find(query)
      .populate("category")
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    console.log("Filtered products:", products.map(p => ({
      name: p.name,
      category: p.category.name,
      categoryListing: p.category.listing,
    })));

    // Fetch all listed categories for UI
    const category = await Category.find({ listing: true });

    res.render("user/products", {
      user,
      products,
      currentPage: parseInt(page),
      totalPages,
      searchQuery: search || "",
      selectedFilters: validFilters,
      selectedSort: sort,
      category,
      popularProducts,
    });
  } catch (error) {
    console.error("Error in filterSort:", error.message);
    res.status(500).send("An error occurred while processing your request.");
  }
};


exports.renderOrderPlaced = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await orderModel.findById(orderId)
      .populate("orderedItems.productId")
      .populate("shippingAddress");
    if (!order || order.userId.toString() !== req.user._id.toString()) {
      return res.status(HttpStatus.NOT_FOUND).render("error", { message: "Order not found" });
    }
    res.render("user/orderPlaced", {
      user: true,
      paymentStatus: order.paymentStatus,
      orderId: order._id,
      orderDate: order.orderedDate,
      orderStatus: order.status,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      shippingAddress: order.shippingAddress,
      orderedItems: order.orderedItems,
    });
  } catch (error) {
    console.error("Error rendering order placed page:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render("error", { message: "Something went wrong" });
  }
};

exports.requestReturn = async (req, res) => {
    console.log('Return request triggered for orderId:', req.params.orderId);
    try {
        const { orderId } = req.params;
        const { productId, size, amount, returnReason } = req.body;
        const user = req.user;

        // Log incoming data for debugging
        console.log('Request body:', { productId, size, amount, returnReason });
        console.log('User ID:', user._id);

        // Validate inputs
        if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(productId)) {
            console.log('Invalid ID format');
            return res.status(400).json({ success: false, message: 'Invalid order or product ID' });
        }

        // Find the order
        const order = await orderModel.findById(orderId);
        if (!order) {
            console.log('Order not found');
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (order.userId.toString() !== user._id.toString()) {
            console.log('Unauthorized user');
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Check order status
        if (order.status !== 'Delivered') {
            console.log('Order not delivered');
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }

        // Check return window (7 days)
        const deliveredDate = order.deliveredDate || order.updatedAt;
        const daysSinceDelivered = (new Date() - new Date(deliveredDate)) / (1000 * 60 * 60 * 24);
        if (daysSinceDelivered > 7) {
            console.log('Return period expired');
            return res.status(400).json({ success: false, message: 'Return period (7 days) has expired' });
        }

        // Find the specific item in orderedItems
        const itemIndex = order.orderedItems.findIndex(
            item => item.productId.toString() === productId && item.size === size
        );
        if (itemIndex === -1) {
            console.log('Item not found in order');
            return res.status(404).json({ success: false, message: 'Item not found in order' });
        }

        const item = order.orderedItems[itemIndex];
        if (item.returnRequested || item.returned) {
            console.log('Return already requested or processed');
            return res.status(400).json({ success: false, message: 'Return already requested or processed' });
        }

        // Update item status
        item.returnRequested = true;
        item.returnReason = returnReason || 'No reason provided';
        item.status = 'Return Requested';

        // Save the updated order
        await order.save();
        console.log('Order updated successfully:', order._id);

        res.status(200).json({
            success: true,
            message: 'Return request submitted successfully. Awaiting admin approval.',
        });
    } catch (error) {
        console.error('Error in requestReturn:', error.stack);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};