const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    minlength: 4,
    maxlength: 20
  },
  discountType: {
    type: String,
    required: true,
    enum: ['Percentage', 'Fixed'],
  },
  discountValue: {
    type: Number,
    required: true,
    min: [0, 'Discount value cannot be negative'],
    validate: {
      validator: function (value) {
        if (this.discountType === 'Percentage') {
          return value <= 100;
        }
        return true;
      },
      message: 'Percentage discount cannot exceed 100%'
    }
  },
  minPurchaseAmount: {
    type: Number,
    required: true,
    min: [0, 'Minimum purchase amount cannot be negative'],
    default: 0
  },
  maxDiscountAmount: {
    type: Number,
    required: [function () {
      return this.discountType === 'Percentage';
    }, 'Maximum discount amount is required for Percentage discounts'],
    min: [0, 'Maximum discount amount cannot be negative'],
    default: null
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['Active', 'Inactive'],
    default: 'Active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-validation hook to ensure endDate > startDate
couponSchema.pre('validate', function (next) {
  if (this.isModified('startDate') || this.isModified('endDate')) {
    const startDate = this.startDate instanceof Date ? this.startDate : new Date(this.startDate);
    const endDate = this.endDate instanceof Date ? this.endDate : new Date(this.endDate);

    if (startDate >= endDate) {
      this.invalidate('endDate', 'End date must be after start date', endDate);
    }
  }
  next();
});

// Ensure discountType and maxDiscountAmount consistency
couponSchema.pre('validate', function (next) {
  if (this.discountType === 'Percentage' && (this.maxDiscountAmount === null || this.maxDiscountAmount === undefined)) {
    this.invalidate('maxDiscountAmount', 'Maximum discount amount is required for Percentage discounts');
  }
  next();
});

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;