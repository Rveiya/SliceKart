const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const { query } = require("../config/db.cjs");
const { authenticateToken, requireRole } = require("../middlewares/auth.middleware.cjs");

// Helper function to calculate next delivery date
function calculateNextDeliveryDate(subscriptionType, preferredDay = null) {
    const now = new Date();
    let nextDate = new Date(now);

    if (subscriptionType === 'weekly') {
        // If preferred day is set, find the next occurrence
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const preferredDayIndex = preferredDay ? daysOfWeek.indexOf(preferredDay.toLowerCase()) : 1; // Default to Monday
        const currentDay = now.getDay();

        let daysUntilNext = preferredDayIndex - currentDay;
        if (daysUntilNext <= 0) {
            daysUntilNext += 7;
        }
        nextDate.setDate(nextDate.getDate() + daysUntilNext);
    } else if (subscriptionType === 'monthly') {
        // If preferred day is set, use that day of next month
        const preferredDayNum = preferredDay ? parseInt(preferredDay) : 1;
        nextDate.setMonth(nextDate.getMonth() + 1);
        nextDate.setDate(Math.min(preferredDayNum, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
    }

    return nextDate;
}

/* GET all subscriptions for current user */
router.get("/", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { status } = req.query;

        let queryText = `
            SELECT s.*, 
                   p.id as product_id, p.name as product_name, p.description, 
                   p.price, p.image_url, p.volume, p.health_notes,
                   a.name as address_name, a.street, a.city, a.state, a.pincode
            FROM subscriptions s
            JOIN products p ON s.product_id = p.id
            LEFT JOIN addresses a ON s.delivery_address_id = a.id
            WHERE s.user_id = $1
        `;
        const params = [userId];

        if (status) {
            queryText += ` AND s.status = $2`;
            params.push(status);
        }

        queryText += ` ORDER BY s.created_at DESC`;

        const result = await query(queryText, params);

        const subscriptions = result.rows.map(row => ({
            id: row.id,
            subscription_type: row.subscription_type,
            quantity: row.quantity,
            preferred_delivery_time: row.preferred_delivery_time,
            preferred_delivery_day: row.preferred_delivery_day,
            status: row.status,
            price_per_delivery: row.price_per_delivery,
            next_delivery_date: row.next_delivery_date,
            last_delivery_date: row.last_delivery_date,
            total_deliveries: row.total_deliveries,
            payment_method: row.payment_method,
            created_at: row.created_at,
            product: {
                id: row.product_id,
                name: row.product_name,
                description: row.description,
                price: row.price,
                image_url: row.image_url,
                volume: row.volume,

                health_notes: row.health_notes
            },
            delivery_address: row.delivery_address_id ? {
                name: row.address_name,
                street: row.street,
                city: row.city,
                state: row.state,
                pincode: row.pincode
            } : null
        }));

        res.json({
            success: true,
            subscriptions,
            count: subscriptions.length
        });
    } catch (err) {
        next(err);
    }
});

/* GET single subscription */
router.get("/:id", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const result = await query(`
            SELECT s.*, 
                   p.id as product_id, p.name as product_name, p.description, 
                   p.price, p.image_url, p.volume, p.health_notes,
                   a.name as address_name, a.street, a.city, a.state, a.pincode, a.phone
            FROM subscriptions s
            JOIN products p ON s.product_id = p.id
            LEFT JOIN addresses a ON s.delivery_address_id = a.id
            WHERE s.id = $1 AND s.user_id = $2
        `, [id, userId]);

        if (!result.rows.length) {
            return res.status(404).json({ message: "Subscription not found" });
        }

        const row = result.rows[0];

        // Get subscription orders
        const ordersResult = await query(`
            SELECT so.*, o.status as order_status, o.created_at as order_created_at
            FROM subscription_orders so
            LEFT JOIN orders o ON so.order_id = o.id
            WHERE so.subscription_id = $1
            ORDER BY so.scheduled_date DESC
            LIMIT 10
        `, [id]);

        res.json({
            success: true,
            subscription: {
                id: row.id,
                subscription_type: row.subscription_type,
                quantity: row.quantity,
                preferred_delivery_time: row.preferred_delivery_time,
                preferred_delivery_day: row.preferred_delivery_day,
                status: row.status,
                price_per_delivery: row.price_per_delivery,
                next_delivery_date: row.next_delivery_date,
                last_delivery_date: row.last_delivery_date,
                total_deliveries: row.total_deliveries,
                payment_method: row.payment_method,
                notes: row.notes,
                created_at: row.created_at,
                product: {
                    id: row.product_id,
                    name: row.product_name,
                    description: row.description,
                    price: row.price,
                    image_url: row.image_url,
                    volume: row.volume,

                    health_notes: row.health_notes
                },
                delivery_address: row.delivery_address_id ? {
                    name: row.address_name,
                    street: row.street,
                    city: row.city,
                    state: row.state,
                    pincode: row.pincode,
                    phone: row.phone
                } : null,
                recent_orders: ordersResult.rows
            }
        });
    } catch (err) {
        next(err);
    }
});

