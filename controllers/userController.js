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
        .json({ message: "Email and Password are required" });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.redirect("/user/login?msg=invalid password or username");
    }

    const category = await Category.find({});

    if (user.status == "blocked") {
      return res.redirect("/user/login?msg=block");
    }
    console.log("Plaintext Password:", password);
    console.log("Hashed Password:", user.password);

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.redirect("/user/login?msg=invalid password or username");
    }

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "1h",
    });
    console.log(process.env.JWT_SECRET_KEY);

    // Generate Refresh Token
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_SECRET_KEY,
      {
        expiresIn: "7d",
      }
    );

    // Set tokens in cookies
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    const categories = await Category.find();
    return res.redirect("/user/dashboard");
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.showDashboard = async (req, res) => {
  const user = req.user;
  const category = await Category.find();
  res.render("user/index", { user, category });
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
    let user = req.user;
    if (!user) {
      return res.redirect("/?msg=nouser");
    }

    let {
      couponId,
      cartId,
      paymentMethod,
      paymentStatus,
      shippingAddress, // Ensure this is correctly passed from the form
    } = req.body;

    const authCouponId = couponId && couponId !== "null" ? couponId : null;

    // Fetch cart, address, and coupon in parallel
    const [usercart, address, coupon] = await Promise.all([
      cartModel
        .findById(cartId)
        .populate(
          "products.productId",
          "name images originalPrice rate discount stock"
        ),
      addressModel.findById(shippingAddress),
      authCouponId ? couponModel.findById(authCouponId) : Promise.resolve(null),
    ]);

    if (!usercart || usercart.products.length === 0) {
      return res.status(400).json({ error: "Cart is empty or invalid" });
    }
    if (!address) {
      return res.status(400).json({ error: "Shipping address not found" });
    }

    // Map ordered items
    const orderedItems = usercart.products.map((item) => ({
      productId: item.productId._id,
      pname: item.productId.name,
      pimages: item.productId.images,
      originalPrice: item.productId.originalPrice,
      price: item.productId.rate,
      quantity: item.quantity,
      size: item.size,
      offerDiscount: item.productId.discount || 0,
    }));

    // Calculate total amount
    let totalAmount = orderedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Apply coupon discount if applicable
    if (coupon && coupon.isActive) {
      const discount = Math.round(
        (totalAmount * coupon.discountPercentage) / 100
      );
      totalAmount -= discount;
    }

    // Check stock availability for each item
    const productIds = orderedItems.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });

    for (let item of orderedItems) {
      const product = products.find(
        (p) => p._id.toString() === item.productId.toString()
      );
      if (!product) {
        return res
          .status(400)
          .json({ error: `Product not found: ${item.pname}` });
      }
      if (
        !product.stock ||
        !product.stock[item.size] ||
        product.stock[item.size] < item.quantity
      ) {
        return res.status(400).json({
          error: `Insufficient stock for ${item.pname} (${item.size})`,
        });
      }
    }

    // Handle wallet payment
    if (paymentMethod === "Styleova Wallet") {
      const userWallet = await User.findById(user._id).select("wallet").session(session);
      if (userWallet.wallet < totalAmount) {
        return res.status(400).json({ error: "Insufficient wallet balance" });
      }

      // Deduct from wallet
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $inc: { wallet: -totalAmount } },
        { new: true, session }
      );

      // Add wallet history entry
      await walletHistoryModel.findOneAndUpdate(
        { userId: user._id },
        {
          $push: {
            history: {
              amount: totalAmount,
              type: "debit",
              walletBalance: updatedUser.wallet,
              date: new Date(),
              reason: "Order Payment",
            },
          },
        },
        { new: true, upsert: true, session }
      );
       paymentStatus = "Completed";  
    }

    // Create and save the order
    const order = new orderModel({
      userId: user._id,
      name: address.name,
      orderedItems,
      totalAmount,
      shippingAddress: address._id,
      paymentMethod,
      paymentStatus,
      couponApplied: authCouponId,
      orderedDate: new Date(),
    });

    await order.save({ session });
    await cartModel.findByIdAndDelete(cartId, { session });

    // Update stock quantity
    for (let item of orderedItems) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { [`stock.${item.size}`]: -item.quantity } },
        { session }
      );
    }

    // Commit transaction before rendering response
    await session.commitTransaction();
    session.endSession();

    return res.render("user/orderPlaced", {
      user: true,
      paymentStatus,
      orderId: order._id, // Pass orderId to the EJS template
      orderDate: order.orderedDate, // Pass order date
      orderStatus: order.status,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error placing order:", error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
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
    let user = req.user;
    if (user) {
      res.clearCookie("token");
      res.redirect("/user/login?msg=loggedout");
    } else {
      res.redirect("/?msg=nouser");
    }
  } catch (e) {
    console.log(e);
    res.status(500).send("Error");
  }
};

exports.filterSort = async (req, res) => {
  try {
    let user = req.user;
    const popularProducts = await Product.find({ listing: true })
      .sort({ rating: -1 })
      .limit(4)
      .populate("category");

    const {
      search = "", // Default to an empty string if search is undefined
      sort = "objectId",
      filter = [],
      limit = 5,
    } = req.query;
    let { page = 1 } = req.query;

    const filters = Array.isArray(filter) ? filter : filter ? [filter] : [];

    const category = await Category.find({ listing: true });

    const sortOptions = {
      price_lowtohigh: { rate: 1 },
      price_hightolow: { rate: -1 },
      name_lowtohigh: { name: 1 },
      name_hightolow: { name: -1 },
      objectId: { _id: -1 },
    };

    const sortCriteria = sortOptions[sort] || sortOptions.objectId;

    const query = {
      name: { $regex: search, $options: "i" },
      listing: true,
    };

    if (filters.length > 0) {
      query.category = { $in: filters };
    }

    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    page = Math.max(1, Math.min(totalPages, parseInt(page)));

    const products = await Product.find(query)
      .populate("category")
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.render("user/products", {
      user,
      products,
      currentPage: parseInt(page),
      totalPages,
      searchQuery: search || "", // Ensure searchQuery is always defined
      selectedFilters: filters,
      selectedSort: sort,
      category,
      popularProducts,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("An error occurred while processing your request.");
  }
};

exports.returnOrder=async (req, res) => {
    try {
      console.log('return order triggered')
        const orderId = req.params.orderId;
console.log('order id',orderId)
        // Find the order
        const order = await orderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
console.log('order is here',order)
        // Check if the order is already returned
        if (order.status === 'Returned') {
            return res.status(400).json({ success: false, message: 'Order is already returned' });
        }

        // Update order status and payment status
        order.status = 'Returned';
        order.paymentStatus = 'Refunded';
        await order.save();

        // Restock the products with correct size
        for (const item of order.orderedItems) {
            const product = await Product.findById(item.productId);
            if (product) {
                const size = item.size; // Get the size of the returned product
                if (product.stock[size] !== undefined) {
                    product.stock[size] += item.quantity; // Increase the correct size stock
                    await product.save();
                }
            }
        }

        res.status(200).json({ success: true, message: 'Order returned and refunded successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};