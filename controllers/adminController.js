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
    const data = await User.find({});
    res.render("admin/manageUsers", {
      data,
      successMessage: req.flash("success"),
      errorMessage: req.flash("error"),
    });
  } catch (err) {
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
    const data = await Category.find({});
    console.log(data);
    res.render("admin/adminCategory", { data });
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
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
  const { id } = req.params; // Get category ID from the route parameters

  try {
    // Find the category by its ID
    const category = await Category.findById(id);

    // If category is not found, return a 404 error
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Toggle the listing status of the category
    category.listing = !category.listing;

    // Save the updated category
    await category.save();

    // Send a success message back to the client
    res.status(200).json({ message: "Category listing toggled successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating category listing" });
  }
};

exports.adminProducts = async (req, res) => {
  try {
    const data = await Product.find().populate("category");
    const products = await Product.find();

    // Log the product data to inspect its structure
    console.log(data);

    // Ensure that each product has an images array (even if empty)
    data.forEach((product) => {
      if (!product.images) {
        product.images = []; // Set it to an empty array if undefined
      }
    });

    res.render("admin/adminProducts", { data });
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
    const { name, description, rating, rate, category } = req.body;
    console.log(req.body);
    // Validate input fields
    if (!name || !description || !rating || !rate || !category) {
      return res.status(400).send({ message: "All fields are required" });
    }

    // Check if files are uploaded
    if (!req.files || req.files.length !== 3) {
      return res.status(400).send({ message: "Exactly 3 images are required" });
    }

    // Extract file paths
    const imagesArray = req.files.map((file) => file.path);
    console.log(req.files);

    // Create a new product instance
    const newProduct = new Product({
      name,
      description,
      rating,
      rate,
      category,
      images: imagesArray,
    });

    // Save the product to the database
    await newProduct.save();

    console.log("Product added successfully");

    res.redirect("/admin/products?msg=added");
  } catch (err) {
    console.error("Error adding product:", err);
    res.status(500).send({
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
  try {
    const { id, name, description, rating, category, deleteImages,rate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    if (category && !mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    if (!name || !description || !category) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    let updatedImages = existingProduct.images;

    if (deleteImages) {
      const imagesToDelete = JSON.parse(deleteImages);
      updatedImages = updatedImages.filter(
        (image) => !imagesToDelete.includes(image)
      );

      imagesToDelete.forEach((image) => {
        const imagePath = path.join(__dirname, "uploads", image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath); // Delete file from server
        }
      });
    }

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map((file) => `uploads/${file.filename}`);
      updatedImages = [...updatedImages, ...newImages];
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { name, description, rating, category, images: updatedImages ,rate},
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not updated" });
    }

    return res
      .status(200)
      .json({ message: "Product updated successfully", updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred while updating the product." });
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
    let page = 1;
    const limit = 5;
    const total = await orderModel.countDocuments();
    const totalPages = Math.ceil(total / limit);

    const data = await orderModel.find().limit(limit);
    // console.log(data)

    res.render("admin/manageOrders", { data, totalPages, page });
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
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
  try {
    const { orderId } = req.params;

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }

    // Find the order and populate product details
    const order = await orderModel.findById(orderId).populate("orderedItems.productId");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Prevent cancellation of delivered orders
    if (order.status === "Delivered") {
      return res.status(400).json({ message: "Cannot cancel a delivered order" });
    }

    let refundAmount = 0; // 🔥 Fix: Declared outside if block

    // If the order was paid, process refund
    if (order.paymentStatus === "Paid" || order.paymentStatus === "Completed") {
      // Calculate refund amount and restore product stock
      for (const orderedItem of order.orderedItems) {
        refundAmount += (orderedItem.price - orderedItem.offerDiscount) * orderedItem.quantity;

        // Restore product stock for the specific size
        const product = await Product.findById(orderedItem.productId);
        if (product && product.stock[orderedItem.size] !== undefined) {
          product.stock[orderedItem.size] += orderedItem.quantity;
          await product.save();
        }
      }

      // Credit refund to user wallet
      if (refundAmount > 0) {
        const user = await User.findById(order.userId);
        if (user) {
          user.wallet += refundAmount; // Increase wallet balance
          await user.save();

          // 🛠️ **Fix: Update Wallet History Correctly**
          await walletHistoryModel.findOneAndUpdate(
            { userId: order.userId }, // Find wallet history for the user
            {
              $push: {
                history: {
                  amount: refundAmount,
                  type: "credit",
                  walletBalance: user.wallet, // Store updated balance
                  dateCreated: new Date(),
                },
              },
            },
            { upsert: true, new: true } // Create new if not exists, return updated
          );
        } else {
          console.error("User not found for order:", order._id);
        }
      }

      // Update payment status to "Refunded"
      order.paymentStatus = "Refunded";
    }

    // Update order status to "Cancelled"
    order.status = "Cancelled";
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order cancelled, stock updated, refund processed, and wallet history updated.",
      refundAmount: refundAmount, // ✅ Now correctly defined
    });

  } catch (error) {
    console.error("Error in admin cancelOrder:", error);
    return res.status(500).json({ message: "Error while cancelling order." });
  }
};




  
