const express = require("express");
const router = express.Router();
const Controller = require("../controllers/userController");
const googleController = require("../controllers/googleSetup");
const profileController = require("../controllers/profileController");
const verifyUser = require("../middlewares/authMiddleware.js");
const authController = require("../controllers/authController");
const cartController = require("../controllers/cartController");
const couponModel = require("../models/couponModel");
const passport = require("passport");
const wishlistController = require("../controllers/wishlistController");
const paymentController = require("../controllers/paymentController");

router.get("/user/signup", Controller.renderSignup);
router.post("/user/sendOtp", Controller.registerUser);
router.post("/user/verifyOtp", Controller.verifyOtp);
router.post("/user/resendOtp", Controller.resendOtp);

router.get("/user/login", Controller.loginRender);
router.post("/user/login", Controller.userLogin);
router.get("/user/dashboard", verifyUser, Controller.showDashboard);
router.get("/user/logout", verifyUser, Controller.logout);
router.post("/refresh-token", authController.refreshToken);

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get("/auth/google/callback", googleController.googleRedirect);

router.get("/user/productDetailed/:id", verifyUser, Controller.productDetailed);

router.get("/user/profile", verifyUser, profileController.profile);
router.post("/user/profile/update", verifyUser, profileController.editUser);
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
router.get("/user/forgot", Controller.forgot);

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

router.get("/user/checkout", verifyUser, cartController.renderCheckout);

router.post("/user/placeOrder", verifyUser, Controller.placeOrder);
router.get("/user/viewOrder/:id", verifyUser, profileController.viewOrder);
router.get("/user/orders", verifyUser, profileController.orders);
router.post("/user/cancelOrder/:oid", verifyUser, profileController.cancelSingle);
router.patch("/user/cancelAll/:oid", verifyUser, profileController.cancelOrder);

router.post("/user/forgotPassword", Controller.forgotPassword); // Send OTP for password reset
router.post(
  "/user/verifyForgotPasswordOtp",
  Controller.verifyForgotPasswordOtp
); // Verify OTP for password reset
router.patch("/user/resetPassword", Controller.resetPassword); // Reset password after OTP verification

router.get("/user/filterSort", verifyUser, Controller.filterSort);
router.get("/user/products", verifyUser, Controller.filterSort);

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

router.post("/user/create-order", verifyUser, paymentController.createOrder);
router.post(
  "/user/verify-payment",
  verifyUser,
  paymentController.verifyPayment
);
router.post('/user/returnOrder/:orderId', verifyUser,Controller.returnOrder);





// Wallet History Route
router.get('/user/wallethistory',verifyUser, profileController.getWalletHistory);

module.exports = router;
