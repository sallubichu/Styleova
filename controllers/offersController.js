const Offers = require("../models/offerModel");

// Render offers page
exports.renderOffers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default to 10 offers per page
    const skip = (page - 1) * limit;

    // Fetch paginated offers
    const offers = await Offers.find()
      .skip(skip)
      .limit(limit);

    // Get the total number of offers
    const totalOffers = await Offers.countDocuments();

    // Calculate total pages
    const totalPages = Math.ceil(totalOffers / limit);

    res.render("admin/manageOffers", {
      offers,
      pagination: {
        totalOffers,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching offers:", error);
    res.redirect("/admin/getOffers");
  }
};

// Add a new offer
exports.addOffer = async (req, res) => {
  try {
    const {
      name,
      type,
      discountType,
      discountValue,
      startDate,
      endDate,
      status,
    } = req.body;

  const existingOffer = await Offers.findOne({ name });
  if (existingOffer) {
    return res.status(400).json({
      success: false,
      message: "An offer with this name already exists.",
    });
  }

    // Validate start and end dates
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: "End date must be after the start date.",
      });
    }

    const newOffer = new Offers({
      name,
      type,
      discountType,
      discountValue,
      startDate,
      endDate,
      status,
    });

    await newOffer.save();

    res.status(200).json({
      success: true,
      message: "Offer added successfully.",
    });
  } catch (error) {
    console.error("Error adding offer:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while adding the offer.",
    });
  }
};

// Delete an offer
exports.deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedOffer = await Offers.findByIdAndDelete(id);

    if (!deletedOffer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Offer deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting offer:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while deleting the offer.",
    });
  }
};

// Update an offer
exports.updateOffer = async (req, res) => {
  try {
    const { id } = req.params; // Get offer ID from URL params
    const {
      name,
      type,
      discountType,
      discountValue,
      startDate,
      endDate,
      status,
    } = req.body;

      const existingOffer = await Offers.findOne({ name });
  if (existingOffer) {
    return res.status(400).json({
      success: false,
      message: "An offer with this name already exists.",
    });
  }

    // Validate start and end dates
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: "End date must be after the start date.",
      });
    }

    const updatedOffer = await Offers.findByIdAndUpdate(
      id,
      {
        name,
        type,
        discountType,
        discountValue,
        startDate,
        endDate,
        status,
      },
      { new: true } // Ensure it returns the updated offer
    );

    if (!updatedOffer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Offer updated successfully.",
    });
  } catch (error) {
    console.error("Error updating offer:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the offer.",
    });
  }
};

// Controller function to get offer by ID
exports.getOffer = async (req, res) => {
  const offerId = req.params.id;

  try {
    // Find the offer in the database by ID
    const offer = await Offers.findById(offerId);

    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    // Return the offer data
    res.status(200).json(offer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
