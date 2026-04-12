const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const { query } = require("../config/db.cjs");
const { authenticateToken, requireRole } = require("../middlewares/auth.middleware.cjs");

const FREE_DELIVERY_THRESHOLD = 199;
const LOW_ORDER_DELIVERY_FEE = 10;
const LOW_ORDER_HANDLING_FEE = 10;

/**
 * Helper function to calculate next delivery date based on subscription type
 */
const calculateNextDeliveryDate = (subscriptionType, preferredDay = null, startFromToday = true) => {
    const now = new Date();
    let nextDelivery = new Date(now);

    if (subscriptionType === 'weekly') {
        // For weekly, find the next occurrence of the preferred day (or 7 days from now)
        if (preferredDay) {
            const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const targetDay = days.indexOf(preferredDay.toLowerCase());
            const currentDay = now.getDay();
            let daysUntilTarget = targetDay - currentDay;
            if (daysUntilTarget <= 0) {
                daysUntilTarget += 7;
            }
            nextDelivery.setDate(now.getDate() + daysUntilTarget);
        } else {
            // Default: 7 days from now
            nextDelivery.setDate(now.getDate() + 7);
        }
    } else if (subscriptionType === 'monthly') {
        // For monthly, set to same day next month
        nextDelivery.setMonth(now.getMonth() + 1);
    }

    return nextDelivery.toISOString().split('T')[0]; // Return just the date part
};

/**
 * Helper function to calculate discount from coupon
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
 * Helper to validate coupon
 */
const validateCouponForCheckout = (coupon, subtotal) => {
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

    // Check minimum order amount
    if (subtotal < parseFloat(coupon.min_order_amount)) {
        return { valid: false, reason: `Minimum order amount of ₹${coupon.min_order_amount} required` };
    }

    return { valid: true };
};

/**
 * POST /api/checkout - Process checkout with cart items
 * Creates regular orders for one-time purchases and subscriptions for recurring items
 */
