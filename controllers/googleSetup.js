const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const UserDb = require("../models/userModel");
const jwt = require("jsonwebtoken");

// Configure Passport with Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/auth/google/callback",
      session: false, 
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google profile:", profile); // Debug: Log Google profile data
        const email = profile.emails[0].value.toLowerCase();

        // Find or create user based on email
        let user = await UserDb.findOne({ email });
        if (!user) {
          console.log("Creating new user with Google profile");
          user = new UserDb({
            name: profile.displayName,
            email: email,
            wallet: 0, // Assuming wallet is a field in your User model
            googleId: profile.id, // Optional: Store Google ID for future reference
          });
          await user.save();
        }

        console.log("User found/created:", user.email);
        return done(null, user);
      } catch (err) {
        console.error("Error in GoogleStrategy:", err);
        return done(err, null);
      }
    }
  )
);

// Serialize and deserialize user (optional, only if using sessions)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await UserDb.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth callback handler
exports.googleRedirect = [
  passport.authenticate("google", {
    failureRedirect: "/user/login?msg=googlefail",
    session: false, // No session, relying on JWT
  }),
  (req, res) => {
    try {
      if (!req.user) {
        console.error("Google authentication failed: No user attached");
        return res.status(401).json({ message: "Google authentication failed." });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: req.user._id },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "7d" }
      );

      // Set JWT token in cookie
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Secure in production
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      console.log("JWT token set for user:", req.user.email);
      console.log("Redirecting to /user/dashboard");
      res.redirect("/user/dashboard");
    } catch (error) {
      console.error("Error during Google OAuth callback:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
];

// Optional: Export googleAuth if you need to call it explicitly (not needed if using routes directly)
exports.googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false,
});

module.exports = exports;