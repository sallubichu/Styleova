const jwt = require("jsonwebtoken");
const UserModel = require("../models/userModel");

const verifyUser = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    // Check if token exists
    if (!token) {
      return res.redirect("/user/login?msg=nologin");
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // Fetch user from the database
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      return res.status(401).redirect("/user/login?msg=usernotfound");
    }

    // Check if the user is blocked
    if (user.status === "blocked") {
      res.clearCookie("token"); // Clear the JWT cookie
      return res.redirect("/user/login?msg=block");
    }

    // Attach the user to the request object
    req.user = user;
    next();
  } catch (error) {
    console.error("JWT verification failed:", error);

    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      return res.redirect("/user/login?msg=expiredtoken");
    }

    // Clear the invalid token and redirect to login
    res.clearCookie("token");
    return res.redirect("/user/login?msg=invalidtoken");
  }
};

module.exports = verifyUser;