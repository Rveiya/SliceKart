const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");

const { query, pool } = require("../config/db.cjs");
const { authenticateToken, requireRole } = require("../middlewares/auth.middleware.cjs");
const rateLimit = require("express-rate-limit");

const paymentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: "Too many payment attempts, try later"
});

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/* Create Razorpay Order - Amount fetched from database for security */
router.post("/create-order", paymentLimiter, authenticateToken, requireRole(['CUSTOMER']), async (req, res, next) => {
  try {
    const { order_id } = req.body;
    const userId = req.user.userId;

    // Validate order_id is provided
    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // Fetch order from database to get the amount (security: prevent amount tampering)
    const orderResult = await query(
      `SELECT id, total_amount, user_id, payment_status, status 
       FROM orders WHERE id = $1`,
      [order_id]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const orderData = orderResult.rows[0];

    // Verify the order belongs to the current user
    if (orderData.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to pay for this order"
      });
    }

    // Check if order is already paid
    if (orderData.payment_status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: "This order has already been paid"
      });
    }

    // Check if order is cancelled
    if (orderData.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: "Cannot pay for a cancelled order"
      });
    }

    // Amount from database (in rupees), convert to paise
    const amountInPaise = Math.round(orderData.total_amount * 100);

    // Generate a short receipt (max 40 characters)
    // Format: rcpt_<last8charsOfOrderId>_<timestamp>
    const shortOrderId = order_id.slice(-8);
    const shortTimestamp = Date.now().toString().slice(-8);
    const receipt = `rcpt_${shortOrderId}_${shortTimestamp}`;

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt,
      notes: {
        order_id: order_id,
        user_id: userId
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Store the razorpay_order_id in our database for later verification
    await query(
      `UPDATE orders SET razorpay_order_id = $1, updated_at = NOW() WHERE id = $2`,
      [razorpayOrder.id, order_id]
    );

    res.status(201).json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt
      },
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error("Razorpay order creation error:", err);
    next(err);
  }
});

/* Verify Payment Signature - SECURED WITH TRANSACTION */
router.post("/verify", paymentLimiter, authenticateToken, requireRole(['CUSTOMER']), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id // Our internal order ID
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification parameters"
      });
    }

    // 1. Create signature for verification
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    //const isAuthentic = expectedSignature === razorpay_signature;
    const isAuthentic = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(razorpay_signature)
    );


    if (!isAuthentic) {
      console.error(`Signature Mismatch! Order: ${order_id}, Payment: ${razorpay_payment_id}`);
      return res.status(400).json({
        success: false,
        message: "Payment verification failed: Invalid signature"
      });
    }

    // 2. Begin Transaction
    await client.query('BEGIN');

    // Security Check: Verify that the razorpay_order_id belongs to this order_id
    // This prevents "Cross-Order Replay" where a valid signature for a cheap order 
    // is used to unlock an expensive order.
    const orderCheck = await client.query(
      "SELECT id, razorpay_order_id, total_amount FROM orders WHERE id = $1",
      [order_id]
    );

    if (orderCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const dbOrder = orderCheck.rows[0];

    // CRITICAL SECURITY CHECK
    if (dbOrder.razorpay_order_id !== razorpay_order_id) {
      await client.query('ROLLBACK');
      console.error(`Security Alert: Mismatched Razorpay Order ID. Expected ${dbOrder.razorpay_order_id}, Got ${razorpay_order_id}`);
      return res.status(400).json({
        success: false,
        message: "Security Error: Mismatched Order Identifiers"
      });
    }

    // 3. Check if payment already recorded (idempotency check at DB level)
    const existingPayment = await client.query(
      "SELECT id FROM payments WHERE razorpay_payment_id = $1",
      [razorpay_payment_id]
    );

    if (existingPayment.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        payment: existingPayment.rows[0]
      });
    }

    // 4. Store payment record
    // We explicitly fetch amount from orders table inside the query sub-select to ensure data consistency
    const insertPayment = await client.query(
      `INSERT INTO payments (order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, payment_method, status, transaction_id, currency, method_details) 
       VALUES ($1, $2, $3, $4, (SELECT total_amount FROM orders WHERE id = $1), 'ONLINE', 'COMPLETED', $3, 'INR', $5) 
       RETURNING *`,
      [order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, JSON.stringify({ source: 'backend_verification' })]
    );

    // 5. Update order payment status
    await client.query(
      `UPDATE orders 
       SET payment_status = 'COMPLETED', 
           payment_method = 'ONLINE', 
           updated_at = NOW() 
       WHERE id = $1`,
      [order_id]
    );

    // 6. Clear user's cart (Failsafe)
    await client.query(
      "DELETE FROM cart_items WHERE user_id = (SELECT user_id FROM orders WHERE id = $1)",
      [order_id]
    );

    // 6. Commit
    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      payment: insertPayment.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Payment verification error:", err);
    next(err);
  } finally {
    client.release();
  }
});

