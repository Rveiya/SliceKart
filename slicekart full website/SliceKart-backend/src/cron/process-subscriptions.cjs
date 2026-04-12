/**
 * Subscription Order Processor - Cron Job
 * 
 * This script processes subscription orders that are due for delivery.
 * It should be run daily (recommended: early morning, e.g., 5:00 AM)
 * 
 * Usage:
 *   - Manual: node cron/process-subscriptions.cjs
 *   - With node-cron: Import and use the processSubscriptions function
 *   - With system cron: 0 5 * * * cd /path/to/backend && node src/cron/process-subscriptions.cjs
 * 
 * What it does:
 *   1. Finds all active subscriptions with next_delivery_date <= today
 *   2. Creates actual orders for these subscriptions
 *   3. Updates subscription status and next delivery date
 *   4. Creates the next scheduled subscription order
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { v4: uuidv4 } = require("uuid");
const { pool, connectDB } = require("../config/db.cjs");

const FREE_DELIVERY_THRESHOLD = 199;
const LOW_ORDER_DELIVERY_FEE = 10;
const LOW_ORDER_HANDLING_FEE = 10;

/**
 * Calculate next delivery date based on subscription type
 */
function calculateNextDeliveryDate(subscriptionType, preferredDay = null) {
    const now = new Date();
    let nextDelivery = new Date(now);

    if (subscriptionType === 'weekly') {
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
            nextDelivery.setDate(now.getDate() + 7);
        }
    } else if (subscriptionType === 'monthly') {
        nextDelivery.setMonth(now.getMonth() + 1);
    }

    return nextDelivery.toISOString().split('T')[0];
}

/**
 * Process all due subscription orders
 */
