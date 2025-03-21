const cartModel = require("../models/cartModel");
const userModel = require("../models/userModel");
const productModel = require("../models/productModel");
const jwt = require("jsonwebtoken");
const addressModel = require("../models/addressModel");
const mongoose = require("mongoose");
const couponModel = require("../models/couponModel");
const orderModel = require("../models/orderModel");
const HttpStatus = require('../utils/httpStatus'); // Import the enum

exports.viewCart = async (req, res) => {
  let user = req.user;
  try {
    const cart = await cartModel
      .findOne({ user: req.user._id })
      .populate("products.productId");

    const cartCount = cart && cart.products ? cart.products.length : 0; // Calculate cart count

    if (!cart) {
      return res.render("user/cart", {
        cart: { products: [] },
        totalAmount: 0,
        cartCount: 0, // Pass cartCount even when cart is empty
        user,
      });
    }

    const validProducts = cart.products.filter(
      (product) => product.productId && product.productId !== null
    );

    const totalAmount = validProducts.reduce((total, product) => {
      const rate = product.productId.rate || 0;
      const quantity = product.quantity || 1;
      return total + rate * quantity;
    }, 0);

    res.render("user/cart", {
      cart: { products: validProducts },
      totalAmount,
      cartCount, // Pass cartCount to the view
      user,
    });
  } catch (error) {
    console.error("Error viewing cart:", error);
    res.render("user/cart", {
      cart: { products: [] },
      totalAmount: 0,
      cartCount: 0, // Ensure cartCount is passed even in error case
      user,
      error: "Server error", // Pass error message to display if needed
    });
  }
};

exports.addToCart = async (req, res) => {
  console.log("🛒 Add to Cart Triggered");
  console.log("Request Body:", req.body);

  try {
    const userId = req.user._id;
    const productId = req.body.productId;
    let quantity = parseInt(req.body.quantity) || 1; 
    const size = req.body.size?.trim();

    const validSizes = ["Small", "Medium", "Large"];
    if (!size || !validSizes.includes(size)) {
      console.log("❌ Invalid size received:", size);
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: `Invalid or missing size: ${size}` });
    }

    // Ensure quantity is at least 1
    if (isNaN(quantity) || quantity < 1) {
      return res.status(HttpStatus.BAD_REQUEST).json({ 
        message: "Quantity must be at least 1" 
      });
    }

    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Product not found" });
    }

    console.log("✅ Product found:", product.name);
    console.log("🗃️ Product stock:", product.stock);

    if (!product.stock || !product.stock[size] || product.stock[size] <= 0) {
      console.log(`❌ No stock found for size: ${size}`);
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: `Selected size (${size}) is out of stock.`,
      });
    }

    if (quantity > product.stock[size]) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: `Only ${product.stock[size]} units available for size ${size}.`,
      });
    }

    let cart = await cartModel.findOne({ user: userId });

    if (!cart) {
      cart = new cartModel({
        user: userId,
        products: [],
      });
    }

    const existingProductIndex = cart.products.findIndex(
      (item) =>
        item.productId.toString() === productId.toString() && item.size === size
    );

    if (existingProductIndex !== -1) {
      const updatedQuantity =
        cart.products[existingProductIndex].quantity + quantity;

      // Only check against available stock
      if (updatedQuantity > product.stock[size]) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: `Only ${product.stock[size]} units available for size ${size}.`,
        });
      }

      cart.products[existingProductIndex].quantity = updatedQuantity;
    } else {
      // No limit on unique products or initial quantity (except stock)
      cart.products.push({
        productId: new mongoose.Types.ObjectId(productId),
        quantity,
        size,
      });
    }

    await cart.save();

    const populatedCart = await cartModel
      .findOne({ user: userId })
      .populate("products.productId", "name price images");

    return res.status(HttpStatus.OK).json({
      message: "Product added to cart",
      cart: populatedCart,
    });
  } catch (error) {
    console.error("🚨 Error in addToCart:", error);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "Something went wrong", error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    let user = req.user;
    if (!user) {
      res.status(HttpStatus.OK).json({ message: "nouser" });
    }
    const id = req.params.id;

    let response = await cartModel.findOneAndUpdate(
      { user: user._id },
      { $pull: { products: { productId: id } } },
      { new: true }
    );
    if (response) {
      res.status(HttpStatus.OK).json({ message: "success" });
    } else {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Server Error" });
    }
  } catch (e) {
    console.log(e);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send("Failed to delete");
  }
};

exports.renderCheckout = async (req, res) => {
  try {
    let user = req.user;
    if (!user) {
      return res.redirect("/user/login?msg=loggin");
    }

    const cartAuth = await cartModel.findOne({ user: user._id }).populate({
      path: "products.productId",
      populate: {
        path: "category",
      },
    });

    if (cartAuth && cartAuth.products.length > 0) {
      cartAuth.products.forEach(async (product) => {
        if (product.listing == false) {
          await cartModel.deleteOne({ _id: product._id });
        }
      });
    }

    const cart = await cartModel.findOne({ user: user._id }).populate({
      path: "products.productId",
      populate: {
        path: "category",
      },
    });

    const address = await addressModel.find({ user: user._id });

    const coupon = await couponModel.find().lean();

    for (let element of coupon) {
      if (new Date() > element.expiryDate) {
        await couponModel.updateOne(
          { _id: element._id },
          { isActive: "Expired" }
        );
      }
    }

    const coupons = await couponModel.find({ isActive: "Active" });

    if (cart && cart.products.length > 0) {
      let totalAmount = cart.products.reduce(
        (sum, item) => sum + item.productId.rate * item.quantity,
        0
      );

      const filteredCoupons = coupons.filter((coupon) => {
        return totalAmount > coupon.minimumPurchaseAmount;
      });

      return res.render("user/checkout", {
        user,
        cart,
        totalAmount,
        address,
        filteredCoupons,
      });
    } else {
      req.flash("cartEmpty", "Your cart is empty!");
      return res.redirect("/user/viewCart");
    }
  } catch (e) {
    console.error("❌ Error in renderCheckout:", e);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send("Error!");
  }
};

exports.updateQuantity = async (req, res) => {
  const { productId } = req.params;
  const { quantity, size } = req.body;

  try {
    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Product not found." });
    }

    const cart = await cartModel.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Cart not found." });
    }

    const cartProduct = cart.products.find(
      (item) => item.productId.toString() === productId && item.size === size
    );

    if (!cartProduct) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Product not found in cart." });
    }



    const quantityDifference = quantity - cartProduct.quantity;

    if (quantityDifference > 0 && product.stock[size] < quantityDifference) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: "Insufficient stock for the selected size." });
    }

    cartProduct.quantity = quantity;
    cartProduct.totalPrice = product.rate * quantity;

    await cart.save();

    res.status(HttpStatus.OK).json({ message: "Quantity updated successfully.", cart });
  } catch (error) {
    console.error("Error updating quantity:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to update quantity." });
  }
};