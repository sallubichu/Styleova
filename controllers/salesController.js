const Order = require("../models/orderModel");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const HttpStatus = require("http-status-codes");

exports.getSalesReportPage = async (req, res) => {
  try {
    const filterType = req.query.filterType || "monthly";
    const startDate = req.query.startDate || "";
    const endDate = req.query.endDate || "";

    const now = new Date();
    let start, end;

    switch (filterType) {
      case "daily":
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case "weekly":
        start = startDate ? new Date(startDate) : new Date(now.setDate(now.getDate() - now.getDay()));
        end = endDate ? new Date(endDate) : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
        break;
      case "monthly":
        start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "yearly":
        start = startDate ? new Date(startDate) : new Date(now.getFullYear(), 0, 1);
        end = endDate ? new Date(endDate) : new Date(now.getFullYear(), 11, 31);
        break;
      case "custom":
        start = startDate ? new Date(startDate) : new Date(now.setHours(0, 0, 0, 0));
        end = endDate ? new Date(endDate) : new Date(now.setHours(23, 59, 59, 999));
        break;
      default:
        throw new Error("Invalid filter type");
    }

    const orders = await Order.find({
      status: "Delivered",
      orderedDate: { $gte: start, $lte: end },
    })
      .populate("orderedItems.productId")
      .populate("userId", "email")
      .populate("shippingAddress")
      .sort({ orderedDate: -1 });

    const salesData = processOrders(orders, filterType, start, end);

    res.render("admin/salesReport", {
      overallSales: salesData.overallSales,
      overallAmount: salesData.overallAmount,
      overallCouponDiscount: salesData.overallCouponDiscount,
      overallTotalDiscount: salesData.overallCouponDiscount,
      periodData: salesData.periodData,
      filterType,
      startDate,
      endDate,
      error: null,
      token: req.session?.token || "",
    });
  } catch (error) {
    console.error("Error loading sales report page:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render("admin/salesReport", {
      overallSales: 0,
      overallAmount: 0,
      overallCouponDiscount: 0,
      overallTotalDiscount: 0,
      periodData: [],
      filterType: "monthly",
      startDate: "",
      endDate: "",
      error: "Failed to load sales report. Please try again later.",
      token: req.session?.token || "",
    });
  }
};

exports.generateSalesReport = async (req, res) => {
  try {
    const { filterType, reportType, startDate, endDate } = req.body;

    const validFilters = ["daily", "weekly", "monthly", "yearly", "custom"];
    const validReportTypes = ["json", "pdf", "excel"];
    if (!validFilters.includes(filterType)) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid filter type" });
    }
    if (!validReportTypes.includes(reportType)) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid report type" });
    }
    if (filterType === "custom" && (!startDate || !endDate)) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Start and end dates are required for custom filter" });
    }

    let ordersQuery = { status: "Delivered" };
    const now = new Date();
    let start, end;

    switch (filterType) {
      case "daily":
        start = startDate ? new Date(startDate) : new Date(now.setHours(0, 0, 0, 0));
        end = endDate ? new Date(endDate) : new Date(now.setHours(23, 59, 59, 999));
        break;
      case "weekly":
        start = startDate ? new Date(startDate) : new Date(now.setDate(now.getDate() - now.getDay()));
        end = endDate ? new Date(endDate) : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
        break;
      case "monthly":
        start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "yearly":
        start = startDate ? new Date(startDate) : new Date(now.getFullYear(), 0, 1);
        end = endDate ? new Date(endDate) : new Date(now.getFullYear(), 11, 31);
        break;
      case "custom":
        start = new Date(startDate);
        end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
          return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid custom date range" });
        }
        break;
    }

    ordersQuery.orderedDate = { $gte: start, $lte: end };
    const orders = await Order.find(ordersQuery)
      .populate("orderedItems.productId")
      .populate("userId", "email")
      .populate("shippingAddress")
      .sort({ orderedDate: -1 });
    const salesData = processOrders(orders, filterType, start, end);

    if (!orders.length && reportType !== "json") {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "No sales data available for this period" });
    }

    switch (reportType) {
      case "pdf":
        generatePDFReport(res, salesData, filterType, startDate, endDate);
        break;
      case "excel":
        await generateExcelReport(res, salesData, filterType, startDate, endDate);
        break;
      case "json":
        res.status(HttpStatus.OK).json({
          overallSales: salesData.overallSales,
          overallAmount: salesData.overallAmount,
          overallCouponDiscount: salesData.overallCouponDiscount,
          overallTotalDiscount: salesData.overallCouponDiscount,
          periodData: salesData.periodData,
        });
        break;
    }
  } catch (error) {
    console.error("Error generating sales report:", error);
    if (!res.headersSent) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal server error", error: error.message });
    }
  }
};

