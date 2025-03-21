const PDFDocument = require('pdfkit');
const Order = require('../models/orderModel');
const User = require('../models/userModel');
const path = require('path'); // Add this for file path resolution

exports.generateInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.user._id;

    const order = await Order.findById(orderId)
      .populate('orderedItems.productId')
      .populate('shippingAddress');
    
    if (!order || order.userId.toString() !== userId.toString()) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
    }

    console.log('Order:', JSON.stringify(order, null, 2));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    // Header Section
    doc.font('Helvetica-Bold')
       .fontSize(20)
       .fillColor('#007bff')
       .text('STYLEOVA CLOTHING', { align: 'center' })
       .font('Helvetica')
       .fontSize(9)
       .fillColor('#666')
       .text('46/765 Beemapally Main Road, Trivandrum, Kerala, 695008', { align: 'center' })
       .moveDown(0.3)
       .fontSize(14)
       .fillColor('#333')
       .text('Invoice', { align: 'center' })
       .moveDown(1);

    // Invoice Details
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#333')
       .text(`Invoice #: ${orderId}`, 40)
       .text(`Date: ${order.orderedDate.toLocaleDateString()}`, 400, doc.y - 15)
       .moveDown(0.5);

    // Billing Info
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#007bff')
       .text('Bill To:', 40)
       .moveDown(0.3);

    if (order.shippingAddress) {
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#333')
         .text(order.shippingAddress.name || order.name || 'N/A', 40)
         .text(order.shippingAddress.address || 'N/A', 40)
         .text(`${order.shippingAddress.district || 'N/A'}, ${order.shippingAddress.state || 'N/A'} ${order.shippingAddress.pincode || ''}`, 40)
         .text(`Phone: ${order.shippingAddress.mobileNumber || 'N/A'}`, 40);
    } else {
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#333')
         .text(order.name || 'Shipping address not available', 40);
    }
    doc.moveDown(1);

    // Order Items Table
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#007bff')
       .text('Order Items:', 40)
       .moveDown(0.3);

    const tableHeaders = ['Item', 'Qty', 'Unit Price (Rs)', 'Total (Rs)'];
    const tableWidths = [250, 70, 90, 90]; // Total width = 500
    const tableX = 40;
    let tableY = doc.y;

    // Function to draw table headers
    const drawTableHeaders = () => {
      doc.rect(tableX, tableY, tableWidths.reduce((a, b) => a + b, 0), 25)
         .fillColor('#007bff')
         .fill()
         .strokeColor('#0056b3')
         .stroke();

      doc.font('Helvetica-Bold')
         .fontSize(10)
         .fillColor('#ffffff');
      tableHeaders.forEach((header, i) => {
        const xPos = tableX + tableWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.text(header, xPos + 8, tableY + 6, { width: tableWidths[i] - 16, align: i === 0 ? 'left' : 'right' });
      });
      tableY += 25;
    };

    drawTableHeaders();

    // Table Rows
    let subtotal = 0;
    order.orderedItems.forEach((item, index) => {
      const unitPrice = item.originalPrice;
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;

      doc.fillColor(index % 2 === 0 ? '#f0f6ff' : '#ffffff')
         .rect(tableX, tableY, tableWidths.reduce((a, b) => a + b, 0), 30)
         .fill()
         .strokeColor('#d3d3d3')
         .stroke();

      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#333');
      doc.text(`${item.pname} (Size: ${item.size})`, tableX + 8, tableY + 8, { width: tableWidths[0] - 16, align: 'left' });
      doc.text(item.quantity.toString(), tableX + tableWidths[0] + 8, tableY + 8, { width: tableWidths[1] - 16, align: 'right' });
      doc.text(`${unitPrice.toFixed(2)}`, tableX + tableWidths[0] + tableWidths[1] + 8, tableY + 8, { width: tableWidths[2] - 16, align: 'right' });
      doc.text(`${itemTotal.toFixed(2)}`, tableX + tableWidths[0] + tableWidths[1] + tableWidths[2] + 8, tableY + 8, { width: tableWidths[3] - 16, align: 'right' });

      tableY += 30;
    });

    // Totals Section (Centered)
    tableY += 10;
    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#333');
    const centerX = doc.page.width / 2;
    doc.text(`Subtotal: Rs. ${subtotal.toFixed(2)}`, centerX, tableY, { align: 'center' });
    tableY += 15;

    const couponDiscount = order.couponApplied?.discount || 0;
    if (couponDiscount > 0) {
      doc.text(`Coupon Discount (${order.couponApplied.code || 'N/A'}): Rs. ${couponDiscount.toFixed(2)}`, centerX, tableY, { align: 'center' });
      tableY += 15;
    }

    doc.fontSize(11)
       .text(`Total: Rs. ${order.totalAmount.toFixed(2)}`, centerX, tableY, { align: 'center' });

    // Footer Section with PNG Seal
    const sealX = doc.page.width - 150; // Right side
    const sealY = doc.page.height - 100;
    const sealPath = path.join(__dirname, '../public/assets/img/styleova-seal.png'); 
    doc.image(sealPath, sealX - 40, sealY - 180, { width: 200 }); 

    // Footer Text Centered Below Seal
    const footerX = sealX; // Center text under seal
    doc.font('Helvetica-Oblique')
       .fontSize(7)
       .fillColor('#777')
       .text(`Invoice Generated on: ${new Date().toLocaleString()}`, footerX, sealY + 15, { align: 'center' })
       .text('Thanks for shopping with Styleova!', footerX, sealY + 5, { align: 'center' })
       .text('© 2025 Styleova Clothing Ltd. All Rights Reserved.', footerX, sealY + 30, { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


