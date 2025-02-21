const jwt = require("jsonwebtoken");
require("dotenv").config();

exports.adminJwtAuth = (req, res, next) => {
  const token = req.cookies.admin_token;
  if (!token) {
    return res.redirect("/admin/login");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.admin = decoded;
    next();
  } catch (err) {
    console.error("JWT Error:", err.message);
    res.clearCookie("admin_token");
    return res.redirect("/admin/login");
  }
};
