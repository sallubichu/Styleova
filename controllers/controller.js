const Category = require("../models/categoryModel");
const userModel = require("../models/userModel");
const jwt = require("jsonwebtoken");

exports.index = async (req, res) => {
  try {
    const category = await Category.find();
    const token = req.cookies.userJwtAuth;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const user = await userModel.findOne({ email: decoded.email });

        if (user && user.status === "active") {
          return res.render("user/index", { user: true, categories });
        } else {
          res.clearCookie("userJwtAuth");
          return res.redirect("/user/login?msg=userBlocked");
        }
      } catch (err) {
        if (err.name === "TokenExpiredError") {
          res.clearCookie("userJwtAuth");
          return res.redirect("/user/login?msg=tokenExpired");
        }
        console.error("JWT error:", err);
        return res.status(401).send("Unauthorized");
      }
    }

    // If no token, render the public view
    res.render("user/index", { category, user: false });
  } catch (e) {
    console.error("Error:", e);
    res.status(500).send("Error");
  }
};
