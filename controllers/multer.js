const multer = require("multer");
const path = require("path");
const sharp = require("sharp");

// Set up storage with unique filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Upload directory
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// Multer middleware with file type restriction
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // Limit file size to 10 MB
    files: 3                    // Max 3 files, adjust as needed
  },
  fileFilter: (req, file, cb) => {
    // Define allowed image MIME types
    const allowedImageTypes = [
      'image/jpeg', // .jpg, .jpeg
      'image/png',  // .png
      'image/gif',  // .gif
      'image/webp', // .webp
    ];

    // Check if the file MIME type is allowed
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true); // Accept the file
    } else {
      cb(new Error(`Only image files (JPEG, PNG, GIF, WebP) are allowed: ${file.originalname}`), false);
    }
  }
}).array("images", 3); // Max 3 files, adjust for flexibility if needed

// Middleware to process images before proceeding
const processImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(); // Skip if no files are uploaded
  }

  try {
    // Process all files concurrently and wait for completion
    const processingPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const outputPath = `${file.destination}/resized-${file.filename}`;
        sharp(file.path)
          .resize(800, 800) // Resize the image
          .extract({ width: 700, height: 700, left: 50, top: 50 }) // Crop the image
          .toFile(outputPath, (err, info) => {
            if (err) {
              console.log("Error processing image:", err);
              reject(err);
            } else {
              console.log("Image resized and saved:", info);
              file.path = outputPath; // Update file path to the resized image
              resolve();
            }
          });
      });
    });

    // Wait for all images to be processed
    await Promise.all(processingPromises);
    next(); // Proceed only after all images are processed
  } catch (err) {
    console.error("Error in processImages:", err);
    return res.status(500).json({ message: "Failed to process images" });
  }
};

module.exports = { upload, processImages };