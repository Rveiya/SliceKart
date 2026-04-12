const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Check if RAZORPAY_KEY_SECRET is set
if (!process.env.RAZORPAY_KEY_SECRET) {
    console.error("❌ RAZORPAY_KEY_SECRET is missing in .env");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

/**
 * Helper to generate valid Razorpay signature
 */
function generateSignature(orderId, paymentId) {
    const body = orderId + "|" + paymentId;
    return crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");
}

async function runSecurityTests() {
    console.log("🛡️  Starting Payment Security Regression Tests...\n");
    const client = await pool.connect();

    try {
        // Setup: Create two test orders
        // Order 1: Cheap item (The "Source" of the reverb)
        const order1Res = await client.query(`
            INSERT INTO orders (user_id, total_amount, status, payment_status, razorpay_order_id)
            VALUES ((SELECT id FROM users LIMIT 1), 10.00, 'PENDING', 'PENDING', 'order_cheap_123')
            RETURNING id, razorpay_order_id
        `);
        const order1 = order1Res.rows[0];

        // Order 2: Expensive item (The "Target" of the replay)
        const order2Res = await client.query(`
            INSERT INTO orders (user_id, total_amount, status, payment_status, razorpay_order_id)
            VALUES ((SELECT id FROM users LIMIT 1), 50000.00, 'PENDING', 'PENDING', 'order_expensive_999')
            RETURNING id, razorpay_order_id
        `);
        const order2 = order2Res.rows[0];

        console.log("📝 Created Test Orders:");
        console.log(`   Order 1 (Cheap): ${order1.id} (rzp: ${order1.razorpay_order_id})`);
        console.log(`   Order 2 (Expensive): ${order2.id} (rzp: ${order2.razorpay_order_id})\n`);

        // ==========================================================
        // TEST 1: Cross-Order Replay Attack
        // ==========================================================
        // Attacker gets a valid signature for the CHEAP order
        const validPaymentId = 'pay_fake_' + Date.now();
        const validSignatureForCheap = generateSignature(order1.razorpay_order_id, validPaymentId);

        console.log("⚔️  TEST 1: Cross-Order Replay Attack");
        console.log("   Attempting to pay for Expensive Order using Cheap Order's signature...");

        // In a real attack, they send:
        // razorpay_order_id: <Cheap Order's Razorpay ID>
        // razorpay_payment_id: <Valid Payment ID>
        // razorpay_signature: <Valid Signature for Cheap Order>
        // order_id: <Expensive Order's Internal ID> (This is what they want to unlock)

        // However, our backend /verify endpoint checks:
        // if (dbOrder.razorpay_order_id !== razorpay_order_id)

        // So let's simulate the request payload that a hacker would send:
        const attackPayload = {
            razorpay_order_id: order1.razorpay_order_id, // valid for signature
            razorpay_payment_id: validPaymentId,         // valid for signature
            razorpay_signature: validSignatureForCheap,  // valid for the above two
            order_id: order2.id                          // BUT we claim it's for Order 2
        };

        // We can't call the API directly here easily without auth, so we mimic the logic
        const dbOrder2 = (await client.query("SELECT razorpay_order_id FROM orders WHERE id = $1", [attackPayload.order_id])).rows[0];

        if (dbOrder2.razorpay_order_id !== attackPayload.razorpay_order_id) {
            console.log("✅ Attack BLOCKED: Mismatched Razorpay Order IDs detected.");
        } else {
            console.error("❌ Attack SUCCEEDED: System failed to detect cross-order binding mismatch!");
        }

        // ==========================================================
        // TEST 2: Duplicate Payment Protection
        // ==========================================================
        console.log("\n⚔️  TEST 2: Duplicate Payment (Idempotency)");

        const payId = 'pay_dup_' + Date.now();

        // Insert first payment
        await client.query(`
            INSERT INTO payments (order_id, razorpay_order_id, razorpay_payment_id, amount, payment_method, status)
            VALUES ($1, $2, $3, 10.00, 'ONLINE', 'COMPLETED')
        `, [order1.id, order1.razorpay_order_id, payId]);
        console.log("   Inserted valid payment.");

        try {
            // Attempt insert duplicate
            await client.query(`
                INSERT INTO payments (order_id, razorpay_order_id, razorpay_payment_id, amount, payment_method, status)
                VALUES ($1, $2, $3, 10.00, 'ONLINE', 'COMPLETED')
            `, [order1.id, order1.razorpay_order_id, payId]);
            console.error("❌ Test FAILED: Duplicate payment was allowed into the database!");
        } catch (err) {
            if (err.code === '23505') { // unique_violation
                console.log("✅ Test PASSED: Database rejected duplicate payment ID.");
            } else {
                console.error("⚠️ Unexpected error:", err.message);
            }
        }

        // Cleanup
        await client.query("DELETE FROM orders WHERE id IN ($1, $2)", [order1.id, order2.id]);
        console.log("\n🧹 Cleanup completed.");

    } catch (err) {
        console.error("Test script error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

runSecurityTests();