/* POST create subscription */
router.post("/", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const {
            product_id,
            subscription_type,
            quantity = 1,
            preferred_delivery_time = 'morning',
            preferred_delivery_day,
            delivery_address_id,
            payment_method = 'COD'
        } = req.body;

        // Validate required fields
        if (!product_id || !subscription_type) {
            return res.status(400).json({ message: "Product ID and subscription type are required" });
        }

        if (!['weekly', 'monthly'].includes(subscription_type)) {
            return res.status(400).json({ message: "Invalid subscription type. Must be 'weekly' or 'monthly'" });
        }

        // Check if product exists
        const productCheck = await query(
            "SELECT id, price, stock FROM products WHERE id = $1 AND is_active = true",
            [product_id]
        );

        if (!productCheck.rows.length) {
            return res.status(404).json({ message: "Product not found or inactive" });
        }

        const product = productCheck.rows[0];

        if (product.stock < quantity) {
            return res.status(400).json({ message: "Insufficient stock" });
        }

        // Validate address if provided
        if (delivery_address_id) {
            const addressCheck = await query(
                "SELECT id FROM addresses WHERE id = $1 AND user_id = $2",
                [delivery_address_id, userId]
            );
            if (!addressCheck.rows.length) {
                return res.status(404).json({ message: "Delivery address not found" });
            }
        }

        const subscriptionId = uuidv4();
        const nextDeliveryDate = calculateNextDeliveryDate(subscription_type, preferred_delivery_day);
        const pricePerDelivery = product.price * quantity;

        const result = await query(`
            INSERT INTO subscriptions (
                id, user_id, product_id, subscription_type, quantity,
                preferred_delivery_time, preferred_delivery_day, status,
                price_per_delivery, next_delivery_date, delivery_address_id, payment_method
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $9, $10, $11)
            RETURNING *
        `, [
            subscriptionId, userId, product_id, subscription_type, quantity,
            preferred_delivery_time, preferred_delivery_day,
            pricePerDelivery, nextDeliveryDate, delivery_address_id, payment_method
        ]);

        // Create first scheduled order
        await query(`
            INSERT INTO subscription_orders (id, subscription_id, scheduled_date, status)
            VALUES ($1, $2, $3, 'PENDING')
        `, [uuidv4(), subscriptionId, nextDeliveryDate]);

        res.status(201).json({
            success: true,
            message: "Subscription created successfully",
            subscription: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

/* PUT update subscription */
router.put("/:id", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const {
            quantity,
            preferred_delivery_time,
            preferred_delivery_day,
            delivery_address_id,
            payment_method
        } = req.body;

        // Check if subscription exists and belongs to user
        const subscriptionCheck = await query(
            "SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2",
            [id, userId]
        );

        if (!subscriptionCheck.rows.length) {
            return res.status(404).json({ message: "Subscription not found" });
        }

        const updates = [];
        const values = [];
        let valueIndex = 1;

        if (quantity !== undefined) {
            updates.push(`quantity = $${valueIndex++}`);
            values.push(quantity);
        }
        if (preferred_delivery_time) {
            updates.push(`preferred_delivery_time = $${valueIndex++}`);
            values.push(preferred_delivery_time);
        }
        if (preferred_delivery_day !== undefined) {
            updates.push(`preferred_delivery_day = $${valueIndex++}`);
            values.push(preferred_delivery_day);
        }
        if (delivery_address_id) {
            updates.push(`delivery_address_id = $${valueIndex++}`);
            values.push(delivery_address_id);
        }
        if (payment_method) {
            updates.push(`payment_method = $${valueIndex++}`);
            values.push(payment_method);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: "No fields to update" });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const result = await query(`
            UPDATE subscriptions 
            SET ${updates.join(', ')}
            WHERE id = $${valueIndex}
            RETURNING *
        `, values);

        res.json({
            success: true,
            message: "Subscription updated",
            subscription: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

/* POST pause subscription */
router.post("/:id/pause", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const result = await query(`
            UPDATE subscriptions 
            SET status = 'PAUSED', updated_at = NOW()
            WHERE id = $1 AND user_id = $2 AND status = 'ACTIVE'
            RETURNING *
        `, [id, userId]);

        if (!result.rows.length) {
            return res.status(404).json({ message: "Subscription not found or not active" });
        }

        res.json({
            success: true,
            message: "Subscription paused",
            subscription: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

/* POST resume subscription */
router.post("/:id/resume", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const subscription = await query(
            "SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2 AND status = 'PAUSED'",
            [id, userId]
        );

        if (!subscription.rows.length) {
            return res.status(404).json({ message: "Subscription not found or not paused" });
        }

        const sub = subscription.rows[0];
        const nextDeliveryDate = calculateNextDeliveryDate(sub.subscription_type, sub.preferred_delivery_day);

        const result = await query(`
            UPDATE subscriptions 
            SET status = 'ACTIVE', next_delivery_date = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `, [nextDeliveryDate, id]);

        // Create new scheduled order
        await query(`
            INSERT INTO subscription_orders (id, subscription_id, scheduled_date, status)
            VALUES ($1, $2, $3, 'PENDING')
        `, [uuidv4(), id, nextDeliveryDate]);

        res.json({
            success: true,
            message: "Subscription resumed",
            subscription: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

/* POST cancel subscription */
router.post("/:id/cancel", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const result = await query(`
            UPDATE subscriptions 
            SET status = 'CANCELLED', updated_at = NOW()
            WHERE id = $1 AND user_id = $2 AND status IN ('ACTIVE', 'PAUSED')
            RETURNING *
        `, [id, userId]);

        if (!result.rows.length) {
            return res.status(404).json({ message: "Subscription not found or already cancelled" });
        }

        // Cancel all pending subscription orders
        await query(`
            UPDATE subscription_orders 
            SET status = 'SKIPPED'
            WHERE subscription_id = $1 AND status = 'PENDING'
        `, [id]);

        res.json({
            success: true,
            message: "Subscription cancelled",
            subscription: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

/* POST process pending subscription orders (Admin/Cron job) */
router.post("/process-orders", authenticateToken, requireRole(['ADMIN']), async (req, res, next) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Get all pending subscription orders due today
        const pendingOrders = await query(`
            SELECT so.*, s.user_id, s.product_id, s.quantity, s.price_per_delivery,
                   s.delivery_address_id, s.payment_method, s.subscription_type, s.preferred_delivery_day
            FROM subscription_orders so
            JOIN subscriptions s ON so.subscription_id = s.id
            WHERE so.scheduled_date <= $1 
              AND so.status = 'PENDING' 
              AND s.status = 'ACTIVE'
        `, [today]);

        const results = {
            processed: 0,
            failed: 0,
            orders: []
        };

        for (const subOrder of pendingOrders.rows) {
            try {
                // Create order
                const orderId = uuidv4();
                const orderResult = await query(`
                    INSERT INTO orders (
                        id, user_id, delivery_address_id, total_amount,
                        delivery_fee, status, payment_method, subscription_id, is_subscription_order
                    )
                    VALUES ($1, $2, $3, $4, 60, 'PENDING', $5, $6, true)
                    RETURNING *
                `, [
                    orderId, subOrder.user_id, subOrder.delivery_address_id,
                    subOrder.price_per_delivery + 60, subOrder.payment_method,
                    subOrder.subscription_id
                ]);

                // Create order item
                await query(`
                    INSERT INTO order_items (id, order_id, product_id, quantity, price)
                    VALUES ($1, $2, $3, $4, $5)
                `, [uuidv4(), orderId, subOrder.product_id, subOrder.quantity, subOrder.price_per_delivery]);

                // Update subscription order status
                await query(`
                    UPDATE subscription_orders 
                    SET status = 'GENERATED', order_id = $1, generated_at = NOW()
                    WHERE id = $2
                `, [orderId, subOrder.id]);

                // Calculate and set next delivery date
                const nextDeliveryDate = calculateNextDeliveryDate(
                    subOrder.subscription_type,
                    subOrder.preferred_delivery_day
                );

                await query(`
                    UPDATE subscriptions 
                    SET next_delivery_date = $1, 
                        last_delivery_date = $2, 
                        total_deliveries = total_deliveries + 1,
                        updated_at = NOW()
                    WHERE id = $3
                `, [nextDeliveryDate, today, subOrder.subscription_id]);

                // Create next subscription order
                await query(`
                    INSERT INTO subscription_orders (id, subscription_id, scheduled_date, status)
                    VALUES ($1, $2, $3, 'PENDING')
                `, [uuidv4(), subOrder.subscription_id, nextDeliveryDate]);

                results.processed++;
                results.orders.push({
                    subscription_id: subOrder.subscription_id,
                    order_id: orderId,
                    status: 'success'
                });
            } catch (err) {
                results.failed++;
                results.orders.push({
                    subscription_id: subOrder.subscription_id,
                    status: 'failed',
                    error: err.message
                });
            }
        }

        res.json({
            success: true,
            message: `Processed ${results.processed} orders, ${results.failed} failed`,
            results
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