router.post("/", authenticateToken, requireRole(['CUSTOMER']), async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const {
            delivery_address_id,
            payment_method = 'COD',
            tip = 0,
            coupon_code = null
        } = req.body;

        if (!delivery_address_id) {
            return res.status(400).json({ message: "Delivery address is required" });
        }

        // Verify address belongs to user
        const addressCheck = await query(
            "SELECT * FROM addresses WHERE id = $1 AND user_id = $2",
            [delivery_address_id, userId]
        );

        if (!addressCheck.rows.length) {
            return res.status(400).json({ message: "Invalid delivery address" });
        }

        // Get all cart items
        const cartResult = await query(`
            SELECT ci.*, 
                   p.id as product_id, p.name, p.price, p.stock
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.user_id = $1
        `, [userId]);

        if (!cartResult.rows.length) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        // Separate items into one-time orders and subscriptions
        const oneTimeItems = [];
        const subscriptionItems = [];

        for (const item of cartResult.rows) {
            if (item.subscription_type === 'one-time' || !item.subscription_type) {
                oneTimeItems.push(item);
            } else {
                subscriptionItems.push(item);
            }
        }

        // Validate stock for all items
        for (const item of cartResult.rows) {
            if (item.stock < item.quantity) {
                return res.status(400).json({
                    message: `Insufficient stock for ${item.name}. Only ${item.stock} available.`
                });
            }
        }

        const results = {
            order: null,
            subscriptions: [],
            subscriptionOrders: [],
            coupon_applied: null
        };

        // Handle coupon validation if provided
        let appliedCoupon = null;
        let discountAmount = 0;

        if (coupon_code) {
            const couponResult = await query(
                "SELECT * FROM coupons WHERE UPPER(code) = UPPER($1)",
                [coupon_code]
            );

            if (!couponResult.rows.length) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid coupon code"
                });
            }

            appliedCoupon = couponResult.rows[0];

            // Calculate subtotal for all items (for coupon validation)
            let totalSubtotal = 0;
            for (const item of cartResult.rows) {
                totalSubtotal += item.price * item.quantity;
            }

            // Validate coupon
            const validation = validateCouponForCheckout(appliedCoupon, totalSubtotal);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    message: validation.reason
                });
            }

            // Calculate discount
            discountAmount = calculateDiscount(totalSubtotal, appliedCoupon);
        }

        // Process one-time order items
        if (oneTimeItems.length > 0) {
            let subtotal = 0;
            const orderItems = [];

            for (const item of oneTimeItems) {
                subtotal += item.price * item.quantity;
                orderItems.push({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: item.price
                });
            }

            // Calculate GST (18% of subtotal)
            const actual_delivery_fee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : LOW_ORDER_DELIVERY_FEE;
            const actual_handling_fee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : LOW_ORDER_HANDLING_FEE;
            const gst = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : Math.round(subtotal * 0.18 * 100) / 100;

            // Apply coupon discount if applicable
            let couponDiscount = 0;
            if (appliedCoupon) {
                // The discount is calculated on the total cart subtotal, but applied to the one-time order
                couponDiscount = discountAmount;
            }

            const total_amount = subtotal + actual_delivery_fee + actual_handling_fee + gst + tip - couponDiscount;

            // Create order
            const orderId = uuidv4();
            let insertQuery = `INSERT INTO orders (id, user_id, delivery_address_id, total_amount, delivery_fee, handling_fee, gst, status, payment_method`;
            let params = [orderId, userId, delivery_address_id, total_amount, actual_delivery_fee, actual_handling_fee, gst, 'PENDING', payment_method];
            let paramNum = 10;

            // Add coupon fields if coupon is applied
            if (appliedCoupon) {
                insertQuery += `, coupon_id, coupon_code, discount_amount, discount_type`;
                params.push(appliedCoupon.id, appliedCoupon.code, couponDiscount, appliedCoupon.discount_type);
            }

            insertQuery += `)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9`;

            if (appliedCoupon) {
                insertQuery += `, $${paramNum++}, $${paramNum++}, $${paramNum++}, $${paramNum++}`;
            }

            insertQuery += `)
                RETURNING *
            `;

            const orderResult = await query(insertQuery, params);

            // Create order items and update stock
            for (const item of orderItems) {
                await query(`
                    INSERT INTO order_items (id, order_id, product_id, quantity, price)
                    VALUES ($1, $2, $3, $4, $5)
                `, [uuidv4(), orderId, item.product_id, item.quantity, item.price]);

                // Update stock
                await query(`
                    UPDATE products SET stock = stock - $1 WHERE id = $2
                `, [item.quantity, item.product_id]);
            }

            results.order = orderResult.rows[0];

            // Increment coupon usage if applied
            if (appliedCoupon) {
                await query(
                    "UPDATE coupons SET used_count = used_count + 1, updated_at = NOW() WHERE id = $1",
                    [appliedCoupon.id]
                );
                results.coupon_applied = {
                    code: appliedCoupon.code,
                    discount_amount: couponDiscount
                };
            }
        }

        // Process subscription items
        for (const item of subscriptionItems) {
            const subscriptionId = uuidv4();
            const nextDeliveryDate = calculateNextDeliveryDate(item.subscription_type);

            // Calculate discount for this subscription item
            let subscriptionDiscount = 0;
            if (appliedCoupon) {
                const itemSubtotal = item.price * item.quantity;
                // Apply a proportional discount
                subscriptionDiscount = calculateDiscount(itemSubtotal, appliedCoupon);
            }

            // Create subscription
            const subscriptionResult = await query(`
                INSERT INTO subscriptions (
                    id, user_id, product_id, subscription_type, quantity,
                    preferred_delivery_time, status, price_per_delivery,
                    next_delivery_date, delivery_address_id, payment_method,
                    initial_discount
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8, $9, $10, $11)
                RETURNING *
            `, [
                subscriptionId,
                userId,
                item.product_id,
                item.subscription_type,
                item.quantity,
                item.preferred_delivery_time,
                item.price,
                nextDeliveryDate,
                delivery_address_id,
                payment_method,
                subscriptionDiscount
            ]);

            const newSubscription = subscriptionResult.rows[0];
            results.subscriptions.push(newSubscription);

            // Create the first (immediate) subscription order
            const firstOrderId = uuidv4();
            const firstOrderTotal = (item.price * item.quantity) - subscriptionDiscount;

            const firstOrder = await query(`
                INSERT INTO orders (
                    id, user_id, delivery_address_id, total_amount, delivery_fee, handling_fee, gst, 
                    status, payment_method, subscription_id,
                    coupon_id, coupon_code, discount_amount, discount_type
                )
                VALUES ($1, $2, $3, $4, 0, 0, 0, 'PENDING', $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [
                firstOrderId,
                userId,
                delivery_address_id,
                firstOrderTotal,
                payment_method,
                subscriptionId,
                appliedCoupon ? appliedCoupon.id : null,
                appliedCoupon ? appliedCoupon.code : null,
                subscriptionDiscount,
                appliedCoupon ? appliedCoupon.discount_type : null
            ]);

            await query(`
                INSERT INTO order_items (id, order_id, product_id, quantity, price)
                VALUES ($1, $2, $3, $4, $5)
            `, [uuidv4(), firstOrderId, item.product_id, item.quantity, item.price]);

            // Update stock
            await query(
                `UPDATE products SET stock = stock - $1 WHERE id = $2`,
                [item.quantity, item.product_id]
            );

            results.subscriptionOrders.push(firstOrder.rows[0]);

            // Create the next scheduled subscription order
            const nextSubOrderId = uuidv4();
            await query(`
                INSERT INTO subscription_orders (
                    id, subscription_id, scheduled_delivery_date, status, quantity
                )
                VALUES ($1, $2, $3, 'SCHEDULED', $4)
            `, [nextSubOrderId, subscriptionId, nextDeliveryDate, item.quantity]);
        }

        // Clear user's cart after successful checkout
        await query("DELETE FROM cart_items WHERE user_id = $1", [userId]);

        res.status(201).json({
            success: true,
            message: "Checkout completed successfully",
            ...results
        });

    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/checkout/from-product - Direct checkout from product page
 * Creates order or subscription directly without going through cart
 */
router.post("/from-product", authenticateToken, requireRole(['CUSTOMER']), async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const {
            product_id,
            quantity = 1,
            subscription_type = 'one-time',
            preferred_delivery_time,
            delivery_address_id,
            payment_method = 'COD'
        } = req.body;

        if (!product_id) {
            return res.status(400).json({ message: "Product ID is required" });
        }

        if (!delivery_address_id) {
            return res.status(400).json({ message: "Delivery address is required" });
        }

        // Check product exists and has stock
        const productCheck = await query(
            "SELECT id, name, price, stock FROM products WHERE id = $1 AND is_active = true",
            [product_id]
        );

        if (!productCheck.rows.length) {
            return res.status(404).json({ message: "Product not found" });
        }

        const product = productCheck.rows[0];

        if (product.stock < quantity) {
            return res.status(400).json({ message: "Insufficient stock" });
        }

        // Verify address belongs to user
        const addressCheck = await query(
            "SELECT * FROM addresses WHERE id = $1 AND user_id = $2",
            [delivery_address_id, userId]
        );

        if (!addressCheck.rows.length) {
            return res.status(400).json({ message: "Invalid delivery address" });
        }

        const result = {};

        if (subscription_type === 'one-time') {
            // Create one-time order
            const orderId = uuidv4();
            const subtotal = product.price * quantity;
            const actualDelFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : LOW_ORDER_DELIVERY_FEE;
            const actualHandFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : LOW_ORDER_HANDLING_FEE;
            const gst = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : Math.round(subtotal * 0.18 * 100) / 100;
            const total_amount = subtotal + actualDelFee + actualHandFee + gst;

            const orderResult = await query(`
                INSERT INTO orders (id, user_id, delivery_address_id, total_amount, delivery_fee, handling_fee, gst, status, payment_method)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8)
                RETURNING *
            `, [orderId, userId, delivery_address_id, total_amount, actualDelFee, actualHandFee, gst, payment_method]);

            await query(`
                INSERT INTO order_items (id, order_id, product_id, quantity, price)
                VALUES ($1, $2, $3, $4, $5)
            `, [uuidv4(), orderId, product_id, quantity, product.price]);

            // Update stock
            await query(`
                UPDATE products SET stock = stock - $1 WHERE id = $2
            `, [quantity, product_id]);

            result.order = orderResult.rows[0];
            result.type = 'order';

        } else {
            // Create subscription
            const subscriptionId = uuidv4();
            const nextDeliveryDate = calculateNextDeliveryDate(subscription_type);

            const subscriptionResult = await query(`
                INSERT INTO subscriptions (
                    id, user_id, product_id, subscription_type, quantity,
                    preferred_delivery_time, status, price_per_delivery,
                    next_delivery_date, delivery_address_id, payment_method,
                    initial_discount
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8, $9, $10, $11)
                RETURNING *
            `, [
                subscriptionId,
                userId,
                product_id,
                subscription_type,
                quantity,
                preferred_delivery_time || 'morning',
                product.price * quantity,
                nextDeliveryDate,
                delivery_address_id,
                payment_method,
                subscriptionDiscount
            ]);

            // Create first scheduled subscription order
            const subscriptionOrderId = uuidv4();
            await query(`
                INSERT INTO subscription_orders (
                    id, subscription_id, scheduled_delivery_date, status, quantity
                )
                VALUES ($1, $2, $3, 'SCHEDULED', $4)
            `, [subscriptionOrderId, subscriptionId, nextDeliveryDate, quantity]);

            // Create first order for immediate delivery
            const firstOrderId = uuidv4();
            const subtotal = product.price * quantity;
            const actualDelFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : LOW_ORDER_DELIVERY_FEE;
            const actualHandFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : LOW_ORDER_HANDLING_FEE;
            const subGst = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : Math.round(subtotal * 0.18 * 100) / 100;
            const orderTotal = subtotal + actualDelFee + actualHandFee + subGst;

            const firstOrderResult = await query(`
                INSERT INTO orders (
                    id, user_id, delivery_address_id, total_amount, 
                    delivery_fee, handling_fee, gst, status, payment_method,
                    subscription_id, is_subscription_order
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9, true)
                RETURNING *
            `, [
                firstOrderId, userId, delivery_address_id, orderTotal,
                actualDelFee, actualHandFee, subGst, payment_method, subscriptionId
            ]);

            await query(`
                INSERT INTO order_items (id, order_id, product_id, quantity, price)
                VALUES ($1, $2, $3, $4, $5)
            `, [uuidv4(), firstOrderId, product_id, quantity, product.price]);

            // Update stock for first delivery
            await query(`
                UPDATE products SET stock = stock - $1 WHERE id = $2
            `, [quantity, product_id]);

            result.subscription = subscriptionResult.rows[0];
            result.order = firstOrderResult.rows[0];
            result.type = 'subscription';
        }

        res.status(201).json({
            success: true,
            message: subscription_type === 'one-time'
                ? "Order placed successfully"
                : "Subscription created successfully",
            ...result
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;
