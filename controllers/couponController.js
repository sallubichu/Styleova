const Coupon = require("../models/couponModel");
const Cart = require('../models/cartModel');
const mongoose = require('mongoose');
const HttpStatus = require('../utils/httpStatus');

// Add Coupon
exports.addCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, minPurchaseAmount, maxDiscountAmount, startDate, endDate, status } = req.body;

    if (!code || !discountType || !discountValue || !startDate || !endDate || !status || minPurchaseAmount === undefined) {
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'All required fields must be provided.' });
    }

    const parsedDiscountValue = parseFloat(discountValue);
    const parsedMinPurchaseAmount = parseFloat(minPurchaseAmount);
    const parsedMaxDiscountAmount = maxDiscountAmount ? parseFloat(maxDiscountAmount) : null;

    if (isNaN(parsedDiscountValue) || parsedDiscountValue < 0) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Discount value must be a non-negative number.' });
    if (discountType === 'Percentage' && parsedDiscountValue > 100) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Percentage discount cannot exceed 100%.' });
    if (isNaN(parsedMinPurchaseAmount) || parsedMinPurchaseAmount < 0) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Minimum purchase amount must be a non-negative number.' });
    if (discountType === 'Percentage' && (!parsedMaxDiscountAmount || parsedMaxDiscountAmount < 0)) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Maximum discount amount is required for Percentage type and must be non-negative.' });
    if (new Date(startDate) >= new Date(endDate)) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'End date must be after start date.' });

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Coupon code already exists.' });

    const newCoupon = new Coupon({
      code: code.toUpperCase(),
      discountType,
      discountValue: parsedDiscountValue,
      minPurchaseAmount: parsedMinPurchaseAmount,
      maxDiscountAmount: parsedMaxDiscountAmount,
      startDate,
      endDate,
      status,
    });

    await newCoupon.save();
    res.status(HttpStatus.CREATED).json({ success: true, message: 'Coupon added successfully.', data: newCoupon });
  } catch (error) {
    console.error('Error in addCoupon:', error.message);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: 'An error occurred while adding the coupon.' });
  }
};

// Update Coupon
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discountType, discountValue, minPurchaseAmount, maxDiscountAmount, startDate, endDate, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Invalid coupon ID.' });
    if (!code || !discountType || !discountValue || !startDate || !endDate || !status || minPurchaseAmount === undefined) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'All required fields must be provided.' });

    const parsedDiscountValue = parseFloat(discountValue);
    const parsedMinPurchaseAmount = parseFloat(minPurchaseAmount);
    const parsedMaxDiscountAmount = maxDiscountAmount ? parseFloat(maxDiscountAmount) : null;
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (isNaN(parsedDiscountValue) || parsedDiscountValue < 0) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Discount value must be a non-negative number.' });
    if (discountType === 'Percentage' && parsedDiscountValue > 100) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Percentage discount cannot exceed 100%.' });
    if (isNaN(parsedMinPurchaseAmount) || parsedMinPurchaseAmount < 0) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Minimum purchase amount must be a non-negative number.' });
    if (discountType === 'Percentage' && (!parsedMaxDiscountAmount || parsedMaxDiscountAmount < 0)) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Maximum discount amount is required for Percentage type and must be non-negative.' });
    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Invalid date format.' });
    if (parsedStartDate >= parsedEndDate) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'End date must be after start date.' });

    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase(), _id: { $ne: id } });
    if (existingCoupon) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Coupon code already exists.' });

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      id,
      { code: code.toUpperCase(), discountType, discountValue: parsedDiscountValue, minPurchaseAmount: parsedMinPurchaseAmount, maxDiscountAmount: parsedMaxDiscountAmount, startDate: parsedStartDate, endDate: parsedEndDate, status },
      { new: true, runValidators: true }
    );

    if (!updatedCoupon) return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Coupon not found.' });
    res.status(HttpStatus.OK).json({ success: true, message: 'Coupon updated successfully.', data: updatedCoupon });
  } catch (error) {
    console.error('Error in updateCoupon:', error.message);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: 'An error occurred while updating the coupon.' });
  }
};

