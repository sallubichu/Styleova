const express = require("express");
const router = express.Router();
const Controller = require("../controllers/controller");
const verifyUser = require("../middlewares/authMiddleware.js");

router.get("/",Controller.index);

module.exports = router;
