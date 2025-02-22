const Order = require("../models/orderModel");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

exports.generateSalesReport = async (req, res) => {
  console.log("Request body:", req.body);

  try {
    console.log("generate sales triggered");
    const { filterType, reportType } = req.body; // Ensure reportType is included
    console.log("Filter type:", filterType, "Report type:", reportType);

    // Validate filterType before processing
    const validFilters = ["daily", "weekly", "monthly", "yearly", "custom"];
    if (!validFilters.includes(filterType)) {
      return res.status(400).json({ message: "Invalid filter type" });
    }

    // Fetch all delivered orders
    const orders = await Order.find({ status: "Delivered" });
    console.log("Fetched orders:", orders.length);

    if (!orders.length) {
      return res.status(404).json({ message: "No sales data available" });
    }

    let overallSales = orders.length;
    let overallAmount = 0;
    let overallDiscount = 0;
    const groupedSales = {};

    orders.forEach((order) => {
      const orderDate = new Date(order.orderedDate);
      let dateKey;
      switch (filterType) {
        case "daily":
          dateKey = orderDate.toISOString().split("T")[0]; // Format: YYYY-MM-DD
          break;

        case "weekly":
          const weekStart = new Date(orderDate);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Get the start of the week (Sunday)
          dateKey = `Week of ${weekStart.toISOString().split("T")[0]}`; // Format: "Week of YYYY-MM-DD"
          break;

        case "monthly":
          dateKey = `${orderDate.toLocaleString("en-US", {
            month: "long",
          })} ${orderDate.getFullYear()}`; // Format: "Month YYYY"
          break;

        case "yearly":
          dateKey = `Year ${orderDate.getFullYear()}`; // Format: "Year YYYY"
          break;

        case "custom":
          if (!req.body.startDate || !req.body.endDate) {
            return res.status(400).json({
              message: "Start and End dates are required for custom filter",
            });
          }
          dateKey = `From ${req.body.startDate} to ${req.body.endDate}`; // Format: "From YYYY-MM-DD to YYYY-MM-DD"
          break;

        default:
          return res.status(400).json({ message: "Invalid filter type" });
      }

      if (!groupedSales[dateKey]) {
        groupedSales[dateKey] = {
          totalSales: 0,
          totalAmount: 0,
          totalDiscount: 0,
        };
      }

      groupedSales[dateKey].totalSales += 1;
      groupedSales[dateKey].totalAmount += order.totalAmount;
      groupedSales[dateKey].totalDiscount += order.couponApplied?.discount || 0;

      overallAmount += order.totalAmount;
      overallDiscount += order.couponApplied?.discount || 0;
    });

    const salesData = Object.keys(groupedSales).map((key) => ({
      period: key,
      totalSales: groupedSales[key].totalSales,
      totalAmount: groupedSales[key].totalAmount,
      totalDiscount: groupedSales[key].totalDiscount,
    }));

    console.log("Sales data to be sent:", salesData);

    // Handle different report types
    if (reportType === "pdf") {
      return generatePDFReport(
        res,
        salesData,
        overallSales,
        overallAmount,
        overallDiscount,
        filterType
      );
    }

    if (reportType === "excel") {
      return generateExcelReport(
        res,
        salesData,
        overallSales,
        overallAmount,
        overallDiscount,
        filterType
      );
    }

    // Send JSON response for "view" report type
    return res.json({
      overallSales,
      overallAmount,
      overallDiscount,
      salesData,
    });
  } catch (error) {
    console.error("Error generating sales report:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
};
function generatePDFReport(
  res,
  salesData,
  overallSales,
  overallAmount,
  overallDiscount,
  filterType
) {
  const doc = new PDFDocument({ margin: 50 });
  const filename = `SalesReport_${Date.now()}.pdf`;

  // Set response headers for PDF download
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  // Pipe the PDF document to the response
  doc.pipe(res);

  // =================== HEADER ===================
  doc
    .fontSize(24)
    .font("Helvetica-Bold")
    .fillColor("#007bff")
    .text("STYLEOVA CLOTHING", { align: "center" })
    .moveDown(0.5);

  doc
    .fontSize(12)
    .font("Helvetica")
    .fillColor("#555")
    .text("46/765 Beemapally Main Road, Trivandrum, Kerala, 695008", {
      align: "center",
    })
    .moveDown(1);

  // =================== REPORT TITLE ===================
  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .fillColor("#000")
    .text("Sales Report", { align: "center" })
    .moveDown(1);

  // =================== FILTERED REPORT BOX ===================
  const boxX = 50,
    boxY = doc.y,
    boxWidth = 500,
    boxHeight = 80;

  doc.rect(boxX, boxY, boxWidth, boxHeight).stroke("#007bff");

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor("#007bff")
    .text(`${filterType} report`, boxX + 10, boxY + 10)
    .moveDown(0.5);

  doc
    .fontSize(12)
    .font("Helvetica")
    .fillColor("#333")
    .text(`Total Sales: ${overallSales}`, boxX + 10, doc.y)
    .text(`Total Amount: $ ${overallAmount.toFixed(2)}`, boxX + 10, doc.y)
    .text(`Total Discount: $ ${overallDiscount.toFixed(2)}`, boxX + 10, doc.y)
    .moveDown(2);

  // =================== SALES DATA TABLE ===================
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor("#007bff")
    .text("Sales Data", { align: "center" })
    .moveDown(1);

  const headers = ["Period", "Total Sales", "Total Amount", "Total Discount"];
  const columnWidths = [150, 100, 120, 120];
  let startX = 50;
  let startY = doc.y;

  // Table Headers
  doc.fontSize(12).font("Helvetica-Bold").fillColor("#fff");
  doc.rect(startX, startY, 500, 25).fill("#007bff");
  headers.forEach((header, i) => {
    doc
      .fillColor("#fff")
      .text(
        header,
        startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0) + 10,
        startY + 7
      );
  });

  doc.moveDown(1);
  startY += 25;

  // Table Rows
  doc.fontSize(10).font("Helvetica").fillColor("#333");
  salesData.forEach((sale, index) => {
    const rowY = startY + index * 25;
    const bgColor = index % 2 === 0 ? "#f8f9fa" : "#ffffff";

    doc.rect(startX, rowY, 500, 25).fill(bgColor);
    const row = [
      sale.period,
      sale.totalSales.toString(),
      `$ ${sale.totalAmount.toFixed(2)}`,
      `$ ${sale.totalDiscount.toFixed(2)}`,
    ];
    row.forEach((cell, i) => {
      doc
        .fillColor("#333")
        .text(
          cell,
          startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0) + 10,
          rowY + 7
        );
    });
  });

  // Move down after the table
  doc.moveDown(5);

  // =================== COMPANY SEAL (Centered Above Footer) ===================
  const pageWidth = doc.page.width;
  const sealX = pageWidth / 2 - 40; // Centered horizontally
  const sealY = doc.y + 10; // Positioned above the footer

  doc
    .circle(sealX + 40, sealY + 30, 50)
    .lineWidth(2)
    .stroke("#007bff"); // Centered
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor("#007bff")
    .text("STYLEOVA CLOTHING LTD.", sealX, sealY + 15, {
      width: 80,
      align: "center",
    });
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor("#007bff")
    .text("✓", sealX + 35, sealY + 40, { width: 10, align: "center" });

  // =================== FOOTER (Centered Under Seal) ===================
  doc.moveDown(6);
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor("#555")
    .text("© 2025 Styleova Clothing Ltd. All rights reserved.", {
      align: "center",
    });

  // Finalize the PDF
  doc.end();
}

