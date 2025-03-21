const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const WalletHistory = require("../models/walletHistoryModel");
const PDFDocument = require("pdfkit");
const HttpStatus = require("http-status-codes");

exports.generateLedgerBook = async (req, res) => {
  try {
    console.log("Request body:", req.body);
    const { filterType, startDate, endDate, reportType } = req.body;

    // Validate inputs
    const validFilters = ["daily", "weekly", "monthly", "yearly", "custom"];
    if (!filterType || !validFilters.includes(filterType)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: "Invalid filter type",
        received: filterType,
      });
    }
    if (filterType === "custom" && (!startDate || !endDate)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: "Start and end dates required for custom filter",
      });
    }
    if (reportType !== "pdf") {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: "Only PDF report type is supported",
        received: reportType,
      });
    }

    // Set date range
    const now = new Date();
    let start, end;
    switch (filterType) {
      case "daily":
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case "weekly":
        start = new Date(now.setDate(now.getDate() - (now.getDay() || 7) + 1)); 
        start.setHours(0, 0, 0, 0);
        end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
        end.setHours(23, 59, 59, 999);
        break;
      case "monthly":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case "yearly":
        start = new Date(now.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        break;
      case "custom":
        start = new Date(startDate);
        end = new Date(endDate);
        if (isNaN(start) || isNaN(end) || start > end) {
          return res.status(HttpStatus.BAD_REQUEST).json({
            message: "Invalid date range: Start date must be before end date and dates must be valid",
          });
        }
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    // Fetch data
    const orders = await Order.find({ orderedDate: { $gte: start, $lte: end } })
      .populate("userId", "name email")
      .populate("orderedItems.productId");
    const walletHistories = await WalletHistory.find({
      "history.dateCreated": { $gte: start, $lte: end },
    }).populate("userId", "name email");
    const products = await Product.find({});

    if (!orders.length && !walletHistories.length) {
      return res.status(HttpStatus.NOT_FOUND).json({
        message: "No data available for the selected period",
      });
    }

    // Process data
    const ledgerData = processLedgerData(orders, walletHistories, products);

    // Generate PDF
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const filename = `LedgerBook_${filterType}_${Date.now()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Header
    doc.font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#ff7700")
      .text("STYLEOVA CLOTHING", { align: "center" })
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#666")
      .text("46/765 Beemapally Main Road, Trivandrum, Kerala, 695008", { align: "center" })
      .moveDown(0.5)
      .fontSize(16)
      .fillColor("#333")
      .text("Ledger Book", { align: "center" })
      .moveDown(1);

    // Period
    doc.font("Helvetica-Oblique")
      .fontSize(12)
      .fillColor("#555")
      .text(`Period: ${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`, 40)
      .text(`Date Range: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`, 40)
      .moveDown(1);

    // 1. Sales Entries
    addSectionHeader(doc, "1. Sales Entries");
    addSalesTable(doc, ledgerData.sales);

    // 2. Returns and Refunds
    addSectionHeader(doc, "2. Returns and Refunds");
    addReturnsTable(doc, ledgerData.returns);

    // 3. Bank Transactions
    addSectionHeader(doc, "3. Bank Transactions");
    addBankTransactionsTable(doc, ledgerData.bankTransactions);

    // 4. Profit and Loss Summary
    addSectionHeader(doc, "4. Profit and Loss Summary");
    addProfitLossSummary(doc, ledgerData.profitLoss);

    // 5. Cash Flow Entries
    addSectionHeader(doc, "5. Cash Flow Entries");
    addCashFlowTable(doc, ledgerData.cashFlow);

    // 6. Balance Sheet Summary
    addSectionHeader(doc, "6. Balance Sheet Summary");
    addBalanceSheetSummary(doc, ledgerData.balanceSheet);

    // Footer
    doc.font("Helvetica-Oblique")
      .fontSize(8)
      .fillColor("#777")
      .text(`Generated on: ${new Date().toLocaleString()}`, 40, doc.page.height - 60, { align: "left" })
      .text("© 2025 Styleova Clothing Ltd.", 0, doc.page.height - 60, { align: "center" });

    doc.end();
  } catch (error) {
    console.error("Ledger generation error:", error.stack);
    if (!res.headersSent) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Failed to generate ledger",
        error: error.message || "Unknown error",
      });
    } else {
      res.end();
    }
  }
};

// Process Ledger Data
function processLedgerData(orders, walletHistories, products) {
  let sales = [],
    returns = [],
    bankTransactions = [],
    cashFlow = { inflows: 0, outflows: 0 };
  let profitLoss = { revenue: 0, discounts: 0 };

  orders.forEach((order) => {
    const totalNet = (order.totalAmount || 0) - (order.couponApplied?.discount || 0);
    const entry = {
      date: order.orderedDate,
      orderId: order._id.toString().slice(-6),
      customer: order.userId?.name || order.userId?.email || "Unknown",
      payment: `${order.paymentMethod} (${order.paymentStatus})`,
      items: order.orderedItems.map((item) => `${item.pname} (x${item.quantity})`).join(", "),
      totalAmount: order.totalAmount || 0,
      discount: order.couponApplied?.discount || 0,
      netAmount: totalNet,
    };

    if (order.status === "Delivered") {
      sales.push(entry);
      profitLoss.revenue += order.totalAmount || 0;
      profitLoss.discounts += order.couponApplied?.discount || 0;
      cashFlow.inflows += totalNet;
      bankTransactions.push({
        type: "Deposit",
        amount: totalNet,
        date: order.deliveredDate || order.orderedDate,
      });
    } else if (order.status === "Returned") {
      returns.push({ ...entry, returnDate: order.updatedAt, amount: totalNet });
      cashFlow.outflows += totalNet;
    }
  });

  walletHistories.forEach((wallet) => {
    wallet.history.forEach((h) => {
      const entry = {
        type: h.type === "credit" ? "Deposit" : "Withdrawal",
        amount: h.amount || 0,
        date: h.dateCreated,
        description: `${h.reason} (Order: ${h.orderId?.toString().slice(-6) || "N/A"})`,
      };
      bankTransactions.push(entry);
      if (h.type === "credit") {
        cashFlow.inflows += h.amount || 0;
        if (h.reason.includes("Refund")) {
          returns.push({
            orderId: h.orderId?.toString().slice(-6) || "N/A",
            customer: wallet.userId?.name || wallet.userId?.email || "Unknown",
            amount: h.amount || 0,
            returnDate: h.dateCreated,
          });
        }
      } else {
        cashFlow.outflows += h.amount || 0;
        profitLoss.discounts += h.discount || 0;
      }
    });
  });

  const inventoryValue = products.reduce(
    (sum, p) => sum + (p.stock.Small + p.stock.Medium + p.stock.Large) * (p.rate || 0),
    0
  );

  console.log("Processed returns data:", returns);

  return {
    sales,
    returns,
    bankTransactions,
    profitLoss: { ...profitLoss, netProfit: profitLoss.revenue - profitLoss.discounts },
    cashFlow,
    balanceSheet: { assets: { cash: cashFlow.inflows - cashFlow.outflows, inventory: inventoryValue } },
  };
}

// Helper Functions
function addSectionHeader(doc, title) {
  if (doc.y + 40 > doc.page.height - 80) doc.addPage();
  doc.font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#ff7700")
    .text(title, 40, doc.y, { align: "left" })
    .moveDown(0.5);
}

function drawTableHeader(doc, headers, widths, y) {
  doc.rect(40, y, 515, 25)
    .fillColor("#ff7700")
    .fill()
    .strokeColor("#e65c00")
    .lineWidth(1)
    .stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#fff");
  headers.forEach((h, i) => {
    const x = 40 + widths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(h, x + 2, y + 8, { width: widths[i] - 4, align: "center" });
  });
}

function drawTableRow(doc, row, widths, y, index, height = 20) {
  doc.fillColor(index % 2 === 0 ? "#f9f2ec" : "#fff")
    .rect(40, y, 515, height)
    .fill()
    .strokeColor("#ddd")
    .lineWidth(0.5)
    .stroke();
  doc.font("Helvetica").fontSize(9).fillColor("#333");
  row.forEach((cell, i) => {
    const x = 40 + widths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(cell, x + 2, y + 6, { width: widths[i] - 4, align: "center", continued: false });
  });
}

function addSalesTable(doc, sales) {
  const headers = ["Date", "Order ID", "Customer", "Payment", "Items", "Gross", "Disc.", "Net"];
  const widths = [60, 50, 80, 65, 150, 40, 35, 35]; 
  let y = doc.y;
  drawTableHeader(doc, headers, widths, y);
  y += 25;

  sales.forEach((sale, i) => {
    const itemsText = sale.items || "N/A";
    const lines = doc.heightOfString(itemsText, { width: widths[4] - 4 }) / 9; 
    const rowHeight = Math.max(20, lines * 10); 

    if (y + rowHeight > doc.page.height - 80) {
      doc.addPage();
      y = 40;
      drawTableHeader(doc, headers, widths, y);
      y += 25;
    }
    drawTableRow(doc, [
      sale.date.toLocaleDateString(),
      sale.orderId,
      sale.customer,
      sale.payment,
      itemsText,
      `$${(sale.totalAmount || 0).toFixed(2)}`,
      `$${(sale.discount || 0).toFixed(2)}`,
      `$${(sale.netAmount || 0).toFixed(2)}`,
    ], widths, y, i, rowHeight);
    y += rowHeight;
  });
  doc.moveDown(1);
}

function addReturnsTable(doc, returns) {
  const headers = ["Order ID", "Customer", "Amount", "Return Date"];
  const widths = [80, 200, 80, 95]; // Total: 515
  let y = doc.y;
  drawTableHeader(doc, headers, widths, y);
  y += 25;

  returns.forEach((r, i) => {
    if (y + 20 > doc.page.height - 80) {
      doc.addPage();
      y = 40;
      drawTableHeader(doc, headers, widths, y);
      y += 25;
    }
    const amount = typeof r.amount === "number" ? r.amount : 0;
    drawTableRow(doc, [
      r.orderId || "N/A",
      r.customer || "Unknown",
      `$${amount.toFixed(2)}`,
      r.returnDate ? new Date(r.returnDate).toLocaleDateString() : "N/A",
    ], widths, y, i);
    y += 20;
  });
  doc.moveDown(1);
}

function addBankTransactionsTable(doc, bankTransactions) {
  const headers = ["Type", "Amount", "Date", "Description"];
  const widths = [80, 80, 95, 262]; // Total: 515
  let y = doc.y;
  drawTableHeader(doc, headers, widths, y);
  y += 25;

  bankTransactions.forEach((t, i) => {
    if (y + 20 > doc.page.height - 80) {
      doc.addPage();
      y = 40;
      drawTableHeader(doc, headers, widths, y);
      y += 25;
    }
    drawTableRow(doc, [
      t.type,
      `$${(t.amount || 0).toFixed(2)}`,
      t.date.toLocaleDateString(),
      t.description,
    ], widths, y, i);
    y += 20;
  });
  doc.moveDown(1);
}

function addProfitLossSummary(doc, profitLoss) {
  const headers = ["Description", "Amount ($)"];
  const widths = [300, 215]; // Total: 515
  let y = doc.y;
  drawTableHeader(doc, headers, widths, y);
  y += 25;

  const rows = [
    ["Revenue", `$${(profitLoss.revenue || 0).toFixed(2)}`],
    ["Total Discounts", `$${(profitLoss.discounts || 0).toFixed(2)}`],
    ["Net Profit", `$${(profitLoss.netProfit || 0).toFixed(2)}`],
  ];

  rows.forEach((row, i) => {
    if (y + 20 > doc.page.height - 80) {
      doc.addPage();
      y = 40;
      drawTableHeader(doc, headers, widths, y);
      y += 25;
    }
    drawTableRow(doc, row, widths, y, i);
    y += 20;
  });
  doc.moveDown(1);
}

function addCashFlowTable(doc, cashFlow) {
  const headers = ["Description", "Amount ($)"];
  const widths = [300, 215]; // Total: 515
  let y = doc.y;
  drawTableHeader(doc, headers, widths, y);
  y += 25;

  const rows = [
    ["Cash Inflows", `$${(cashFlow.inflows || 0).toFixed(2)}`],
    ["Cash Outflows", `$${(cashFlow.outflows || 0).toFixed(2)}`],
    ["Net Cash Flow", `$${((cashFlow.inflows || 0) - (cashFlow.outflows || 0)).toFixed(2)}`],
  ];

  rows.forEach((row, i) => {
    if (y + 20 > doc.page.height - 80) {
      doc.addPage();
      y = 40;
      drawTableHeader(doc, headers, widths, y);
      y += 25;
    }
    drawTableRow(doc, row, widths, y, i);
    y += 20;
  });
  doc.moveDown(1);
}

function addBalanceSheetSummary(doc, balanceSheet) {
  const headers = ["Description", "Amount ($)"];
  const widths = [300, 215]; // Total: 515
  let y = doc.y;
  drawTableHeader(doc, headers, widths, y);
  y += 25;

  const rows = [
    ["Cash", `$${(balanceSheet.assets.cash || 0).toFixed(2)}`],
    ["Inventory", `$${(balanceSheet.assets.inventory || 0).toFixed(2)}`],
    ["Total Assets", `$${((balanceSheet.assets.cash || 0) + (balanceSheet.assets.inventory || 0)).toFixed(2)}`],
  ];

  rows.forEach((row, i) => {
    if (y + 20 > doc.page.height - 80) {
      doc.addPage();
      y = 40;
      drawTableHeader(doc, headers, widths, y);
      y += 25;
    }
    drawTableRow(doc, row, widths, y, i);
    y += 20;
  });
  doc.moveDown(1);
}