const Admin = require("../models/adminModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/userModel");
const Category = require("../models/categoryModel");
const Product = require("../models/productModel");
const multer = require("multer");
const { adminJwtAuth } = require("../middlewares/adminJwtAuth");
const mongoose = require("mongoose");
const orderModel = require("../models/orderModel");
const JWT_SECRET = "slaman123";
const fs = require("fs");
const path = require("path");
const walletHistoryModel=require('../models/wallethistoryModel')
const HttpStatus = require('http-status-codes');
const razorpayInstance = require('../config/razorpay');

const PDFDocument = require('pdfkit');

// Function to generate JWT token
const generateToken = (adminId) => {
  return jwt.sign({ id: adminId }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
};

// Admin Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if admin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).send("Admin not found");
    }

    // Validate password
    if (!bcrypt.compareSync(password, admin.password)) {
      return res.status(401).send("Invalid credentials");
    }

    // Generate the JWT token
    const token = generateToken(admin._id);

    // Set the access token in cookies
    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 3600000, // 1 hour expiry
    });

    return res.redirect("/admin/dashboard");
  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal server error");
  }
};

exports.logout = (req, res) => {
  res.clearCookie("admin_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  res.redirect("/admin/login");
};

exports.manageUsers = async (req, res) => {
  try {
    // Get page and limit from query parameters, with defaults
    const page = parseInt(req.query.page) || 1;   // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default to 10 users per page

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    // Get the total number of users
    const totalUsers = await User.countDocuments();

    // Calculate total pages
    const totalPages = Math.ceil(totalUsers / limit);

    // Fetch paginated users
    const data = await User.find({})
      .skip(skip)
      .limit(limit);

    // Render the manageUsers view with all necessary data
    res.render("admin/manageUsers", {
      data,                // Paginated users
      totalPages,          // Total number of pages
      page,                // Current page
      limit,               // Items per page
      totalUsers,          // Total number of users
      successMessage: req.flash("success"),
      errorMessage: req.flash("error")
    });
  } catch (err) {
    console.log(err);
    req.flash("error", "Error fetching users.");
    res.redirect("/admin/manageUsers");
  }
};

exports.updateUserStatus = async (req, res) => {
  const { id, status } = req.body;

  try {
    // Check for valid status
    if (status !== "active" && status !== "blocked") {
      return res.status(400).json({
        message:
          'Invalid status value. It should be either "active" or "blocked".',
      });
    }

    // Find and update the user status
    const user = await User.findByIdAndUpdate(id, { status }, { new: true });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.flash("success", "User status updated successfully"); // Add success message
    res.redirect("/admin/users"); // Redirect back to the users page after update
  } catch (error) {
    console.error("Error updating user status:", error);
    req.flash("error", "An error occurred while updating the user status");
    res.redirect("/admin/users"); // Redirect back to the users page on error
  }
};

exports.adminCategory = async (req, res) => {
  try {
    // Get page and limit from query parameters, with defaults
    const page = parseInt(req.query.page) || 1;   // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default to 10 categories per page

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    // Get the total number of categories
    const totalCategories = await Category.countDocuments();

    // Calculate total pages
    const totalPages = Math.ceil(totalCategories / limit);

    // Fetch paginated categories
    const data = await Category.find({})
      .skip(skip)
      .limit(limit);

    console.log(data); // Log for debugging

    // Render the adminCategory view with all necessary data
    res.render("admin/adminCategory", {
      data,             // Paginated categories
      totalPages,       // Total number of pages
      page,             // Current page
      limit,            // Items per page
      totalCategories   // Total number of categories
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
};

exports.addcategory = (req, res) => {
  res.render("admin/addCategory");
};

exports.addCategory = async (req, res) => {
  try {
    let { name, description } = req.body;

    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.redirect("/admin/addCategory?msg=exists");
    }

    const data = Category({
      name,
      description,
    });

    data
      .save()
      .then(() => {
        console.log("data saved to db");
        res.redirect("/admin/category?msg=added");
      })
      .catch((err) => {
        console.log("data not saved to db", err);
        res.send(err);
      });
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
};

exports.editCategory = async (req, res) => {
  try {
    const id = req.params.id;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.render("admin/editCategory", {
      _id: category._id,
      name: category.name,
      description: category.description,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
};

exports.updateCategory = async (req, res) => {
  const { id, name, description } = req.body; // Get data from the form

  // Validation: Check if all required fields are present
  if (!id || !name || !description) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Find the category by ID and update the fields
    const updatedCategory = await Category.findByIdAndUpdate(
      id, // Search by ID
      { name, description }, // Updated data
      { new: true } // Return the updated category
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Return the updated category as a response
    res.json({
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      res.status(400).json({ message: "category not found" });
    }

    await Category.findByIdAndDelete(id);

    res.status(200).json({ message: "category deleted sucessfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred while deleting category" });
  }
};

exports.listCategory = async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    category.listing = !category.listing;
    await category.save();

    res.status(200).json({
      success: true,
      message: "Category listing toggled successfully!",
      listing: category.listing, // Return new status
    });
  } catch (error) {
    console.error("Error toggling category listing:", error);
    res.status(500).json({
      success: false,
      message: "Error updating category listing",
      error: error.message,
    });
  }
};

exports.adminProducts = async (req, res) => {
  try {
    // Set the number of products per page
    const limit = parseInt(req.query.limit) || 10; 
    const page = parseInt(req.query.page) || 1;  

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    // Get the total number of products for pagination
    const totalProducts = await Product.countDocuments();

    // Fetch the paginated products
    const data = await Product.find()
      .populate("category")
      .skip(skip)
      .limit(limit);

    // Ensure each product has an images array
    data.forEach((product) => {
      if (!product.images) {
        product.images = [];
      }
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalProducts / limit);

    // Render the page with pagination data
    res.render("admin/adminProducts", {
      data,
      currentPage: page,
      totalPages,
      limit,
      totalProducts
    });
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
};

exports.addproducts = async (req, res) => {
  try {
    const data = await Category.find({}).select("name");
    console.log(data);
    res.render("admin/addproducts", { data });
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
};



exports.addProducts = async (req, res) => {
  try {
    const { name, description, rating, rate, category, stockSmall, stockMedium, stockLarge } = req.body;
    console.log("Request body:", req.body);

    // 1. Validate required fields
    if (!name || !description || !rating || !rate || !category || !stockSmall || !stockMedium || !stockLarge) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // 2. Validate string fields
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters" });
    }
    if (trimmedDescription.length < 10 || trimmedDescription.length > 1000) {
      return res.status(400).json({ success: false, message: "Description must be between 10 and 1000 characters" });
    }

    // 3. Check if product name already exists (case-insensitive)
    const existingProduct = await Product.findOne({ name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
    if (existingProduct) {
      return res.status(400).json({ success: false, message: "A product with this name already exists" });
    }

    // 4. Validate numeric fields
    const parsedRating = parseFloat(rating);
    const parsedRate = parseFloat(rate);
    const parsedStockSmall = parseInt(stockSmall, 10);
    const parsedStockMedium = parseInt(stockMedium, 10);
    const parsedStockLarge = parseInt(stockLarge, 10);

    if (isNaN(parsedRating) || parsedRating < 0 || parsedRating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be a number between 0 and 5" });
    }
    if (isNaN(parsedRate) || parsedRate <= 0) {
      return res.status(400).json({ success: false, message: "Rate must be a positive number" });
    }
    if (isNaN(parsedStockSmall) || parsedStockSmall < 0) {
      return res.status(400).json({ success: false, message: "Stock for Small must be a non-negative integer" });
    }
    if (isNaN(parsedStockMedium) || parsedStockMedium < 0) {
      return res.status(400).json({ success: false, message: "Stock for Medium must be a non-negative integer" });
    }
    if (isNaN(parsedStockLarge) || parsedStockLarge < 0) {
      return res.status(400).json({ success: false, message: "Stock for Large must be a non-negative integer" });
    }

    // 5. Validate category (optional: if you have a Category model)
    const validCategory = await Category.findById(category); 
    if (!validCategory) {
      return res.status(400).json({ success: false, message: "Invalid category" });
    }

    // 6. Validate file uploads
    if (!req.files || req.files.length !== 3) {
      return res.status(400).json({ success: false, message: "Exactly 3 images are required" });
    }

    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxFileSize = 5 * 1024 * 1024; // 5MB limit per file

    for (const file of req.files) {
      if (!allowedImageTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `Invalid file type: ${file.originalname}. Only JPEG, PNG, GIF, and WebP are allowed.`,
        });
      }
      if (file.size > maxFileSize) {
        return res.status(400).json({
          success: false,
          message: `File too large: ${file.originalname}. Maximum size is 5MB.`,
        });
      }
    }

    // 7. Extract file paths
    const imagesArray = req.files.map((file) => file.path);
    console.log("Uploaded files:", req.files);

    // 8. Create new product instance
    const newProduct = new Product({
      name: trimmedName,
      description: trimmedDescription,
      rating: parsedRating,
      rate: parsedRate,
      category, // Assuming category is an ObjectId; adjust if it’s a string
      images: imagesArray,
      stock: {
        Small: parsedStockSmall,
        Medium: parsedStockMedium,
        Large: parsedStockLarge,
      },
    });

    // 9. Save to database
    await newProduct.save();
    console.log("Product added successfully:", newProduct._id);

    // 10. Return success response (no redirect)
    return res.status(200).json({
      success: true,
      message: "Product added successfully",
    });
  } catch (err) {
    console.error("Error adding product:", err);

    // Optional: Cleanup uploaded files if save fails
    if (req.files && req.files.length > 0) {
      const fs = require('fs').promises;
      await Promise.all(req.files.map((file) => fs.unlink(file.path).catch((e) => console.error("Cleanup error:", e))));
    }

    return res.status(500).json({
      success: false,
      message: "An error occurred while adding the product",
      error: err.message,
    });
  }
};

exports.renderEdit = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await Product.findById(id).populate("category");
    const categories = await Category.find({ listing: true });
    console.log(data);
    res.render("admin/editProducts", { data, categories });
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
};

const upload = multer({ dest: "uploads/" });





exports.updateProduct = async (req, res) => {
  // Ensure response is JSON even if an error occurs early
  res.setHeader('Content-Type', 'application/json');

  try {
    const {
      id,
      name,
      description,
      rating,
      category,
      deleteImages,
      rate,
      stockSmall,
      stockMedium,
      stockLarge
    } = req.body;

    // Validate product ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    // Validate category ID if provided
    if (category && !mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }

    // Validate required fields
    if (!name || !description || !category || !rating || !rate || !stockSmall || !stockMedium || !stockLarge) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate numeric fields
    const parsedRating = parseFloat(rating);
    const parsedRate = parseFloat(rate);
    const parsedStockSmall = parseInt(stockSmall);
    const parsedStockMedium = parseInt(stockMedium);
    const parsedStockLarge = parseInt(stockLarge);

    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    if (isNaN(parsedRate) || parsedRate < 0) {
      return res.status(400).json({ message: 'Rate cannot be negative' });
    }
    if (isNaN(parsedStockSmall) || isNaN(parsedStockMedium) || isNaN(parsedStockLarge) ||
        parsedStockSmall < 0 || parsedStockMedium < 0 || parsedStockLarge < 0) {
      return res.status(400).json({ message: 'Stock quantities cannot be negative' });
    }

    // Find existing product
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Initialize updated images array with existing images
    let updatedImages = existingProduct.images;

    // Handle deletion of images
    if (deleteImages) {
      let imagesToDelete;
      try {
        imagesToDelete = JSON.parse(deleteImages);
        if (!Array.isArray(imagesToDelete)) {
          return res.status(400).json({ message: 'deleteImages must be an array' });
        }
      } catch (err) {
        return res.status(400).json({ message: 'Invalid deleteImages format' });
      }

      const failedDeletions = [];
      updatedImages = updatedImages.filter((image) => !imagesToDelete.includes(image));

      for (const image of imagesToDelete) {
        const imagePath = path.join(__dirname, '..', image);
        try {
          if (fs.existsSync(imagePath)) {
            await fs.promises.unlink(imagePath);
          } else {
            failedDeletions.push(image); // Track missing images
          }
        } catch (err) {
          console.warn(`Failed to delete image ${image}: ${err.message}`);
          failedDeletions.push(image); // Track failed deletions
        }
      }

      if (failedDeletions.length > 0) {
        return res.status(207).json({
          message: 'Product updated, but some images could not be deleted',
          failedDeletions,
          partialSuccess: true
        });
      }
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const invalidFiles = [];

      for (const file of req.files) {
        if (!allowedImageTypes.includes(file.mimetype)) {
          invalidFiles.push(file.originalname);
        }
      }

      if (invalidFiles.length > 0) {
        return res.status(400).json({
          message: `Invalid file type(s): ${invalidFiles.join(', ')}. Only JPEG, PNG, GIF, and WEBP allowed.`
        });
      }

      const newImages = req.files.map((file) => `uploads/${file.filename}`);
      updatedImages = [...updatedImages, ...newImages];
    }

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        description,
        rating: parsedRating,
        category,
        images: updatedImages,
        rate: parsedRate,
        stock: {
          Small: parsedStockSmall,
          Medium: parsedStockMedium,
          Large: parsedStockLarge
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Failed to update product in database' });
    }

    res.status(200).json({
      message: 'Product updated successfully',
      imageCount: updatedImages.length
    });
  } catch (error) {
    console.error('Error updating product:', error.message);
    res.status(500).json({
      message: 'Server error occurred while updating product',
      error: error.message // Optional: remove in production
    });
  }
};

exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);

    if (!product) {
      res.status(400).json({ message: "product not found" });
    }

    await Product.findByIdAndDelete(id);
    res.status(200).json({ message: "Product deletes sucessfully" });
  } catch (error) {
    res.status(500).json({ message: "something went wrong" });
  }
};

exports.listProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Only allow toggling if the product is not out of stock
    if (product.stockQuantity <= 0) {
      return res.status(400).json({
        message: "Product is out of stock and cannot be listed",
      });
    }

    // Toggle the listing status
    product.listing = !product.listing;
    await product.save();

    const listingStatus = product.listing ? "listed" : "unlisted";

    res.status(200).json({
      message: `Product successfully ${listingStatus}.`,
      product: {
        name: product.name,
        listing: product.listing,
        stockQuantity: product.stockQuantity,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating product listing" });
  }
};

exports.manageOrders = async (req, res) => {
  try {
    // Get page and limit from query parameters, with defaults
    const page = parseInt(req.query.page) || 1;   
    const limit = parseInt(req.query.limit) || 10; 

    // Calculate the number of documents to skip
    const skip = (page - 1) * limit;

    // Get the total number of orders
    const total = await orderModel.countDocuments();

    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    // Fetch paginated orders, sorted by orderedDate (newest first)
    const data = await orderModel
      .find()
      .skip(skip)
      .limit(limit)
      .sort({ orderedDate: -1 }); // Optional: Sort by date descending

    // Render the manageOrders view with all necessary data
    res.render("admin/manageOrders", {
      data,          // Paginated orders
      totalPages,    // Total number of pages
      page,          // Current page
      limit,         // Items per page
      total          // Total number of orders
    });
  } catch (e) {
    console.log(e);
    res.status(500).send("Internal Server Error");
  }
};

exports.toggleOrderStatus = async (req, res) => {
  const { id } = req.params; // Order ID from the URL
  const { status } = req.body; // New status from the request body

  try {
    // Check if the status transition is valid
    const validStatuses = ["Shipped", "Delivered"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status provided." });
    }

    // Fetch the order and update its status
    const order = await orderModel.findByIdAndUpdate(
      id,
      { status }, // Update the order status
      { new: true } // Return the updated order
    );

    // If the order is not found, return an error
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // Send a success response with the updated order
    return res.json({
      message: `Order status updated to ${status}.`,
      order: order, // You can send the updated order back if needed
    });
  } catch (error) {
    // If any error occurs, return an error response
    return res.status(500).json({ message: "Failed to update order status." });
  }
};
exports.manageOrdersPagination = async (req, res) => {
  const limit = 10; // Limit of orders per page
  let { pageNumber = 1 } = req.params;
  pageNumber = parseInt(pageNumber);
  if (isNaN(pageNumber) || pageNumber < 1) {
    pageNumber = 1;
  }

  const total = await orderModel.countDocuments(); // Get the total number of orders
  const totalPages = Math.ceil(total / limit); // Calculate total pages based on limit
  const page = Math.max(1, Math.min(totalPages, pageNumber)); // Ensure the page number is within bounds

  const pageData = await orderModel
    .find()
    .skip((page - 1) * limit) // Skip the previous pages orders
    .limit(limit); // Limit the number of orders per page

  return res.render("admin/manageOrders", {
    data: pageData, // Send pageData to the EJS template
    page,
    totalPages,
  });
};

exports.updateStock = async (req, res) => {
  const { productId } = req.params;
  const { stockSmall, stockMedium, stockLarge } = req.body;

  // Validate stock inputs
  if (
    isNaN(stockSmall) ||
    stockSmall < 0 ||
    isNaN(stockMedium) ||
    stockMedium < 0 ||
    isNaN(stockLarge) ||
    stockLarge < 0
  ) {
    return res.status(400).json({ message: "Invalid stock quantity" });
  }

  try {
    // Find the product by its ID
    const product = await Product.findById(productId);

    // If product not found
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Update stock for each size
    product.stock = {
      Small: stockSmall,
      Medium: stockMedium,
      Large: stockLarge,
    };

    // Save the updated product
    await product.save();

    // Send success response
    return res
      .status(200)
      .json({ message: "Stock quantity updated successfully", product });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "An error occurred while updating stock quantity" });
  }
};

exports.logout = (req, res) => {
  res.clearCookie("admin_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  res.redirect("/admin/login");
};



exports.cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let sessionEnded = false;

  try {
    const { orderId } = req.params;
    console.log(`Attempting to cancel order: ${orderId}`);

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      console.log("Invalid order ID format");
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid order ID format" });
    }

    const order = await orderModel.findById(orderId).populate("orderedItems.productId").session(session);
    if (!order) {
      console.log("Order not found");
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Order not found" });
    }
    console.log(`Order found: ${order.status}, Payment: ${order.paymentStatus}, Method: ${order.paymentMethod}`);

    if (order.status === "Delivered") {
      console.log("Order is already delivered");
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Cannot cancel a delivered order" });
    }

    let refundAmount = 0;

    if (order.paymentStatus === "Paid" || order.paymentStatus === "Completed") {
      const user = await User.findById(order.userId).session(session);
      if (!user) {
        console.log("User not found");
        return res.status(HttpStatus.NOT_FOUND).json({ message: "User not found" });
      }

      const paymentMethod = order.paymentMethod.toLowerCase().replace(/\s+/g, "");
      if (paymentMethod === "styleovawallet") {
        const originalTransaction = await walletHistoryModel.findOne(
          { userId: order.userId, "history.orderId": orderId },
          { "history.$": 1 }
        ).session(session);

        console.log("Original transaction:", originalTransaction);
        if (!originalTransaction || !originalTransaction.history.length) {
          console.log("No wallet payment transaction found");
          return res.status(HttpStatus.BAD_REQUEST).json({ message: "No wallet payment transaction found for this order" });
        }

        const { amount, originalAmount, discount } = originalTransaction.history[0];
        refundAmount = amount;
        console.log(`Wallet refund amount: ${refundAmount}`);

        console.log("User wallet before:", user.wallet);
        user.wallet += refundAmount;
        await user.save({ session });
        console.log("User wallet after:", user.wallet);

        const walletUpdate = await walletHistoryModel.findOneAndUpdate(
          { userId: order.userId },
          {
            $push: {
              history: {
                amount: refundAmount,
                originalAmount,
                discount,
                type: "credit",
                walletBalance: user.wallet,
                dateCreated: new Date(),
                reason: "Order Refund",
                orderId: order._id,
              },
            },
          },
          { upsert: true, new: true, session }
        );
        console.log("Wallet history update result:", walletUpdate);
      } else if (paymentMethod === "razorpay") {
        if (!order.paymentId) {
          console.log("Razorpay payment ID missing for order:", orderId);
          order.status = "Cancelled";
          await order.save({ session });
          await session.commitTransaction();
          session.endSession();
          sessionEnded = true;
          return res.status(HttpStatus.OK).json({
            success: true,
            message: "Order cancelled, but no refund processed due to missing Razorpay payment ID",
            refundAmount: 0,
          });
        }

        refundAmount = order.totalAmount;
        const refund = await razorpayInstance.payments.refund(order.paymentId, {
          amount: Math.round(refundAmount * 100),
        });
        console.log("Razorpay refund processed:", refund);

        if (refund.status !== "processed") {
          console.log("Razorpay refund failed:", refund);
          throw new Error("Razorpay refund failed");
        }

        order.paymentStatus = "Refunded";
      } else {
        console.log(`Unsupported payment method: ${order.paymentMethod}`);
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: `Cancellation not supported for payment method: ${order.paymentMethod}`,
        });
      }

      // Restore stock
      for (const orderedItem of order.orderedItems) {
        const product = await Product.findById(orderedItem.productId).session(session);
        if (product && product.stock[orderedItem.size] !== undefined) {
          product.stock[orderedItem.size] += orderedItem.quantity;
          await product.save({ session });
        }
      }
    }

    order.status = "Cancelled";
    await order.save({ session });
    console.log("Order cancelled successfully");

    await session.commitTransaction();
    session.endSession();
    sessionEnded = true;

    // Verify post-commit state
    const updatedWalletHistory = await walletHistoryModel.findOne({ userId: order.userId });
    console.log("Post-commit wallet history:", updatedWalletHistory);

    return res.status(HttpStatus.OK).json({
      success: true,
      message: "Order cancelled, stock updated, refund processed, and wallet history updated",
      refundAmount,
    });
  } catch (error) {
    if (!sessionEnded) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error("Error in admin cancelOrder:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: "Error while cancelling order",
      error: error.message,
    });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Fetch the order by ID and populate product details
    const order = await orderModel.findById(orderId).populate('orderedItems.productId');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Return order details as JSON
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error('Error in getOrderDetails:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


exports.approveReturn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { action } = req.body;

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    // Fetch the order
    const order = await orderModel.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if there are any return requests
    const returnItems = order.orderedItems.filter(item => item.returnRequested);
    if (returnItems.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'No pending return requests found' });
    }

    if (action === 'approve') {
      let totalOriginalAmount = 0; // Total price before discounts
      let totalDiscount = 0;       // Total discount applied
      let totalRefundAmount = 0;   // Total amount to refund (after discounts)

      // Process each return-requested item
      for (const item of returnItems) {
        // Calculate totals based on quantity
        const unitPrice = item.originalPrice || item.price; // Use originalPrice if available, else price
        const totalItemOriginalPrice = unitPrice * item.quantity; // Total price before discount
        const itemDiscount = item.offerDiscount || 0; // Total discount for this item
        const itemRefundAmount = totalItemOriginalPrice - itemDiscount; // Refund amount for this item

        // Update item status
        item.status = 'Returned';
        item.returned = true;
        item.returnRequested = false;

        // Restock product
        const product = await Product.findById(item.productId).session(session);
        if (product && product.stock[item.size] !== undefined) {
          product.stock[item.size] += item.quantity;
          await product.save({ session });
        } else {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, message: `Product or size not found for restocking: ${item.productId}` });
        }

        // Aggregate totals
        totalOriginalAmount += totalItemOriginalPrice;
        totalDiscount += itemDiscount;
        totalRefundAmount += itemRefundAmount;

        console.log(`Item processed: productId=${item.productId}, size=${item.size}, original=${totalItemOriginalPrice}, discount=${itemDiscount}, refund=${itemRefundAmount}`);
      }

      // Refund to user wallet
      const user = await User.findByIdAndUpdate(
        order.userId,
        { $inc: { wallet: totalRefundAmount } },
        { new: true, session }
      );
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Log wallet history
      await walletHistoryModel.findOneAndUpdate(
        { userId: order.userId },
        {
          $push: {
            history: {
              amount: totalRefundAmount,       // Amount credited to wallet
              originalAmount: totalOriginalAmount, // Total price before discount
              discount: totalDiscount,         // Total discount applied
              type: 'credit',
              walletBalance: user.wallet,
              dateCreated: new Date(),
              reason: 'Refund for approved return',
              orderId: order._id,
            },
          },
        },
        { upsert: true, new: true, session }
      );

      // Update order status if all items are returned or cancelled
      const allProcessed = order.orderedItems.every(item => item.status === 'Returned' || item.status === 'Cancelled');
      if (allProcessed) {
        order.status = 'Returned';
        order.paymentStatus = 'Refunded';
      }

      await order.save({ session });
      await session.commitTransaction();
      session.endSession();

      console.log(`Return approved: orderId=${orderId}, originalAmount=${totalOriginalAmount}, discount=${totalDiscount}, refundAmount=${totalRefundAmount}`);

      res.status(200).json({ success: true, message: 'Return approved and processed' });
    } else if (action === 'reject') {
      // Reject all return requests
      for (const item of returnItems) {
        item.returnRequested = false;
        item.status = 'Delivered'; // Revert to previous status
      }

      await order.save({ session });
      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ success: true, message: 'Return request rejected' });
    } else {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error in approveReturn:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};






  
