const express = require("express");
const router = express.Router();

const { query } = require("../config/db.cjs");
const { authenticateToken, requireRole } = require("../middlewares/auth.middleware.cjs");

/**
 * Helper function to calculate discount amount
 */
const calculateDiscount = (subtotal, coupon) => {
    let discountAmount = 0;

    if (coupon.discount_type === 'percentage') {
        discountAmount = (subtotal * coupon.discount_value) / 100;

        // Apply max discount cap if set
        if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
            discountAmount = coupon.max_discount_amount;
        }
    } else if (coupon.discount_type === 'flat') {
        discountAmount = coupon.discount_value;
    }

    return Math.round(discountAmount * 100) / 100; // Round to 2 decimals
};

/**
 * Helper to validate if coupon can be used
 */
const validateCouponUsage = (coupon) => {
    const now = new Date();

    // Check if active
    if (!coupon.is_active) {
        return { valid: false, reason: 'Coupon is inactive' };
    }

    // Check if started
    if (new Date(coupon.starts_at) > now) {
        return { valid: false, reason: 'Coupon is not yet active' };
    }

    // Check if expired
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
        return { valid: false, reason: 'Coupon has expired' };
    }

    // Check usage limit
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
        return { valid: false, reason: 'Coupon usage limit reached' };
    }

    return { valid: true };
};

/**
 * GET /api/coupons - List all active public coupons
 */
router.get("/", async (req, res, next) => {
    try {
        const now = new Date().toISOString();

        const result = await query(`
            SELECT id, code, description, discount_type, discount_value,
                   min_order_amount, max_discount_amount, usage_limit, used_count,
                   starts_at, expires_at
            FROM coupons
            WHERE is_active = true
                AND starts_at <= NOW()
                AND (expires_at IS NULL OR expires_at > NOW())
                AND (usage_limit IS NULL OR used_count < usage_limit)
            ORDER BY created_at DESC
        `);

        const coupons = result.rows.map(coupon => ({
            id: coupon.id,
            code: coupon.code,
            description: coupon.description,
            discount_type: coupon.discount_type,
            discount_value: parseFloat(coupon.discount_value),
            min_order_amount: parseFloat(coupon.min_order_amount),
            max_discount_amount: coupon.max_discount_amount ? parseFloat(coupon.max_discount_amount) : null,
            usage_limit: coupon.usage_limit,
            used_count: parseInt(coupon.used_count)
        }));

        res.json({
            success: true,
            coupons
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/coupons/validate - Validate and preview coupon discount
 * Body: { coupon_code, subtotal }
 */
router.post("/validate", async (req, res, next) => {
    try {
        const { coupon_code, subtotal } = req.body;

        if (!coupon_code || !subtotal) {
            return res.status(400).json({
                success: false,
                message: "Coupon code and subtotal are required"
            });
        }

        const subtotalAmount = parseFloat(subtotal);
        if (isNaN(subtotalAmount) || subtotalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid subtotal amount"
            });
        }

        // Find coupon by code
        const couponResult = await query(
            "SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)",
            [coupon_code]
        );

        if (!couponResult.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        const coupon = couponResult.rows[0];

        // Validate coupon usage
        const validation = validateCouponUsage(coupon);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: validation.reason
            });
        }

        // Check minimum order amount
        if (subtotalAmount < parseFloat(coupon.min_order_amount)) {
            return res.status(400).json({
                success: false,
                message: `Minimum order amount of ₹${coupon.min_order_amount} required`
            });
        }

        // Calculate discount
        const discountAmount = calculateDiscount(subtotalAmount, coupon);

        res.json({
            success: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                description: coupon.description,
                discount_type: coupon.discount_type,
                discount_value: parseFloat(coupon.discount_value),
                max_discount_amount: coupon.max_discount_amount ? parseFloat(coupon.max_discount_amount) : null
            },
            discount_amount: discountAmount,
            total_after_discount: Math.round((subtotalAmount - discountAmount) * 100) / 100
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
