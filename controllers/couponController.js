const Coupon = require("../models/couponModel");

exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.render("admin/manageCoupons", {
      coupons,
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.addCoupon = async (req, res) => {
  try {
    console.log("add coupon triggered");
    const { code, discountType, discountValue, startDate, endDate, status } =
      req.body;

    // Check if coupon already exists
    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
      return res
        .status(400)
        .json({ success: false, message: "Coupon code already exists." });
    }

    // Validate start and end dates
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: "End date must be after the start date.",
      });
    }

    const newCoupon = new Coupon({
      code,
      discountType,
      discountValue,
      startDate,
      endDate,
      status,
    });

    await newCoupon.save();
    res
      .status(201)
      .json({ success: true, message: "Coupon added successfully." });
  } catch (error) {
    console.error("Error adding coupon:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCoupon = await Coupon.findByIdAndDelete(id);
    if (!deletedCoupon) {
      return res
        .status(404)
        .json({ success: false, message: "Coupon not found." });
    }

    res
      .status(200)
      .json({ success: true, message: "Coupon deleted successfully." });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// Update Coupon
exports.updateCoupon = async (req, res) => {
  console.log("update coupon triggered");
  try {
    const { code, discountType, discountValue, startDate, endDate, status } =
      req.body;
    const { id } = req.params;

    // Validate request
    if (!code || !discountType || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Find and update coupon
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      id,
      {
        code,
        discountType,
        discountValue,
        startDate,
        endDate,
        status,
      },
      { new: true }
    );

    if (!updatedCoupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    res.json({ message: "Coupon updated successfully", coupon: updatedCoupon });
  } catch (error) {
    console.error("Update Coupon Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
