const express = require("express");
const router = express.Router();
const Controller = require("../controllers/userController");
const googleController = require("../controllers/googleSetup");
const profileController = require("../controllers/profileController");
const { verifyUser } = require("../middlewares/authMiddleware.js");
const authController = require("../controllers/authController");
const cartController = require("../controllers/cartController");
const couponModel = require("../models/couponModel");
const passport = require("passport");
const wishlistController = require("../controllers/wishlistController");
const paymentController = require("../controllers/paymentController");
const couponController = require("../controllers/couponController");
const retryController=require('../controllers/retryPaymentController')
const invoiceController=require('../controllers/invoiceController')

// Signup and OTP for registration
router.get("/user/signup", Controller.renderSignup);
router.post("/user/sendOtp", Controller.registerUser);
router.post("/user/verifyOtp", Controller.verifyOtp);
router.post("/user/resendOtp", Controller.resendOtp);

// Login and dashboard
router.get("/user/login", Controller.loginRender);
router.post("/user/login", Controller.userLogin);
router.get("/user/dashboard", verifyUser, Controller.showDashboard);
router.get("/user/logout", verifyUser, Controller.logout);
router.post("/refresh-token", authController.refreshToken);

// Google Authentication
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get("/auth/google/callback", googleController.googleRedirect);

// Product details
router.get("/user/productDetailed/:id", verifyUser, Controller.productDetailed);

// Profile management
router.get("/user/profile", verifyUser, profileController.profile);
router.post("/user/profile/update", verifyUser, profileController.editUser);
// OTP verification for email change
router.get("/user/verify-otp", verifyUser, (req, res) => {
  res.render("user/profile/verify-otp", { user: req.user });
});
router.post("/user/verify-otp", verifyUser, profileController.verifyOtp);

// Address management
router.get("/user/address", verifyUser, profileController.address);
router.post("/user/addAddress", verifyUser, profileController.addAddress);
router.delete(
  "/user/deleteAddress/:id",
  verifyUser,
  profileController.deleteAddress
);
router.get("/user/getAddress/:id", verifyUser, profileController.editAddress);
router.patch(
  "/user/updateAddress/:id",
  verifyUser,
  profileController.updateAddress
);

// Forgot password
router.get("/user/forgot", Controller.forgot);
router.post("/user/forgotPassword", Controller.forgotPassword);
router.post(
  "/user/verifyForgotPasswordOtp",
  Controller.verifyForgotPasswordOtp
);
router.patch("/user/resetPassword", Controller.resetPassword);

// Cart management
router.get("/user/viewCart", verifyUser, cartController.viewCart);
router.post("/user/addToCart", verifyUser, cartController.addToCart);
router.delete(
  "/user/deleteProduct/:id",
  verifyUser,
  cartController.deleteProduct
);
router.patch(
  "/user/updateQuantity/:productId",
  verifyUser,
  cartController.updateQuantity
);

// Checkout and order management
router.get("/user/checkout", verifyUser, cartController.renderCheckout);
router.post("/user/placeOrder", verifyUser, Controller.placeOrder);
router.get("/user/orderPlaced/:orderId", verifyUser, Controller.renderOrderPlaced);
router.get("/user/viewOrder/:id", verifyUser, profileController.viewOrder);
router.get("/user/orders", verifyUser, profileController.orders);
router.post("/user/cancelOrder/:oid", verifyUser, profileController.cancelSingle);
router.patch("/user/cancelAll/:oid", verifyUser, profileController.cancelOrder);


// Product filtering
router.get("/user/filterSort", verifyUser, Controller.filterSort);
router.get("/user/products", verifyUser, Controller.filterSort);

// Wishlist management
router.get("/user/getWishlist", verifyUser, wishlistController.getWishlist);
router.post(
  "/user/addToWishList",
  verifyUser,
  wishlistController.addToWishlist
);
router.delete(
  "/user/removeFromWishlist/:id",
  verifyUser,
  wishlistController.removeFromWishlist
);

// Payment processing
router.post("/user/create-order", verifyUser, paymentController.createOrder);
router.post(
  "/user/verify-payment",
  verifyUser,
  paymentController.verifyPayment
);

// Coupon management
router.post("/user/applyCoupon", couponController.applyCoupon);
router.post("/user/removeCoupon", couponController.removeCoupon);

// Wallet history
router.get("/user/wallethistory", verifyUser, profileController.getWalletHistory);

router.get('/user/retryPayment',verifyUser,retryController.retryPayment)
router.post('/user/paymentSuccess',verifyUser,retryController.paymentSuccess)

router.get('/user/invoice/:orderId',verifyUser,invoiceController.generateInvoice);

router.post('/user/requestReturn/:orderId', verifyUser, Controller.requestReturn);

module.exports = router;