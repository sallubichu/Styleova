const express = require("express");
const router = express.Router();
const Controller = require("../controllers/adminController");
const { adminJwtAuth } = require("../middlewares/adminJwtAuth"); // Corrected path
const { upload, processImages } = require("../controllers/multer");
const offerController = require("../controllers/offersController");
const couponController = require("../controllers/couponController");
const salesController = require("../controllers/salesController");

// Route for Admin Login Page
router.get("/admin/login", (req, res) => {
  if (req.cookies.admin_token) {
    return res.redirect("/admin/dashboard");
  }
  res.render("admin/adminLogin", {
    successMessage: req.flash("success"),
    errorMessage: req.flash("error"),
  });
});

// Route for Admin Login
router.post("/admin/login", Controller.login);
router.get("/admin/logout", adminJwtAuth, Controller.logout);
router.get("/admin/dashboard", adminJwtAuth, (req, res) => {
  res.render("admin/dashboard"); // Adjust this based on your actual dashboard rendering
});

router.get("/admin/users", adminJwtAuth, Controller.manageUsers);

router.post("/admin/users/update-status", (req, res) => {
  console.log("Request body:", req.body);
  Controller.updateUserStatus(req, res);
});

router.get("/admin/category", adminJwtAuth, Controller.adminCategory);
router.get("/admin/addcategory", adminJwtAuth, Controller.addcategory);
router.post("/admin/addCategory", adminJwtAuth, Controller.addCategory);
router.get("/admin/editCategory/:id", adminJwtAuth, Controller.editCategory);
router.patch("/admin/editCategory", adminJwtAuth, Controller.updateCategory);
router.delete("/admin/category/:id", adminJwtAuth, Controller.deleteCategory);
router.patch(
  "/admin/category/:id/listing",
  adminJwtAuth,
  Controller.listCategory
);

router.get("/admin/products", adminJwtAuth, Controller.adminProducts);
router.get("/admin/addproducts", adminJwtAuth, Controller.addproducts);
router.post(
  "/admin/addProducts",
  upload,
  processImages,
  Controller.addProducts
);
router.get("/admin/editProduct/:id", adminJwtAuth, Controller.renderEdit);
router.patch(
  "/admin/editProduct",
  adminJwtAuth, // JWT authentication middleware
  upload, // Multer middleware to handle file uploads
  processImages, // Middleware to process images
  Controller.updateProduct // Your controller
);
router.delete("/admin/product/:id", adminJwtAuth, Controller.deleteProduct);
router.patch(
  "/admin/product/:id/listing",
  adminJwtAuth,
  Controller.listProduct
);
router.patch(
  "/admin/product/:productId/stock",
  adminJwtAuth,
  Controller.updateStock
);

router.patch(
  "/admin/toggleOrderStatus/:id",
  adminJwtAuth,
  Controller.toggleOrderStatus
);

router.get("/admin/manageOrders", adminJwtAuth, Controller.manageOrders);
router.get(
  "/admin/manageOrdersPagination/:pageNumber",
  adminJwtAuth,
  Controller.manageOrdersPagination
);
router.patch(
  "/admin/cancelOrder/:orderId",
  adminJwtAuth,
  Controller.cancelOrder
);

router.get("/admin/getOffers", adminJwtAuth, offerController.renderOffers);
router.post("/admin/addOffer", adminJwtAuth, offerController.addOffer);
router.delete(
  "/admin/deleteOffer/:id",
  adminJwtAuth,
  offerController.deleteOffer
);
router.put("/admin/updateOffer/:id", adminJwtAuth, offerController.updateOffer);
router.get("/admin/getOffer/:id", adminJwtAuth, offerController.getOffer);

router.get("/admin/getCoupons", adminJwtAuth, couponController.getAllCoupons);
router.post("/admin/addCoupon", adminJwtAuth, couponController.addCoupon);
router.delete(
  "/admin/deleteCoupon/:id",
  adminJwtAuth,
  couponController.deleteCoupon
);
router.put(
  "/admin/updateCoupon/:id",
  adminJwtAuth,
  couponController.updateCoupon
);

router.post(
  "/admin/salesReport",
  adminJwtAuth,
  salesController.generateSalesReport
);
router.get(
  "/admin/salesManagement",
  adminJwtAuth,
  salesController.getSalesReportPage
);

module.exports = router;