/* Get payment details by order ID */
router.get("/:orderId", authenticateToken, async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    const isAdmin = req.user.role === 'ADMIN';

    let result;
    if (isAdmin) {
      result = await query(
        "SELECT * FROM payments WHERE order_id = $1",
        [orderId]
      );
    } else {
      result = await query(
        `SELECT p.* FROM payments p 
         JOIN orders o ON p.order_id = o.id 
         WHERE p.order_id = $1 AND o.user_id = $2`,
        [orderId, userId]
      );
    }

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    res.json({
      success: true,
      payment: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

/* Razorpay Webhook Handler (SECURED + IDEMPOTENCY) */
router.post("/webhook", express.raw({ type: 'application/json' }), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const signature = req.headers['x-razorpay-signature'];
    //const eventId = req.headers['x-razorpay-event-id']; // Unique event ID from Razorpay
    const eventId = req.headers['x-razorpay-event-id'] || event?.payload?.payment?.entity?.id;

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn("Razorpay webhook secret not configured");
      return res.status(200).json({ received: true });
    }

    // 1. Verify Signature
    let bodyVal = req.body;
    if (!Buffer.isBuffer(bodyVal) && typeof bodyVal !== 'string') {
      // Fallback/Error case
      console.error("Webhook req.body is not a buffer/string:", typeof bodyVal);
      // If somehow it's an object (parsed JSON), we can't faithfully verify signature
      // Try JSON.stringify but it's risky
      bodyVal = JSON.stringify(bodyVal);
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyVal)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("Webhook signature mismatch");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(req.body.toString());

    // 2. Idempotency Check
    const existingEvent = await client.query(
      "SELECT id FROM webhook_events WHERE event_id = $1",
      [eventId] // Prefer header event-id, or use event.payload.id if needed
    );

    if (existingEvent.rows.length > 0) {
      console.log(`Webhook event ${eventId} already processed`);
      return res.status(200).json({ received: true });
    }

    // 3. Process Event in Transaction
    await client.query('BEGIN');

    // Record the event
    await client.query(
      "INSERT INTO webhook_events (event_id, event_type, payload) VALUES ($1, $2, $3)",
      [eventId || `uniq_${Date.now()}_${Math.random()}`, event.event, JSON.stringify(event)]
    );

    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload.payment.entity;
        const razorpayOrderId = payment.order_id;
        const razorpayPaymentId = payment.id;

        // Find our order
        const orderRes = await client.query(
          "SELECT id, total_amount, payment_status FROM orders WHERE razorpay_order_id = $1",
          [razorpayOrderId]
        );

        if (orderRes.rows.length > 0) {
          const order = orderRes.rows[0];

          // Verify amount matches (Razorpay uses paise)
          const expectedAmountPaise = Math.round(order.total_amount * 100);

          // Build method details
          const methodDetails = {
            method: payment.method,
            wallet: payment.wallet,
            bank: payment.bank,
            vpa: payment.vpa,
            card_id: payment.card_id,
            email: payment.email,
            contact: payment.contact
          };

          if (payment.amount === expectedAmountPaise) {
            // Create Payment Record if not exists
            await client.query(`
               INSERT INTO payments(order_id, razorpay_order_id, razorpay_payment_id, amount, payment_method, status, razorpay_signature, transaction_id, currency, method_details)
               VALUES($1, $2, $3, $4, 'ONLINE', 'COMPLETED', 'webhook_verified', $3, $5, $6)
               ON CONFLICT(razorpay_payment_id) DO NOTHING
      `, [order.id, razorpayOrderId, razorpayPaymentId, order.total_amount, payment.currency || 'INR', JSON.stringify(methodDetails)]);

            // Update Order Status
            await client.query(
              "UPDATE orders SET payment_status = 'COMPLETED', payment_method = 'ONLINE', updated_at = NOW() WHERE id = $1",
              [order.id]
            );

            // Clear Cart
            await client.query("DELETE FROM cart_items WHERE user_id = (SELECT user_id FROM orders WHERE id = $1)", [order.id]);
          } else {
            console.error(`Amount mismatch for order ${order.id}: Expected ${expectedAmountPaise}, Got ${payment.amount} `);
            // Potentially flag as suspicious
          }
        }
        break;
      }
      case 'payment.failed': {
        const payment = event.payload.payment.entity;
        // Log failure, maybe update status to FAILED
        if (payment.order_id) {
          // 1. Mark Order as FAILED
          await client.query(
            "UPDATE orders SET payment_status = 'FAILED', updated_at = NOW() WHERE razorpay_order_id = $1",
            [payment.order_id]
          );

          // 2. Fetch internal order_id
          const oRes = await client.query("SELECT id FROM orders WHERE razorpay_order_id = $1", [payment.order_id]);
          if (oRes.rows.length > 0) {
            const internalOrderId = oRes.rows[0].id;
            // 3. Record FAILED payment
            await client.query(`
               INSERT INTO payments (order_id, razorpay_order_id, razorpay_payment_id, amount, payment_method, status, error_description, currency)
               VALUES ($1, $2, $3, $4, 'ONLINE', 'FAILED', $5, $6)
               ON CONFLICT (razorpay_payment_id) DO UPDATE SET status = 'FAILED', error_description = $5, updated_at = NOW()
             `, [internalOrderId, payment.order_id, payment.id, payment.amount / 100, payment.error_description || 'Payment Failed', payment.currency || 'INR']);
          }
        }
        break;
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ received: true });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  } finally {
    client.release();
  }
});

