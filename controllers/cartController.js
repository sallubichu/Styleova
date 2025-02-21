const cartModel = require("../models/cartModel");
const userModel = require("../models/userModel");
const productModel = require("../models/productModel");
const jwt = require("jsonwebtoken");
const addressModel = require("../models/addressModel");
const mongoose = require("mongoose");
const couponModel = require("../models/couponModel");
const orderModel = require("../models/orderModel");

exports.viewCart = async (req, res) => {
  let user = req.user;
  try {
    const cart = await cartModel
      .findOne({ user: req.user._id })
      .populate("products.productId");

    if (!cart) {
      return res.render("user/cart", {
        cart: { products: [] },
        totalAmount: 0,
        user,
      });
    }

    // ✅ Filter out invalid products
    const validProducts = cart.products.filter(
      (product) => product.productId && product.productId !== null
    );

    // ✅ Use `rate` instead of `price`
    const totalAmount = validProducts.reduce((total, product) => {
      const rate = product.productId.rate || 0; // Using rate instead of price
      const quantity = product.quantity || 1; // Ensuring quantity is valid
      return total + rate * quantity;
    }, 0);

    res.render("user/cart", {
      cart: { products: validProducts },
      totalAmount,
      user,
    });
  } catch (error) {
    console.error("Error viewing cart:", error);
    res.status(500).send("Server error");
  }
};

exports.addToCart = async (req, res) => {
  console.log("🛒 Add to Cart Triggered");
  console.log("Request Body:", req.body);

  try {
    const userId = req.user._id;
    const productId = req.body.productId;
    let quantity = parseInt(req.body.quantity) || 1;
    const size = req.body.size?.trim(); // Normalize size input

    // 🔹 Validate Size
    const validSizes = ["Small", "Medium", "Large"];
    if (!size || !validSizes.includes(size)) {
      console.log("❌ Invalid size received:", size);
      return res
        .status(400)
        .json({ message: `Invalid or missing size: ${size}` });
    }

    // 🔹 Validate Quantity
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    // 🔹 Find Product
    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    console.log("✅ Product found:", product.name);
    console.log("🗃️ Product stock:", product.stock);

    // 🔹 Check Stock Availability
    if (!product.stock || !product.stock[size] || product.stock[size] <= 0) {
      console.log(`❌ No stock found for size: ${size}`);
      return res.status(400).json({
        message: `Selected size (${size}) is out of stock.`,
      });
    }

    if (quantity > product.stock[size]) {
      return res.status(400).json({
        message: `Only ${product.stock[size]} units available for size ${size}.`,
      });
    }

    // 🔹 Find the users cart
    let cart = await cartModel.findOne({ user: userId });

    if (!cart) {
      // If cart doesnt exist, create a new one
      cart = new cartModel({
        user: userId,
        products: [],
      });
    }

    // 🔹 Check if the product (same size) is already in the cart
    const existingProductIndex = cart.products.findIndex(
      (item) =>
        item.productId.toString() === productId.toString() && item.size === size
    );

    if (existingProductIndex !== -1) {
      // If product exists, update its quantity
      const updatedQuantity =
        cart.products[existingProductIndex].quantity + quantity;

      if (updatedQuantity > Math.min(5, product.stock[size])) {
        return res.status(400).json({
          message: `You can only add up to ${Math.min(
            5,
            product.stock[size]
          )} units.`,
        });
      }

      cart.products[existingProductIndex].quantity = updatedQuantity;
    } else {
      // Only check cart limit when adding a new product
      const uniqueProductIds = new Set(
        cart.products.map((item) => item.productId.toString())
      );
      if (
        uniqueProductIds.size >= 5 &&
        !uniqueProductIds.has(productId.toString())
      ) {
        return res.status(400).json({
          message:
            "You can only add a maximum of 5 different products to your cart.",
        });
      }

      if (quantity > 5) {
        return res.status(400).json({
          message: "You can only add up to 5 units of this product.",
        });
      }

      cart.products.push({
        productId: new mongoose.Types.ObjectId(productId),
        quantity,
        size,
      });
    }

    // 🔹 Save the updated cart
    await cart.save();

    // 🔹 Return the updated cart (populated with product details)
    const populatedCart = await cartModel
      .findOne({ user: userId })
      .populate("products.productId", "name price images");

    return res.status(200).json({
      message: "Product added to cart",
      cart: populatedCart,
    });
  } catch (error) {
    console.error("🚨 Error in addToCart:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong", error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    let user = req.user;
    if (!user) {
      res.status(200).json({ message: "nouser" });
    }
    const id = req.params.id;

    let response = await cartModel.findOneAndUpdate(
      { user: user._id },
      { $pull: { products: { productId: id } } },
      { new: true }
    );
    if (response) {
      res.status(200).json({ message: "success" });
    } else {
      res.status(500).json({ message: "Server Error" });
    }
  } catch (e) {
    console.log(e);
    res.status(500).send("Failed to delete");
  }
};

exports.renderCheckout = async (req, res) => {
  try {
    let user = req.user;
    if (!user) {
      return res.redirect("/user/login?msg=loggin");
    }

    // Cart validation for listing of the product
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

    // Fetch cart after removing unavailable products
    const cart = await cartModel.findOne({ user: user._id }).populate({
      path: "products.productId",
      populate: {
        path: "category",
      },
    });

    const address = await addressModel.find({ user: user._id });

    const coupon = await couponModel.find().lean(); // Converts to plain objects

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
    res.status(500).send("Error!");
  }
};
exports.updateQuantity = async (req, res) => {
  const { productId } = req.params;
  const { quantity, size } = req.body;

  try {
    // Fetch the product
    const product = await productModel.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    // Fetch the cart
    const cart = await cartModel.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found." });
    }

    // Find the product in the cart
    const cartProduct = cart.products.find(
      (item) => item.productId.toString() === productId && item.size === size
    );

    if (!cartProduct) {
      return res.status(404).json({ message: "Product not found in cart." });
    }

    // Validate the new quantity
    if (quantity < 1 || quantity > 5) {
      return res
        .status(400)
        .json({ message: "Quantity must be between 1 and 5." });
    }

    // Calculate the difference between the new and old quantity
    const quantityDifference = quantity - cartProduct.quantity;

    // Check if stock is sufficient for the selected size
    if (quantityDifference > 0 && product.stock[size] < quantityDifference) {
      return res
        .status(400)
        .json({ message: "Insufficient stock for the selected size." });
    }

    // Update the cart product quantity
    cartProduct.quantity = quantity;

    // Recalculate the total price for the product
    cartProduct.totalPrice = product.rate * quantity;

    // Save the updated cart
    await cart.save();

    res.status(200).json({ message: "Quantity updated successfully.", cart });
  } catch (error) {
    console.error("Error updating quantity:", error);
    res.status(500).json({ message: "Failed to update quantity." });
  }
};
