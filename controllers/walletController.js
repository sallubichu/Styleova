const WalletHistory = require("../models/wallethistoryModel"); 
const Order = require("../models/orderModel"); 
const User = require("../models/userModel"); 

// Get all transactions for the list view with pagination
exports.getTransactionList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch transactions with user data
    const transactionsAggregate = await WalletHistory.aggregate([
      { $unwind: "$history" }, 
      {
        $lookup: {
          from: "users", 
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" }, 
      {
        $project: {
          transactionId: "$history._id",
          date: "$history.dateCreated",
          user: "$user.name",
          type: "$history.type",
          amount: "$history.amount",
        },
      },
      { $sort: { date: -1 } }, 
      { $skip: skip },
      { $limit: limit },
    ]);

    // Calculate total number of transactions for pagination
    const totalTransactions = await WalletHistory.aggregate([
      { $unwind: "$history" },
      { $count: "total" },
    ]);

    const total = totalTransactions.length > 0 ? totalTransactions[0].total : 0;
    const totalPages = Math.ceil(total / limit);

    const pagination = {
      currentPage: page,
      totalPages: totalPages,
      limit: limit,
    };

    console.log("Transactions Aggregate:", transactionsAggregate);
    console.log("Total Transactions:", total);
    console.log("Pagination:", pagination);

    // Render the transaction list view
    res.render("admin/walletManagement", {
      transactions: transactionsAggregate,
      pagination,
    });
  } catch (error) {
    console.error("Error in getTransactionList:", error);
    res.status(500).send("Server Error");
  }
};

// Get details for a specific transaction
exports.getTransactionDetails = async (req, res) => {
  try {
    const transactionId = req.params.transactionId;

    // Find the wallet history document containing the transaction
    const wallet = await WalletHistory.findOne({
      "history._id": transactionId,
    }).populate("userId");

    if (!wallet) {
      return res.status(404).send("Transaction not found");
    }

    // Extract the specific transaction from the history array
    const transaction = wallet.history.id(transactionId);
    if (!transaction) {
      return res.status(404).send("Transaction not found");
    }

    // Fetch order details if an orderId exists
    let order = null;
    if (transaction.orderId) {
      order = await Order.findById(transaction.orderId);
    }

    // Prepare data for the view
    const transactionData = {
      user: {
        username: wallet.userId.name || "Unknown", 
        email: wallet.userId.email || "N/A",
      },
      transactionId: transaction._id,
      date: transaction.dateCreated,
      type: transaction.type,
      amount: transaction.amount,
      reason: transaction.reason || "N/A",
      orderId: transaction.orderId || null,
      orderStatus: order ? order.status : null,
    };

console.log("Transaction Data:", transactionData);


    // Render the transaction detail view
    res.render("admin/walletShow", { transaction: transactionData });
  } catch (error) {
    console.error("Error in getTransactionDetails:", error);
    res.status(500).send("Server Error");
  }
};

module.exports = exports;