/* Make COD payment (existing functionality) */
router.post("/", authenticateToken, requireRole(['CUSTOMER']), async (req, res, next) => {
  try {
    const { order_id, amount, payment_method } = req.body;
    // Basic COD implementation - for strict security this should also verify amount against DB
    //const orderCheck = await query("SELECT total_amount FROM orders WHERE id = $1", [order_id]);
    const orderCheck = await query(
      "SELECT total_amount, payment_status, user_id FROM orders WHERE id = $1",
      [order_id]
    );

    if (!orderCheck.rows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orderCheck.rows[0];

    if (order.user_id !== req.user.userId) {
      return res.status(403).json({ message: "Not your order" });
    }

    if (order.payment_status === 'COMPLETED') {
      return res.status(400).json({ message: "Order already paid" });
    }


    if (!orderCheck.rows.length) return res.status(404).json({ message: "Order not found" });

    // In a real app we might not pass 'amount' from frontend for COD either, but for now respecting the signature
    const realAmount = orderCheck.rows[0].total_amount;

    const { rows } = await query(
      "INSERT INTO payments (order_id, amount, payment_method, status) VALUES ($1, $2, $3, $4) RETURNING *",
      [order_id, realAmount, payment_method, 'COMPLETED']
    );

    // Also update order status
    await query("UPDATE orders SET payment_status = 'COMPLETED', payment_method = $2 WHERE id = $1", [order_id, payment_method]);

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

/* Process Refund (Admin Only) - SECURED WITH TRANSACTION */
router.post("/refund/:orderId", authenticateToken, requireRole(['ADMIN']), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { orderId } = req.params;

    // 1. Fetch Order & Payment Details
    const result = await client.query(`
      SELECT o.id, o.total_amount, o.payment_status, o.status,
      p.razorpay_payment_id, p.amount as payment_amount 
      FROM orders o
      LEFT JOIN payments p ON o.id = p.order_id AND p.status = 'COMPLETED'
      WHERE o.id = $1
      `, [orderId]);

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const order = result.rows[0];

    // 2. Validation Checks
    if (order.payment_status !== 'COMPLETED') {
      return res.status(400).json({ success: false, message: "Order is not paid" });
    }

    if (!order.razorpay_payment_id) {
      return res.status(400).json({ success: false, message: "No valid online payment found for this order" });
    }

    // 3. Process Refund with Razorpay
    // We refund the full amount recorded in the payment
    const refundAmount = Math.round(order.payment_amount * 100); // Convert to paise

    let razorpayRefund;
    try {
      razorpayRefund = await razorpay.payments.refund(order.razorpay_payment_id, {
        amount: refundAmount,
        notes: {
          reason: "Admin initiated refund",
          order_id: orderId
        }
      });
    } catch (rpError) {
      console.error("Razorpay refund failed:", rpError);
      return res.status(502).json({
        success: false,
        message: "Refund failed at gateway",
        error: rpError.error
      });
    }

    // 4. Update Database Atomically
    await client.query('BEGIN');

    // Update Order Status
    await client.query(`
      UPDATE orders 
      SET status = 'CANCELLED',
      payment_status = 'REFUNDED',
      updated_at = NOW() 
      WHERE id = $1
      `, [orderId]);

    // Update Payment Status (or insert refund record)
    await client.query(`
      UPDATE payments 
      SET status = 'REFUNDED' 
      WHERE razorpay_payment_id = $1
      `, [order.razorpay_payment_id]);

    // Restore Stock (since order is cancelled)
    const orderItems = await client.query("SELECT * FROM order_items WHERE order_id = $1", [orderId]);
    for (const item of orderItems.rows) {
      await client.query(`
        UPDATE products SET stock = stock + $1 WHERE id = $2
      `, [item.quantity, item.product_id]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: "Refund processed successfully",
      refund_id: razorpayRefund.id
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Refund error:", err);
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;