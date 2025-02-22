const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const UserDb = require("../models/userModel");
const jwt = require("jsonwebtoken");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
      session: false,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google profile:", profile); // Debugging
        const email = profile.emails[0].value.toLowerCase();

        let user = await UserDb.findOne({ email });

        if (!user) {
          console.log("Creating new user with Google profile"); // Debugging
          user = await new UserDb({
            name: profile.displayName,
            email: email,
            wallet: 0,
          }).save();
        }

        console.log("User found/created:", user); // Debugging
        return done(null, user);
      } catch (err) {
        console.error("Error in GoogleStrategy:", err); // Debugging
        return done(err);
      }
    }
  )
);
// Google OAuth login route
exports.googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false, // No sessions, using JWT
});

// Google OAuth callback route
exports.googleRedirect = [
  passport.authenticate("google", { failureRedirect: "/", session: false }),
  (req, res) => {
    try {
      if (!req.user) {
        console.error("Google authentication failed: No user found");
        return res.status(401).json({ message: "Google authentication failed." });
      }

      // Generate JWT token
      const token = jwt.sign(
        { email: req.user.email, id: req.user._id },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "7d" }
      );

      // Set secure cookie for JWT
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      });

      console.log("JWT token set for user:", req.user.email); // Debugging
      res.redirect("/user/dashboard");
    } catch (error) {
      console.error("Error during Google OAuth:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
];