function processOrders(orders, filterType, startDate, endDate) {
  let overallSales = orders.length;
  let overallAmount = 0;
  let overallCouponDiscount = 0;
  let periodData = [];

  orders.forEach((order) => {
    overallAmount += order.totalAmount || 0;
    overallCouponDiscount += order.couponApplied?.discount || 0;
  });

  const groupByPeriod = (order) => {
    const date = new Date(order.orderedDate);
    switch (filterType) {
      case "daily":
        return date.toISOString().split("T")[0];
      case "weekly":
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.toISOString().split("T")[0]} - ${new Date(weekStart.getTime() + 6 * 86400000).toISOString().split("T")[0]}`;
      case "monthly":
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      case "yearly":
        return date.getFullYear().toString();
      case "custom":
        const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        if (diffDays <= 31) return date.toISOString().split("T")[0];
        else if (diffDays <= 365) return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        else return date.getFullYear().toString();
    }
  };

  const periodMap = new Map();
  orders.forEach((order) => {
    const period = groupByPeriod(order);
    if (!periodMap.has(period)) {
      periodMap.set(period, {
        sales: 0,
        amount: 0,
        couponDiscount: 0,
        orders: [],
      });
    }
    const data = periodMap.get(period);
    data.sales += 1;
    data.amount += order.totalAmount || 0;
    data.couponDiscount += order.couponApplied?.discount || 0;
    data.orders.push({
      orderId: order._id,
      date: order.orderedDate,
      customerEmail: order.userId?.email || "Unknown",
      shippingAddress: order.shippingAddress
        ? `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.zip}`
        : "Not provided",
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      amount: order.totalAmount,
      couponDiscount: order.couponApplied?.discount || 0,
      items: order.orderedItems.map((item) => ({
        name: item.productId?.name || "Unknown Product",
        description: item.productId?.description || "No description",
        category: item.productId?.category?.toString() || "Uncategorized",
        quantity: item.quantity,
        price: item.price,
        size: item.size,
      })),
    });
  });

  periodData = Array.from(periodMap.entries())
    .map(([period, data]) => ({
      period,
      sales: data.sales,
      amount: data.amount.toFixed(2),
      couponDiscount: data.couponDiscount.toFixed(2),
      totalDiscount: data.couponDiscount.toFixed(2),
      totalAmount: (data.amount - data.couponDiscount).toFixed(2),
      orders: data.orders,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return { overallSales, overallAmount, overallCouponDiscount, periodData };
}

function generatePDFReport(res, salesData, filterType, startDate, endDate) {
  try {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const filename = `SalesReport_${filterType}_${Date.now()}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    // Header Section
    doc.font("Helvetica-Bold")
       .fontSize(22)
       .fillColor("#007bff")
       .text("STYLEOVA CLOTHING", { align: "center" })
       .font("Helvetica")
       .fontSize(10)
       .fillColor("#666")
       .text("46/765 Beemapally Main Road, Trivandrum, Kerala, 695008", { align: "center" })
       .moveDown(0.5)
       .fontSize(16)
       .fillColor("#333")
       .text("Detailed Sales Report", { align: "center" })
       .moveDown(1.5);

    // Sales Summary Section
    doc.font("Helvetica-Bold")
       .fontSize(14)
       .fillColor("#007bff")
       .text(`Sales Summary (${filterType.charAt(0).toUpperCase() + filterType.slice(1)})`, 40)
       .moveDown(0.5);

    doc.font("Helvetica")
       .fontSize(11)
       .fillColor("#333")
       .text(`Total Orders: ${salesData.overallSales}`, 50)
       .moveDown(0.3)
       .text(`Gross Revenue: $${salesData.overallAmount.toFixed(2)}`, 50)
       .moveDown(0.3)
       .text(`Coupon Discounts Applied: $${salesData.overallCouponDiscount.toFixed(2)}`, 50)
       .moveDown(0.3)
       .text(`Net Revenue After Discounts: $${(salesData.overallAmount - salesData.overallCouponDiscount).toFixed(2)}`, 50);

    if (filterType === "custom" || (startDate && endDate)) {
      doc.moveDown(0.3)
         .font("Helvetica-Oblique")
         .text(`Date Range: ${startDate} to ${endDate}`, 50);
    }
    doc.moveDown(2);

    // Order Details Section
    doc.font("Helvetica-Bold")
       .fontSize(14)
       .fillColor("#007bff")
       .text("Order Details", 40)
       .moveDown(0.5);

    // Orders Table Setup
    const orderHeaders = [
      "Order ID",
      "Date",
      "Customer",
      "Payment Method",
      "Product",
      "Qty",
      "Amount ($)",
      "Cpn. Disc. ($)",
      "Net Amt. ($)"
    ];
    const orderWidths = [50, 70, 90, 70, 80, 30, 50, 50, 50]; // Total width = 490, fits within 515 usable width
    const orderTableWidth = orderWidths.reduce((sum, w) => sum + w, 0);
    let tableY = doc.y;

    if (tableY + 40 > doc.page.height - 80) {
      doc.addPage();
      tableY = 40;
    }

    // Table Header (White text on blue background)
    doc.rect(40, tableY, orderTableWidth, 25)
       .fillColor("#007bff")
       .fill()
       .strokeColor("#0056b3")
       .lineWidth(1)
       .stroke();

    doc.font("Helvetica-Bold")
       .fontSize(8) // Slightly smaller font to fit text
       .fillColor("#ffffff");
    orderHeaders.forEach((header, i) => {
      const xPos = 40 + orderWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(header, xPos + 2, tableY + 8, { width: orderWidths[i] - 4, align: "center" });
    });
    tableY += 25;

    // Flatten periodData orders into a single array
    const allOrders = salesData.periodData.flatMap(period => period.orders);

    // Check if orders exist, if not, add a message
    if (!allOrders || allOrders.length === 0) {
      doc.font("Helvetica")
         .fontSize(10)
         .fillColor("#333")
         .text("No orders available for this period.", 40, tableY);
    } else {
      // Table Rows
      allOrders.forEach((order, orderIndex) => {
        if (tableY + 20 > doc.page.height - 80) {
          doc.addPage();
          tableY = 40;
          // Repeat Table Header on new page
          doc.rect(40, tableY, orderTableWidth, 25)
             .fillColor("#007bff")
             .fill()
             .strokeColor("#0056b3")
             .stroke();

          doc.font("Helvetica-Bold")
             .fontSize(8)
             .fillColor("#ffffff");
          orderHeaders.forEach((header, i) => {
            const xPos = 40 + orderWidths.slice(0, i).reduce((a, b) => a + b, 0);
            doc.text(header, xPos + 2, tableY + 8, { width: orderWidths[i] - 4, align: "center" });
          });
          tableY += 25;
        }

        // Draw row background
        doc.fillColor(orderIndex % 2 === 0 ? "#f0f6ff" : "#ffffff")
           .rect(40, tableY, orderTableWidth, 20)
           .fill()
           .strokeColor("#d3d3d3")
           .lineWidth(1)
           .stroke();

        // Summarize products and quantities
        const productSummary = order.items && order.items.length > 0
          ? order.items.map(item => item.name).join(", ")
          : "N/A";
        const quantitySummary = order.items && order.items.length > 0
          ? order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
          : 0;

        // Row data
        const row = [
          order.orderId ? order.orderId.toString().slice(-6) : "N/A",
          order.date ? new Date(order.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A",
          order.customerEmail ? (order.customerEmail.length > 18 ? order.customerEmail.slice(0, 15) + "..." : order.customerEmail) : "N/A",
          order.paymentMethod && order.paymentStatus ? `${order.paymentMethod} (${order.paymentStatus})` : "N/A",
          productSummary.length > 12 ? productSummary.slice(0, 9) + "..." : productSummary, // Adjusted truncation
          quantitySummary.toString(),
          order.amount !== undefined ? `$${order.amount.toFixed(2)}` : "$0.00",
          order.couponDiscount !== undefined ? `$${order.couponDiscount.toFixed(2)}` : "$0.00",
          order.amount !== undefined && order.couponDiscount !== undefined ? `$${(order.amount - order.couponDiscount).toFixed(2)}` : "$0.00",
        ];

        // Render row text
        doc.font("Helvetica")
           .fontSize(8) // Smaller font to prevent overflow
           .fillColor("#333");
        row.forEach((cell, i) => {
          const xPos = 40 + orderWidths.slice(0, i).reduce((a, b) => a + b, 0);
          doc.text(cell, xPos + 2, tableY + 6, { width: orderWidths[i] - 4, align: "center" });
        });
        tableY += 20;
      });
    }

    // Footer Section
    if (doc.y > doc.page.height - 70) doc.addPage();
    doc.font("Helvetica-Oblique")
       .fontSize(8)
       .fillColor("#777")
       .text(`Report Generated on: ${new Date().toLocaleString()}`, 40, doc.page.height - 60)
       .text("© 2025 Styleova Clothing Ltd. All Rights Reserved.", { align: "center" });

    doc.end();
  } catch (error) {
    console.error("PDF generation error:", error);
    if (!res.headersSent) res.status(500).json({ message: "PDF generation failed" });
  }
}

