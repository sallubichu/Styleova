const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const adminRoutes = require("./routes/adminRoutes");
const bodyParser = require("body-parser");
const path = require("path");
const cookieParser = require("cookie-parser");
const userRoutes = require("./routes/userRoutes");
const jwtSecret = process.env.JWT_SECRET_KEY;
const route = require("./routes/routes");
const nocache = require("nocache");
const connectDB = require("./config/database");

const passport = require("passport");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing incoming requests
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(nocache());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-session-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

// Set view engine to EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware to pass flash messages to the view
app.use((req, res, next) => {
  res.locals.successMessage = req.flash("success");
  res.locals.errorMessage = req.flash("error");
  next();
});

// Routes
app.use(adminRoutes);
app.use(userRoutes);
app.use("/", route);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong! Please try again later.");
});

// Database connection

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

connectDB();
