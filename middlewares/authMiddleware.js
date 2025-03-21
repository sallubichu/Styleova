const jwt = require("jsonwebtoken"); // Import JWT library
const User = require("../models/userModel"); // Import your UserModel

const verifyUser = async (req, res, next) => {
  try {
    console.log("Middleware: Verifying token...");
    const token = req.cookies.token;

    // Check if token exists
    if (!token) {
      console.log("No token found, allowing access to login page");
      return next(); // Allow access to the login page if no token is found
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    console.log("Decoded Token:", decoded);

    // Fetch user from the database
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log("User not found, clearing cookie and redirecting to login");
      res.clearCookie("token");
      return res.redirect("/user/login?msg=usernotfound");
    }

    // Check if the user is blocked
    if (user.status === "blocked") {
      console.log("User is blocked, clearing cookie and redirecting to login");
      res.clearCookie("token");
      return res.redirect("/user/login?msg=block");
    }

    // Attach the user to the request object
    req.user = user;
    console.log("User verified:", user);

    // If the user is trying to access the login page, redirect them to the dashboard
    if (req.originalUrl === "/user/login") {
      console.log("Logged-in user trying to access login page, redirecting to dashboard");
      return res.redirect("/user/dashboard");
    }

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    console.error("JWT verification failed:", error);

    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      console.log("Token expired, clearing cookie and redirecting to login");
      res.clearCookie("token");
      return res.redirect("/user/login?msg=expiredtoken");
    }

    // Clear the invalid token and redirect to login
    console.log("Invalid token, clearing cookie and redirecting to login");
    res.clearCookie("token");
    return res.redirect("/user/login?msg=invalidtoken");
  }
};

module.exports = { verifyUser };