async function generateExcelReport(res, salesData, filterType, startDate, endDate) {
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");
    const filename = `SalesReport_${filterType}_${Date.now()}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Header Section
    worksheet.mergeCells("A1:I1"); // Adjusted to 9 columns
    worksheet.getCell("A1").value = "STYLEOVA CLOTHING";
    worksheet.getCell("A1").font = { size: 16, bold: true, color: { argb: "007bff" } };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.mergeCells("A2:I2");
    worksheet.getCell("A2").value = "46/765 Beemapally Main Road, Trivandrum, Kerala, 695008";
    worksheet.getCell("A2").font = { size: 10, color: { argb: "666666" } };
    worksheet.getCell("A2").alignment = { horizontal: "center" };

    worksheet.mergeCells("A3:I3");
    worksheet.getCell("A3").value = "Detailed Sales Report";
    worksheet.getCell("A3").font = { size: 14, bold: true, color: { argb: "333333" } };
    worksheet.getCell("A3").alignment = { horizontal: "center" };

    // Sales Summary Section
    worksheet.addRow([]);
    worksheet.addRow([`Sales Summary (${filterType.charAt(0).toUpperCase() + filterType.slice(1)})`]).font = {
      size: 12,
      bold: true,
      color: { argb: "007bff" }
    };
    worksheet.mergeCells(`A${worksheet.rowCount}:I${worksheet.rowCount}`);

    worksheet.addRow([]);
    worksheet.addRow(["Total Orders", salesData.overallSales]);
    worksheet.addRow(["Gross Revenue ($)", salesData.overallAmount.toFixed(2)]);
    worksheet.addRow(["Coupon Discounts Applied ($)", salesData.overallCouponDiscount.toFixed(2)]);
    worksheet.addRow(["Net Revenue After Discounts ($)", (salesData.overallAmount - salesData.overallCouponDiscount).toFixed(2)]);
    
    if (filterType === "custom" || (startDate && endDate)) {
      worksheet.addRow(["Date Range", `${startDate} to ${endDate}`]).font = { italic: true };
      worksheet.mergeCells(`B${worksheet.rowCount}:I${worksheet.rowCount}`);
    }
    worksheet.addRow([]);

    // Order Details Section
    worksheet.addRow(["Order Details"]).font = { size: 12, bold: true, color: { argb: "007bff" } };
    worksheet.mergeCells(`A${worksheet.rowCount}:I${worksheet.rowCount}`);
    worksheet.addRow([]);

    // Table Header
    const orderHeaders = [
      "Order ID",
      "Date",
      "Customer",
      "Payment Method",
      "Product",
      "Qty",
      "Amount ($)",
      "Cpn. Disc. ($)",
      "Net Amt. ($)"
    ];
    const headerRow = worksheet.addRow(orderHeaders);
    headerRow.font = { bold: true, color: { argb: "FFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "007bff" } };
    headerRow.height = 25;

    // Flatten periodData orders into a single array (like PDF)
    const allOrders = salesData.periodData.flatMap(period => period.orders);

    // Table Rows
    if (!allOrders || allOrders.length === 0) {
      worksheet.addRow(["No orders available for this period."]).font = { color: { argb: "333333" } };
      worksheet.mergeCells(`A${worksheet.rowCount}:I${worksheet.rowCount}`);
    } else {
      allOrders.forEach((order) => {
        // Summarize products and quantities
        const productSummary = order.items && order.items.length > 0
          ? order.items.map(item => item.name).join(", ")
          : "N/A";
        const quantitySummary = order.items && order.items.length > 0
          ? order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)
          : 0;

        const row = worksheet.addRow([
          order.orderId ? order.orderId.toString() : "N/A",
          order.date ? new Date(order.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A",
          order.customerEmail || "N/A",
          order.paymentMethod && order.paymentStatus ? `${order.paymentMethod} (${order.paymentStatus})` : "N/A",
          productSummary,
          quantitySummary,
          order.amount !== undefined ? order.amount.toFixed(2) : "0.00",
          order.couponDiscount !== undefined ? order.couponDiscount.toFixed(2) : "0.00",
          order.amount !== undefined && order.couponDiscount !== undefined ? (order.amount - order.couponDiscount).toFixed(2) : "0.00",
        ]);
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: order.rowNumber % 2 === 0 ? "F0F6FF" : "FFFFFF" } };
        row.height = 20;
      });
    }

    // Column Widths (adjusted to match PDF proportions)
    worksheet.columns = [
      { width: 15 }, // Order ID
      { width: 20 }, // Date
      { width: 25 }, // Customer
      { width: 20 }, // Payment Method
      { width: 25 }, // Product
      { width: 10 }, // Qty
      { width: 15 }, // Amount ($)
      { width: 15 }, // Cpn. Disc. ($)
      { width: 15 }, // Net Amt. ($)
    ];

    // Footer
    worksheet.addRow([]);
    worksheet.addRow([`Report Generated on: ${new Date().toLocaleString()}`]).font = { size: 8, italic: true, color: { argb: "777777" } };
    worksheet.mergeCells(`A${worksheet.rowCount}:I${worksheet.rowCount}`);
    worksheet.addRow(["© 2025 Styleova Clothing Ltd. All Rights Reserved."]).font = { size: 8, italic: true, color: { argb: "777777" } };
    worksheet.mergeCells(`A${worksheet.rowCount}:I${worksheet.rowCount}`);
    worksheet.getCell(`A${worksheet.rowCount}`).alignment = { horizontal: "center" };

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Excel generation error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Excel generation failed" });
  }
}

exports.getChartData = async (req, res) => {
  try {
    const filterType = req.query.filter || "monthly";
    const customStartDate = req.query.startDate;
    const customEndDate = req.query.endDate;
    const granularity = req.query.granularity || filterType; // Default to filter type if not provided
    const now = new Date();
    let start, end, periodFormat;

    // Get earliest order date for non-custom filters
    const earliestOrder = await Order.findOne({ status: "Delivered" }).sort({ orderedDate: 1 });
    const earliestDate = earliestOrder ? earliestOrder.orderedDate : new Date();

    if (filterType === "custom" && customStartDate && customEndDate) {
      // Custom range
      start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
    } else {
      // Predefined filters
      switch (filterType) {
        case "daily":
          start = new Date(earliestDate);
          start.setHours(0, 0, 0, 0);
          end = new Date(now.setHours(23, 59, 59, 999));
          break;
        case "weekly":
          start = new Date(earliestDate);
          start.setHours(0, 0, 0, 0);
          end = new Date(now.setHours(23, 59, 59, 999));
          break;
        case "monthly":
          start = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case "yearly":
          start = new Date(earliestDate.getFullYear(), 0, 1);
          end = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          return res.status(400).json({ message: "Invalid filter type" });
      }
    }

    // Set period format based on granularity
    switch (granularity) {
      case "daily":
        periodFormat = "%Y-%m-%d";
        break;
      case "weekly":
        periodFormat = "%Y-%U";
        break;
      case "monthly":
        periodFormat = "%Y-%m";
        break;
      case "yearly":
        periodFormat = "%Y";
        break;
      default:
        return res.status(400).json({ message: "Invalid granularity" });
    }

    // Validate custom dates
    if (filterType === "custom" && start > end) {
      return res.status(400).json({ message: "Start date must be before end date" });
    }

    // Fetch orders
    const orders = await Order.find({
      status: "Delivered",
      orderedDate: { $gte: start, $lte: end },
    }).populate("orderedItems.productId");

    // Aggregate sales data
    const salesAgg = await Order.aggregate([
      { $match: { status: "Delivered", orderedDate: { $gte: start, $lte: end } } },
      { $unwind: "$orderedItems" },
      {
        $group: {
          _id: { $dateToString: { format: periodFormat, date: "$orderedDate" } },
          totalSales: { $sum: "$orderedItems.price" },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    // Aggregate stock data
    const stockAgg = await Order.aggregate([
      { $match: { status: "Delivered", orderedDate: { $gte: start, $lte: end } } },
      { $unwind: "$orderedItems" },
      {
        $group: {
          _id: { $dateToString: { format: periodFormat, date: "$orderedDate" } },
          totalStockSold: { $sum: "$orderedItems.quantity" },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    // Generate all periods in the range
    const periods = generatePeriods(start, end, granularity);
    const salesData = periods.map(period => {
      const sale = salesAgg.find(s => s._id === period) || { totalSales: 0 };
      return sale.totalSales;
    });
    const stockData = periods.map(period => {
      const stock = stockAgg.find(s => s._id === period) || { totalStockSold: 0 };
      return stock.totalStockSold;
    });

    // Debug logging
    console.log(`Filter: ${filterType}`);
    console.log(`Granularity: ${granularity}`);
    console.log("Start Date:", start);
    console.log("End Date:", end);
    console.log("Periods:", periods);
    console.log("Sales Agg:", salesAgg);
    console.log("Sales Data:", salesData);

    // Top Products
const topProductsAgg = await Order.aggregate([
  // Match delivered orders within the date range
  { $match: { status: "Delivered", orderedDate: { $gte: start, $lte: end } } },

  // Unwind the orderedItems array
  { $unwind: "$orderedItems" },

  // Group by productId, calculate total sales and quantity
  {
    $group: {
      _id: "$orderedItems.productId",
      totalSales: { 
        $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } // Corrected to price * quantity
      },
      totalQuantity: { $sum: "$orderedItems.quantity" },
    },
  },

  // Lookup product details from the products collection
  { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },

  // Unwind product array, preserving null/empty results
  { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },

  // Sort by totalSales (descending), then totalQuantity (descending) for tie-breaking
  { $sort: { totalSales: -1, totalQuantity: -1 } },

  // Limit to top 10 products
  { $limit: 10 },

  // Project the desired fields with a fallback for missing images
  {
    $project: {
      name: { $ifNull: ["$product.name", "Unknown Product"] }, // Fallback for missing product name
      totalSales: 1,
      totalQuantity: 1,
      image: { 
        $ifNull: [{ $arrayElemAt: ["$product.images", 0] }, "default-image-url"] // Fallback for missing images
      },
    },
  },
]);

    // Top Categories
    const topCategoriesAgg = await Order.aggregate([
      { $match: { status: "Delivered", orderedDate: { $gte: start, $lte: end } } },
      { $unwind: "$orderedItems" },
      { $lookup: { from: "products", localField: "orderedItems.productId", foreignField: "_id", as: "product" } },
      { $unwind: "$product" },
      { $group: { _id: "$product.category", totalSales: { $sum: "$orderedItems.price" } } },
      { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
      { $unwind: "$category" },
      { $sort: { totalSales: -1 } },
      { $limit: 5 },
      { $project: { name: "$category.name", totalSales: 1 } },
    ]);

    const chartData = {
      salesOverTime: {
        labels: periods,
        salesData: salesData,
        stockData: stockData,
      },
      topProducts: topProductsAgg,
      topCategories: topCategoriesAgg,
    };

    res.status(200).json(chartData);
  } catch (error) {
    console.error("Error fetching chart data:", error);
    res.status(500).json({ message: "Failed to fetch chart data" });
  }
};

// Helper function to generate all periods
function generatePeriods(start, end, granularity) {
  const periods = [];
  let current = new Date(start);

  while (current <= end) {
    let period;
    switch (granularity) {
      case "daily":
        period = current.toISOString().split("T")[0]; // YYYY-MM-DD
        current.setDate(current.getDate() + 1);
        break;
      case "weekly":
        const year = current.getFullYear();
        const week = getISOWeek(current);
        period = `${year}-${String(week).padStart(2, "0")}`;
        current.setDate(current.getDate() + 7);
        break;
      case "monthly":
        period = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
        current.setMonth(current.getMonth() + 1);
        break;
      case "yearly":
        period = current.getFullYear().toString();
        current.setFullYear(current.getFullYear() + 1);
        break;
    }
    periods.push(period);
  }
  return periods;
}

// Helper function to calculate ISO week number
function getISOWeek(date) {
  const target = new Date(date);
  const dayNum = (date.getDay() + 6) % 7; // Monday as 0
  target.setDate(target.getDate() - dayNum + 3); // Nearest Thursday
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.ceil((diff / oneDay + 4) / 7);
}
module.exports = exports;