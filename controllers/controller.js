const Category = require("../models/categoryModel");
const userModel = require("../models/userModel");
const jwt = require("jsonwebtoken");

exports.index = async (req, res) => {
  try {
    const category = await Category.find();
    const token = req.cookies.token; // Match googleRedirect and verifyUser
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      const user = await userModel.findById(decoded.userId); // Use _id, not email
      if (user && user.status === "active") {
        return res.render("user/index", { user: true, category }); // Fix typo: categories -> category
      } else {
        res.clearCookie("token");
        return res.redirect("/user/login?msg=userBlocked");
      }
    }
    res.render("user/index", { category, user: false });
  } catch (e) {
    console.error("Error:", e);
    res.status(500).send("Error");
  }
};
