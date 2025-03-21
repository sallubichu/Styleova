const Offers = require("../models/offerModel");
const Category = require("../models/categoryModel");
const Product = require("../models/productModel");
const HttpStatus = require('../utils/httpStatus'); // Import the enum

// Render offers page
exports.renderOffers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalOffers = await Offers.countDocuments();
    const totalPages = Math.ceil(totalOffers / limit);

    const categories = await Category.find();
    const products = await Product.find();

    const offers = await Offers.find()
      .skip(skip)
      .limit(limit)
      .sort({ startDate: -1 })
      .populate("categoryId", "name")
      .populate("productId", "name");

    res.render("admin/manageOffers", {
      offers,
      totalPages,
      page,
      limit,
      totalOffers,
      categories,
      products,
    });
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.redirect("/admin/getOffers");
  }
};

// Add a new offer
exports.addOffer = async (req, res) => {
  try {
    const {
      name,
      type,
      discountType,
      discountValue,
      startDate,
      endDate,
      status,
      categoryId,
      productId,
    } = req.body;

    // Input validation
    if (!name || name.trim().length < 3) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Offer name must be at least 3 characters long.",
      });
    }

    const validTypes = ["Product", "Category", "Referral"];
    if (!validTypes.includes(type)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid offer type. Must be Product, Category, or Referral.",
      });
    }

    const validDiscountTypes = ["Percentage", "Fixed"];
    if (!validDiscountTypes.includes(discountType)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid discount type. Must be Percentage or Fixed.",
      });
    }

    const discountVal = parseFloat(discountValue);
    if (isNaN(discountVal) || discountVal <= 0 || (discountType === "Percentage" && discountVal > 100)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Discount value must be a positive number${discountType === "Percentage" ? " and less than or equal to 100" : ""}.`,
      });
    }

    const validStatuses = ["Active", "Inactive"];
    if (!validStatuses.includes(status)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid status. Must be Active or Inactive.",
      });
    }

    if (type === "Category" && !categoryId) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Category ID is required for Category offers.",
      });
    }
    if (type === "Product" && !productId) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Product ID is required for Product offers.",
      });
    }
    if (type === "Referral" && (categoryId || productId)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Referral offers should not specify a category or product.",
      });
    }

    const existingOffer = await Offers.findOne({ name });
    if (existingOffer) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "An offer with this name already exists.",
      });
    }

    const newOffer = new Offers({
      name,
      type,
      discountType,
      discountValue: discountVal,
      startDate,
      endDate,
      status,
      categoryId: type === "Category" ? categoryId : null,
      productId: type === "Product" ? productId : null,
    });

    await newOffer.save();

    // Update offerApplied field for Product offers
    if (type === "Product" && productId) {
      await Product.findByIdAndUpdate(productId, { offerApplied: true });
    }

    res.status(HttpStatus.OK).json({
      success: true,
      message: "Offer added successfully.",
    });
  } catch (error) {
    console.error("Error adding offer:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "An error occurred while adding the offer.",
    });
  }
};

// Delete an offer
exports.deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOffer = await Offers.findByIdAndDelete(id);

    if (!deletedOffer) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "Offer not found.",
      });
    }

    // Reset offerApplied field if it was a Product offer
    if (deletedOffer.type === "Product" && deletedOffer.productId) {
      await Product.findByIdAndUpdate(deletedOffer.productId, { offerApplied: false });
    }

    res.status(HttpStatus.OK).json({
      success: true,
      message: "Offer deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting offer:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred while deleting the offer.",
    });
  }
};

// Update an offer
exports.updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      discountType,
      discountValue,
      startDate,
      endDate,
      status,
      categoryId,
      productId,
    } = req.body;

    // Input validation
    if (!name || name.trim().length < 3) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Offer name must be at least 3 characters long.",
      });
    }

    const validTypes = ["Product", "Category", "Referral"];
    if (!validTypes.includes(type)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid offer type. Must be Product, Category, or Referral.",
      });
    }

    const validDiscountTypes = ["Percentage", "Fixed"];
    if (!validDiscountTypes.includes(discountType)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid discount type. Must be Percentage or Fixed.",
      });
    }

    const discountVal = parseFloat(discountValue);
    if (isNaN(discountVal) || discountVal <= 0 || (discountType === "Percentage" && discountVal > 100)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: `Discount value must be a positive number${discountType === "Percentage" ? " and less than or equal to 100" : ""}.`,
      });
    }

    const validStatuses = ["Active", "Inactive"];
    if (!validStatuses.includes(status)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Invalid status. Must be Active or Inactive.",
      });
    }

    if (type === "Category" && !categoryId) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Category ID is required for Category offers.",
      });
    }
    if (type === "Product" && !productId) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Product ID is required for Product offers.",
      });
    }
    if (type === "Referral" && (categoryId || productId)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "Referral offers should not specify a category or product.",
      });
    }

    const existingOffer = await Offers.findOne({ name, _id: { $ne: id } });
    if (existingOffer) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        message: "An offer with this name already exists.",
      });
    }

    const oldOffer = await Offers.findById(id);
    const updatedOffer = await Offers.findByIdAndUpdate(
      id,
      {
        name,
        type,
        discountType,
        discountValue: discountVal,
        startDate,
        endDate,
        status,
        categoryId: type === "Category" ? categoryId : null,
        productId: type === "Product" ? productId : null,
      },
      { new: true }
    );

    if (!updatedOffer) {
      return res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: "Offer not found.",
      });
    }

    // Handle offerApplied field for Product offers
    if (type === "Product" && productId) {
      await Product.findByIdAndUpdate(productId, { offerApplied: true });
    }
    if (oldOffer.type === "Product" && oldOffer.productId && oldOffer.productId.toString() !== productId) {
      await Product.findByIdAndUpdate(oldOffer.productId, { offerApplied: false });
    }
    if (type !== "Product" && oldOffer.type === "Product" && oldOffer.productId) {
      await Product.findByIdAndUpdate(oldOffer.productId, { offerApplied: false });
    }

    res.status(HttpStatus.OK).json({
      success: true,
      message: "Offer updated successfully.",
    });
  } catch (error) {
    console.error("Error updating offer:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "An error occurred while updating the offer.",
    });
  }
};

// Get offer by ID
exports.getOffer = async (req, res) => {
  const offerId = req.params.id;

  try {
    const offer = await Offers.findById(offerId)
      .populate("categoryId", "name")
      .populate("productId", "name");

    if (!offer) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Offer not found" });
    }

    res.status(HttpStatus.OK).json(offer);
  } catch (error) {
    console.error(error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Server error", error: error.message });
  }
};

module.exports = exports;