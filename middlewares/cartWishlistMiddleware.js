const Cart = require("../models/cartModel"); 
const Wishlist = require("../models/wishlistModel"); 

const cartWishlistMiddleware = async (req, res, next) => {
  if (req.user) { 
    try {
      // Fetch cart count
      const cart = await Cart.findOne({ user: req.user._id });
      const cartCount = cart ? cart.products.length : 0;

      // Fetch wishlist count
      const wishlist = await Wishlist.findOne({ userId: req.user._id });
      const wishlistCount = wishlist ? wishlist.products.length : 0;

      // Make counts available to all views
      res.locals.cartCount = cartCount;
      res.locals.wishlistCount = wishlistCount;
      console.log(`Cart Count: ${cartCount}, Wishlist Count: ${wishlistCount}`);
    } catch (error) {
      console.error("Error fetching cart/wishlist counts:", error);
      res.locals.cartCount = 0; 
      res.locals.wishlistCount = 0;
    }
  } else {
    // If user is not logged in, set counts to 0
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;
  }
  next();
};

module.exports = cartWishlistMiddleware;