// Excel Generation Function

async function generateExcelReport(
  res,
  salesData,
  overallSales,
  overallAmount,
  overallDiscount,
  filterType
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sales Report");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `SalesReport_${timestamp}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  // =================== HEADER ===================
  const headerRow = worksheet.addRow(["STYLEOVA CLOTHING"]);
  headerRow.font = { bold: true, size: 16, color: { argb: "007bff" } };
  worksheet.mergeCells("A1:D1");
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  worksheet.addRow([""]);
  const addressRow = worksheet.addRow([
    "46/765 Beemapally Main Road, Trivandrum, Kerala, 695008",
  ]);
  worksheet.mergeCells("A3:D3");
  addressRow.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.addRow([""]);

  // =================== REPORT TITLE ===================
  const reportTitle = worksheet.addRow(["Sales Report"]);
  reportTitle.font = { bold: true, size: 14 };
  worksheet.mergeCells("A5:D5");
  reportTitle.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.addRow([""]);

  // =================== FILTERED REPORT BOX ===================
  worksheet.addRow([filterType, "Report"]).font = { bold: true };
  const summaryRow1 = worksheet.addRow([
    "Total Sales",
    "Total Amount (₹)",
    "Total Discount (₹)",
  ]);
  const summaryRow2 = worksheet.addRow([
    overallSales,
    `₹${overallAmount.toFixed(2)}`,
    `₹${overallDiscount.toFixed(2)}`,
  ]);

  // ✅ Apply Borders to Summary Box (Fixed)
  [summaryRow1, summaryRow2].forEach((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  });

  worksheet.addRow([""]);

  // =================== SALES DATA TABLE ===================
  const headerCells = [
    "Period",
    "Total Sales",
    "Total Amount (₹)",
    "Total Discount (₹)",
  ];
  const salesHeader = worksheet.addRow(headerCells);

  salesHeader.font = { bold: true, color: { argb: "FFFFFF" } };
  salesHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "007bff" },
  };

  salesData.forEach((sale) => {
    worksheet.addRow([
      sale.period,
      sale.totalSales,
      `₹${sale.totalAmount.toFixed(2)}`,
      `₹${sale.totalDiscount.toFixed(2)}`,
    ]);
  });

  worksheet.columns = [
    { width: 20 },
    { width: 15 },
    { width: 20 },
    { width: 20 },
  ];

  worksheet.addRow([""]);

  // =================== FOOTER ===================
  const footerRow = worksheet.addRow([
    "© 2025 Styleova Clothing Ltd. All rights reserved.",
  ]);
  footerRow.font = { italic: true, color: { argb: "555555" } };
  worksheet.mergeCells(`A${worksheet.rowCount}:D${worksheet.rowCount}`);
  footerRow.alignment = { horizontal: "center", vertical: "middle" };

  await workbook.xlsx.write(res);
  res.end();
}

// ============ CONTROLLER FOR SALES REPORT PAGE ============
exports.getSalesReportPage = async (req, res) => {
  try {
    const filterType = req.query.filterType || "default_value";
    const startDate = req.query.startDate || "default_value";
    const endDate = req.query.endDate || "default_end_date";

    res.render("admin/salesReport", {
      overallSales: 0,
      overallAmount: 0,
      overallDiscount: 0,
      salesData: [],
      filterType,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error("Error loading sales report page:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getSalesReportPage = async (req, res) => {
  try {
    const filterType = req.query.filterType || "default_value";
    const startDate = req.query.startDate || "default_value";
    const endDate = req.query.endDate || "default_end_date";

    res.render("admin/salesReport", {
      overallSales: 0,
      overallAmount: 0,
      overallDiscount: 0,
      salesData: [],
      filterType,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error("Error loading sales report page:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
