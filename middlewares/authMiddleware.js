const jwt = require("jsonwebtoken");
const UserModel = require("../models/userModel");

const verifyUser = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.redirect("/user/login?msg=nologin");
    }

    // Decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // Retrieve user details from the database
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      return res.status(401).send("User not found.");
    }

    if (user.status === "blocked") {
      res.clearCookie("token"); // Clear JWT cookie
      return res.redirect("/user/login?msg=block");
    }

    req.user = user; // Attach full user object to req
    next();
  } catch (error) {
    console.error("JWT verification failed:", error);

    if (error.name === "TokenExpiredError") {
      return res.redirect("/user/login?msg=expiredtoken");
    }

    res.redirect("/user/login?msg=invalidtoken");
  }
};

module.exports = verifyUser;