async function processSubscriptions() {
    const startTime = Date.now();
    const stats = {
        processed: 0,
        ordersCreated: 0,
        failed: 0,
        skipped: 0
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 SUBSCRIPTION ORDER PROCESSOR`);
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        await connectDB();

        // Find all subscription orders that are due
        const result = await pool.query(`
            SELECT 
                so.id as subscription_order_id,
                so.quantity as order_quantity,
                s.id as subscription_id,
                s.user_id,
                s.product_id,
                s.subscription_type,
                s.quantity,
                s.price_per_delivery,
                s.delivery_address_id,
                s.payment_method,
                s.preferred_delivery_day,
                s.total_deliveries,
                p.name as product_name,
                p.price as product_price,
                p.stock as product_stock
            FROM subscription_orders so
            JOIN subscriptions s ON so.subscription_id = s.id
            JOIN products p ON s.product_id = p.id
            WHERE so.status = 'SCHEDULED'
              AND so.scheduled_delivery_date <= CURRENT_DATE
              AND s.status = 'ACTIVE'
            ORDER BY so.scheduled_delivery_date ASC
        `);

        console.log(`📦 Found ${result.rows.length} subscription order(s) to process\n`);

        if (result.rows.length === 0) {
            console.log("✨ No subscription orders due for processing today.");
            return stats;
        }

        for (const row of result.rows) {
            console.log(`\n${'─'.repeat(50)}`);
            console.log(`📋 Processing: ${row.product_name}`);
            console.log(`   User: ${row.user_id}`);
            console.log(`   Quantity: ${row.order_quantity || row.quantity}`);

            try {
                // Check stock availability
                if (row.product_stock < row.quantity) {
                    console.log(`   ⚠️  Insufficient stock (${row.product_stock} available)`);

                    // Mark as failed
                    await pool.query(`
                        UPDATE subscription_orders 
                        SET status = 'FAILED', 
                            failure_reason = 'Insufficient stock',
                            updated_at = NOW()
                        WHERE id = $1
                    `, [row.subscription_order_id]);

                    stats.failed++;
                    continue;
                }

                // Check if delivery address exists
                if (!row.delivery_address_id) {
                    console.log(`   ⚠️  No delivery address configured`);

                    await pool.query(`
                        UPDATE subscription_orders 
                        SET status = 'FAILED', 
                            failure_reason = 'No delivery address',
                            updated_at = NOW()
                        WHERE id = $1
                    `, [row.subscription_order_id]);

                    stats.failed++;
                    continue;
                }

                // Calculate order total
                const subtotal = row.product_price * row.quantity;
                const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : LOW_ORDER_DELIVERY_FEE;
                const gst = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : 0.74;
                const handlingFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : LOW_ORDER_HANDLING_FEE;
                const total = subtotal + deliveryFee + gst + handlingFee;

                // Create the actual order
                const orderId = uuidv4();
                await pool.query(`
                    INSERT INTO orders (
                        id, user_id, delivery_address_id, total_amount,
                        delivery_fee, handling_fee, gst, status, payment_method,
                        subscription_id, is_subscription_order
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9, true)
                `, [
                    orderId,
                    row.user_id,
                    row.delivery_address_id,
                    total,
                    deliveryFee,
                    handlingFee,
                    gst,
                    row.payment_method,
                    row.subscription_id
                ]);

                // Create order item
                await pool.query(`
                    INSERT INTO order_items (id, order_id, product_id, quantity, price)
                    VALUES ($1, $2, $3, $4, $5)
                `, [uuidv4(), orderId, row.product_id, row.quantity, row.product_price]);

                // Update product stock
                await pool.query(`
                    UPDATE products SET stock = stock - $1 WHERE id = $2
                `, [row.quantity, row.product_id]);

                // Update subscription order status
                await pool.query(`
                    UPDATE subscription_orders 
                    SET status = 'COMPLETED', 
                        order_id = $1,
                        price_at_time = $2,
                        actual_delivery_date = CURRENT_DATE,
                        updated_at = NOW()
                    WHERE id = $3
                `, [orderId, row.product_price, row.subscription_order_id]);

                // Update subscription with delivery count and next delivery date
                const nextDeliveryDate = calculateNextDeliveryDate(
                    row.subscription_type,
                    row.preferred_delivery_day
                );

                await pool.query(`
                    UPDATE subscriptions 
                    SET total_deliveries = total_deliveries + 1,
                        last_delivery_date = CURRENT_DATE,
                        next_delivery_date = $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [nextDeliveryDate, row.subscription_id]);

                // Create next subscription order
                const nextSubscriptionOrderId = uuidv4();
                await pool.query(`
                    INSERT INTO subscription_orders (
                        id, subscription_id, scheduled_delivery_date, status, quantity
                    )
                    VALUES ($1, $2, $3, 'SCHEDULED', $4)
                `, [nextSubscriptionOrderId, row.subscription_id, nextDeliveryDate, row.quantity]);

                console.log(`   ✅ Order created: ${orderId}`);
                console.log(`   📅 Next delivery: ${nextDeliveryDate}`);

                stats.ordersCreated++;
                stats.processed++;

            } catch (orderError) {
                console.error(`   ❌ Error: ${orderError.message}`);

                // Mark subscription order as failed
                await pool.query(`
                    UPDATE subscription_orders 
                    SET status = 'FAILED', 
                        failure_reason = $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [orderError.message, row.subscription_order_id]);

                stats.failed++;
            }
        }

    } catch (error) {
        console.error("\n❌ Critical error:", error.message);
        throw error;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 PROCESSING COMPLETE`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   Total processed: ${stats.processed}`);
    console.log(`   Orders created:  ${stats.ordersCreated}`);
    console.log(`   Failed:          ${stats.failed}`);
    console.log(`   Skipped:         ${stats.skipped}`);
    console.log(`   Duration:        ${duration}s`);
    console.log(`${'='.repeat(60)}\n`);

    return stats;
}

// If run directly (not imported)
if (require.main === module) {
    processSubscriptions()
        .then((stats) => {
            console.log("🎉 Job completed successfully!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 Job failed:", error);
            process.exit(1);
        })
        .finally(() => {
            pool.end();
        });
}

module.exports = { processSubscriptions };
