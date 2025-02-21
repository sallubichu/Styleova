const Wishlist = require("../models/wishlistModel");
const Product = require("../models/productModel");
const mongoose = require("mongoose");

exports.getWishlist = async (req, res) => {
  try {
    let user = req.user;
    if (!user) {
      return res.redirect("/user/login"); // Redirect to login if no user found
    }

    const wishlist = await Wishlist.findOne({ userId: user._id }).populate(
      "products"
    );

    // Calculate total amount
    let totalAmount = 0;
    if (wishlist && wishlist.products) {
      totalAmount = wishlist.products.reduce(
        (sum, product) => sum + product.rate,
        0
      );
    }

    res.render("user/profile/wishlist", {
      wishlist: wishlist || { products: [] },
      user: user,
      totalAmount: totalAmount, // Pass totalAmount to the view
    });
  } catch (error) {
    console.error(error);
    res.status(500).render("error", { message: "Server Error" });
  }
};

// Add to Wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user ? req.user._id : req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "nouser" });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [] });
    }

    if (!wishlist.products) {
      wishlist.products = [];
    }

    const alreadyExists = wishlist.products.some(
      (id) => id.toString() === productId
    );

    if (alreadyExists) {
      return res.status(400).json({ message: "exists" });
    }

    wishlist.products.push(new mongoose.Types.ObjectId(productId));
    await wishlist.save();

    res.status(200).json({ message: "added", wishlist });
  } catch (error) {
    console.error("Error in addToWishlist:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Remove from Wishlist
exports.removeFromWishlist = async (req, res) => {
  console.log("delete button triggered");
  try {
    if (!req.user) return res.status(401).json({ message: "nouser" });

    const userId = req.user._id;
    const { id } = req.params;
    console.log("User from request:", req.user);
    const response = await Wishlist.findOneAndUpdate(
      { userId: userId },
      { $pull: { products: id } },
      { new: true }
    );
    console.log(response);
    res
      .status(response ? 200 : 500)
      .json({ message: response ? "success" : "Server Error" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to remove from wishlist" });
  }
};