// Delete Coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Coupon not found." });
    res.status(HttpStatus.OK).json({ success: true, message: "Coupon deleted successfully." });
  } catch (error) {
    console.error("Error in deleteCoupon:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "An error occurred while deleting the coupon." });
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
      coupons,
      pagination: { currentPage: parseInt(page), totalPages: Math.ceil(totalCoupons / limit), totalCoupons },
    });
  } catch (error) {
    console.error("Error in getAllCoupons:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "An error occurred while fetching coupons." });
  }
};

// Apply Coupon
exports.applyCoupon = async (req, res) => {
  try {
    const { couponCode, cartId } = req.body;
    console.log('Apply coupon request:', { couponCode, cartId });

    if (!couponCode || !cartId) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Coupon code and cart ID are required." });

    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), status: "Active" });
    if (!coupon) return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Invalid or expired coupon code." });

    const currentDate = new Date();
    if (currentDate < coupon.startDate || currentDate > coupon.endDate) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "This coupon is not valid at the moment." });

    const cart = await Cart.findById(cartId).populate("products.productId");
    if (!cart) return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Cart not found." });

    let totalAmount = 0;
    cart.products.forEach((item) => totalAmount += item.productId.rate * item.quantity);
    console.log('Calculated total:', totalAmount);

    if (totalAmount < coupon.minPurchaseAmount) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: `Minimum purchase amount of Rs. ${coupon.minPurchaseAmount} is required.` });

    let discountAmount = coupon.discountType === "Percentage" ? (totalAmount * coupon.discountValue) / 100 : coupon.discountValue;
    if (coupon.discountType === "Percentage" && coupon.maxDiscountAmount) discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    discountAmount = Math.min(discountAmount, totalAmount);

    cart.discountAmount = discountAmount;
    cart.finalAmount = totalAmount - discountAmount;
    cart.couponApplied = true;
    cart.couponCode = couponCode.toUpperCase();

    await cart.save();
    console.log('Coupon applied:', { discountAmount, finalAmount: cart.finalAmount });

    res.status(HttpStatus.OK).json({ success: true, message: "Coupon applied successfully.", discountAmount, finalAmount: cart.finalAmount });
  } catch (error) {
    console.error("Error in applyCoupon:", error.message, error.stack);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "An error occurred while applying the coupon.", error: error.message });
  }
};

// Remove Coupon
exports.removeCoupon = async (req, res) => {
  try {
    const { cartTotal, cartId } = req.body;
    console.log('Remove coupon request:', { cartTotal, cartId });

    if (!cartId) return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Cart ID is required." });

    const cart = await Cart.findById(cartId).populate("products.productId");
    if (!cart) return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Cart not found." });

    let calculatedTotal = 0;
    cart.products.forEach((item) => calculatedTotal += item.productId.rate * item.quantity);
    console.log('Calculated total:', calculatedTotal);

    // Use a small tolerance for floating-point comparison
    if (Math.abs(cartTotal - calculatedTotal) > 0.01) {
      console.log('Total mismatch:', { provided: cartTotal, calculated: calculatedTotal });
      return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Invalid cart total provided.", provided: cartTotal, calculated: calculatedTotal });
    }

    cart.discountAmount = 0;
    cart.finalAmount = calculatedTotal;
    cart.couponApplied = false;
    cart.couponCode = null;

    await cart.save();
    console.log('Coupon removed:', { finalAmount: cart.finalAmount });

    res.status(HttpStatus.OK).json({ success: true, message: "Coupon removed successfully.", finalAmount: cart.finalAmount });
  } catch (error) {
    console.error("Error in removeCoupon:", error.message, error.stack);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "An error occurred while removing the coupon.", error: error.message });
  }
};

module.exports = exports;