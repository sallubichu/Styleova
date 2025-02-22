const Coupon = require("../models/couponModel");

// Add Coupon
exports.addCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, startDate, endDate, status } = req.body;

    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({ success: false, message: "Coupon code already exists." });
    }

    // Create new coupon
    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      startDate,
      endDate,
      status,
    });

    await newCoupon.save();

    res.status(201).json({ success: true, message: "Coupon added successfully.", data: newCoupon });
  } catch (error) {
    console.error("Error in addCoupon:", error);
    res.status(500).json({ success: false, message: "An error occurred while adding the coupon." });
  }
};

// Update Coupon
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discountType, discountValue, startDate, endDate, status } = req.body;

    // Convert code to uppercase
    const formattedCode = code.toUpperCase();

    // Check if another coupon with the same code exists (excluding current coupon)
    const existingCoupon = await Coupon.findOne({ code: formattedCode, _id: { $ne: id } });
    if (existingCoupon) {
      return res.status(400).json({ success: false, message: "Coupon code already exists." });
    }

    // Find and update the coupon
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      id,
      {
        code: formattedCode,
        discountType,
        discountValue,
        startDate,
        endDate,
        status,
      },
      { new: true } // Returns the updated document
    );

    if (!updatedCoupon) {
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }

    res.status(200).json({ success: true, message: "Coupon updated successfully.", data: updatedCoupon });
  } catch (error) {
    console.error("Error in updateCoupon:", error);
    res.status(500).json({ success: false, message: "An error occurred while updating the coupon." });
  }
};


// Delete Coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    // Find and delete the coupon
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: "Coupon not found." });
    }

    res.status(200).json({ success: true, message: "Coupon deleted successfully." });
  } catch (error) {
    console.error("Error in deleteCoupon:", error);
    res.status(500).json({ success: false, message: "An error occurred while deleting the coupon." });
  }
};

// Get All Coupons
exports.getAllCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const coupons = await Coupon.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalCoupons = await Coupon.countDocuments();

  res.render("admin/manageCoupons", {
      success: true,
      coupons, // <- Now passing `coupons` directly
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCoupons / limit),
        totalCoupons,
      },
    });

  } catch (error) {
    console.error("Error in getAllCoupons:", error);
    res.status(500).json({ success: false, message: "An error occurred while fetching coupons." });
  }
};