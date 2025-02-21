const multer = require("multer");
const path = require("path");
const sharp = require("sharp");

// Set up storage with unique filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Upload directory
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9); // Adding a unique suffix
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    ); // Unique filename
  },
});

// Multer middleware to handle multiple files and image processing
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10 MB (can be adjusted)
}).array("images", 5); // Allowing up to 5 images

// Middleware to process images before uploading
const processImages = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(); // Skip if no files are uploaded
  }

  // Process each file one by one
  req.files.forEach((file, index) => {
    sharp(file.path)
      .resize(800, 800) // Resize the image (you can adjust the dimensions)
      .extract({ width: 700, height: 700, left: 50, top: 50 }) // Crop the image to a specific region (use extract instead of crop)
      .toFile(file.destination + "/resized-" + file.filename, (err, info) => {
        if (err) {
          console.log("Error processing image:", err);
        } else {
          console.log("Image resized and saved:", info);
        }
      });
  });

  next(); // Continue with the request processing
};

module.exports = { upload, processImages };
