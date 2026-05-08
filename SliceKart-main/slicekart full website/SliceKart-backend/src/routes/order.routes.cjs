const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const { query } = require("../config/db.cjs");
const { authenticateToken, requireRole } = require("../middlewares/auth.middleware.cjs");

const FREE_DELIVERY_THRESHOLD = 199;
const LOW_ORDER_DELIVERY_FEE = 10;
const LOW_ORDER_HANDLING_FEE = 10;

/* GET all orders for current user */
router.get("/", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const isAdmin = req.user.role === 'ADMIN';

    let result;
    if (isAdmin) {
      // Admin can see all orders
      result = await query(`
        SELECT o.*, 
               p_details.method_details,
               u.fullname as user_name, u.email as user_email,
               a.name as addr_name, a.street, a.city, a.state, a.pincode, a.phone as addr_phone,
               json_agg(json_build_object(
                 'id', oi.id,
                 'product_id', oi.product_id,
                 'quantity', oi.quantity,
                 'price', oi.price,
                 'product', json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'image_url', p.image_url,
                   'volume', p.volume
                 )
               )) as items
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN addresses a ON o.delivery_address_id = a.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN (
            SELECT order_id, method_details 
            FROM payments 
            WHERE status = 'COMPLETED'
        ) p_details ON o.id = p_details.order_id
        GROUP BY o.id, u.fullname, u.email, a.name, a.street, a.city, a.state, a.pincode, a.phone, p_details.method_details
        ORDER BY o.created_at DESC
      `);
    } else {
      // Customer can only see their orders
      result = await query(`
        SELECT o.*, 
               p_details.method_details,
               a.name as addr_name, a.street, a.city, a.state, a.pincode, a.phone as addr_phone,
               dp.name as partner_name, dp.phone as partner_phone, dp.rating as partner_rating, dp.image_url as partner_image,
               json_agg(json_build_object(
                 'id', oi.id,
                 'product_id', oi.product_id,
                 'quantity', oi.quantity,
                 'price', oi.price,
                 'product', json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'image_url', p.image_url,
                   'volume', p.volume
                 )
               )) as items
        FROM orders o
        LEFT JOIN addresses a ON o.delivery_address_id = a.id
        LEFT JOIN delivery_partners dp ON o.delivery_partner_id = dp.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN (
            SELECT order_id, method_details 
            FROM payments 
            WHERE status = 'COMPLETED'
        ) p_details ON o.id = p_details.order_id
        WHERE o.user_id = $1
        GROUP BY o.id, a.name, a.street, a.city, a.state, a.pincode, a.phone, p_details.method_details, dp.name, dp.phone, dp.rating, dp.image_url
        ORDER BY o.created_at DESC
      `, [userId]);
    }

    const orders = result.rows.map(row => ({
      ...row,
      delivery_address: {
        id: row.delivery_address_id,
        name: row.addr_name,
        street: row.street,
        city: row.city,
        state: row.state,
        pincode: row.pincode,
        phone: row.addr_phone
      },
      delivery_partner: row.partner_name ? {
        name: row.partner_name,
        phone: row.partner_phone,
        rating: row.partner_rating,
        image_url: row.partner_image
      } : null
    }));

    res.json({
      success: true,
      orders: orders,
      count: orders.length
    });
  } catch (err) {
    next(err);
  }
});

/* GET order by id */
router.get("/:id", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const isAdmin = req.user.role === 'ADMIN';

    let result;
    if (isAdmin) {
      result = await query(`
        SELECT o.*, 
               p_details.method_details,
               u.fullname as user_name, u.email as user_email,
               a.name as addr_name, a.street, a.city, a.state, a.pincode, a.phone as addr_phone,
               json_agg(json_build_object(
                 'id', oi.id,
                 'product_id', oi.product_id,
                 'quantity', oi.quantity,
                 'price', oi.price,
                 'product', json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'description', p.description,
                   'image_url', p.image_url,
                   'volume', p.volume,
                   'price', p.price
                 )
               )) as items
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN addresses a ON o.delivery_address_id = a.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN (
            SELECT order_id, method_details 
            FROM payments 
            WHERE status = 'COMPLETED'
        ) p_details ON o.id = p_details.order_id
        WHERE o.id = $1
        GROUP BY o.id, u.fullname, u.email, a.name, a.street, a.city, a.state, a.pincode, a.phone, p_details.method_details
      `, [id]);
    } else {
      result = await query(`
        SELECT o.*, 
               p_details.method_details,
               a.name as addr_name, a.street, a.city, a.state, a.pincode, a.phone as addr_phone,
               json_agg(json_build_object(
                 'id', oi.id,
                 'product_id', oi.product_id,
                 'quantity', oi.quantity,
                 'price', oi.price,
                 'product', json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'description', p.description,
                   'image_url', p.image_url,
                   'volume', p.volume,
                   'price', p.price
                 )
               )) as items
        FROM orders o
        LEFT JOIN addresses a ON o.delivery_address_id = a.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN (
            SELECT order_id, method_details 
            FROM payments 
            WHERE status = 'COMPLETED'
        ) p_details ON o.id = p_details.order_id
        WHERE o.id = $1 AND o.user_id = $2
        GROUP BY o.id, a.name, a.street, a.city, a.state, a.pincode, a.phone, p_details.method_details
      `, [id, userId]);
    }

    if (!result.rows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const row = result.rows[0];
    const order = {
      ...row,
      delivery_address: {
        id: row.delivery_address_id,
        name: row.addr_name,
        street: row.street,
        city: row.city,
        state: row.state,
        pincode: row.pincode,
        phone: row.addr_phone
      }
    };

    res.json({
      success: true,
      order
    });
  } catch (err) {
    next(err);
  }
});

/* POST create a new order */
router.post("/", authenticateToken, requireRole(['CUSTOMER']), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      items,
      delivery_address_id,
      payment_method = 'COD'
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ message: "No items provided" });
    }

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

    // Calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const productResult = await query(
        "SELECT id, name, price, stock FROM products WHERE id = $1",
        [item.product_id]
      );

      if (!productResult.rows.length) {
        return res.status(400).json({ message: `Product ${item.product_id} not found` });
      }

      const product = productResult.rows[0];

      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }

      subtotal += product.price * item.quantity;
      orderItems.push({
        product_id: product.id,
        quantity: item.quantity,
        price: product.price
      });
    }

    const actual_delivery_fee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : LOW_ORDER_DELIVERY_FEE;
    const actual_handling_fee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : LOW_ORDER_HANDLING_FEE;

    // Calculate GST (assuming 18%)
    const gst = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : Math.round(subtotal * 0.18 * 100) / 100;
    const total_amount = subtotal + actual_delivery_fee + actual_handling_fee + gst;

    // Create order
    const orderId = uuidv4();
    const orderResult = await query(`
      INSERT INTO orders (id, user_id, delivery_address_id, total_amount, delivery_fee, handling_fee, gst, status, payment_method)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8)
      RETURNING *
    `, [orderId, userId, delivery_address_id, total_amount, actual_delivery_fee, actual_handling_fee, gst, payment_method]);

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

    // Get the complete order with items
    const completeOrder = await query(`
      SELECT o.*, 
             json_agg(json_build_object(
               'id', oi.id,
               'product_id', oi.product_id,
               'quantity', oi.quantity,
               'price', oi.price
             )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1
      GROUP BY o.id
    `, [orderId]);

    // Clear user's cart after successful order creation
    await query("DELETE FROM cart_items WHERE user_id = $1", [userId]);

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: completeOrder.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

/* PATCH update order status (Admin only) */
router.patch("/:id/status", authenticateToken, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, delivery_partner_id, expected_delivery_time, distance } = req.body;

    const validStatuses = ['PENDING', 'ACCEPTED', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    let updateFields = ["status = $1", "updated_at = NOW()"];
    let params = [status];
    let paramCount = 1;

    if (delivery_partner_id !== undefined) {
      paramCount++;
      updateFields.push(`delivery_partner_id = $${paramCount}`);
      params.push(delivery_partner_id);
    }

    if (expected_delivery_time) {
      paramCount++;
      updateFields.push(`expected_delivery_time = $${paramCount}`);
      params.push(expected_delivery_time);
    }

    if (distance) {
      paramCount++;
      updateFields.push(`distance = $${paramCount}`);
      params.push(distance);
    }

    paramCount++;
    params.push(id);

    const result = await query(`
      UPDATE orders 
      SET ${updateFields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `, params);

    if (!result.rows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({
      success: true,
      message: "Order status updated",
      order: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

/* POST cancel order (Customer can cancel pending orders) */
router.post("/:id/cancel", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const isAdmin = req.user.role === 'ADMIN';

    // Get the order
    let orderCheck;
    if (isAdmin) {
      orderCheck = await query("SELECT * FROM orders WHERE id = $1", [id]);
    } else {
      orderCheck = await query("SELECT * FROM orders WHERE id = $1 AND user_id = $2", [id, userId]);
    }

    if (!orderCheck.rows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orderCheck.rows[0];

    // Only pending orders can be cancelled by customers
    if (!isAdmin && order.status !== 'PENDING') {
      return res.status(400).json({ message: "Only pending orders can be cancelled" });
    }

    // Security Fix: Prevent cancelling paid orders via this endpoint to avoid money loss
    if (order.payment_status === 'COMPLETED') {
      return res.status(400).json({
        message: "This order is already paid. Please contact support to initiate a refund."
      });
    }

    // Update order status
    await query(`
      UPDATE orders 
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE id = $1
    `, [id]);

    // Restore stock
    const orderItems = await query("SELECT * FROM order_items WHERE order_id = $1", [id]);
    for (const item of orderItems.rows) {
      await query(`
        UPDATE products SET stock = stock + $1 WHERE id = $2
      `, [item.quantity, item.product_id]);
    }

    res.json({
      success: true,
      message: "Order cancelled successfully"
    });
  } catch (err) {
    next(err);
  }
});

/* GET track order */
router.get("/:id/track", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const isAdmin = req.user.role === 'ADMIN';

    let result;
    if (isAdmin) {
      result = await query(`
        SELECT o.*, 
               a.name as delivery_name, a.street, a.city, a.state, a.pincode, a.phone as delivery_phone,
               dp.name as partner_name, dp.phone as partner_phone, dp.rating as partner_rating, dp.image_url as partner_image,
               json_agg(json_build_object(
                 'id', oi.id,
                 'quantity', oi.quantity,
                 'price', oi.price,
                 'product', json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'image_url', p.image_url,
                   'volume', p.volume
                 )
               )) as items
        FROM orders o
        LEFT JOIN addresses a ON o.delivery_address_id = a.id
        LEFT JOIN delivery_partners dp ON o.delivery_partner_id = dp.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.id = $1
        GROUP BY o.id, a.name, a.street, a.city, a.state, a.pincode, a.phone, dp.name, dp.phone, dp.rating, dp.image_url
      `, [id]);
    } else {
      result = await query(`
        SELECT o.*, 
               a.name as delivery_name, a.street, a.city, a.state, a.pincode, a.phone as delivery_phone,
               dp.name as partner_name, dp.phone as partner_phone, dp.rating as partner_rating, dp.image_url as partner_image,
               json_agg(json_build_object(
                 'id', oi.id,
                 'quantity', oi.quantity,
                 'price', oi.price,
                 'product', json_build_object(
                   'id', p.id,
                   'name', p.name,
                   'image_url', p.image_url,
                   'volume', p.volume
                 )
               )) as items
        FROM orders o
        LEFT JOIN addresses a ON o.delivery_address_id = a.id
        LEFT JOIN delivery_partners dp ON o.delivery_partner_id = dp.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.id = $1 AND o.user_id = $2
        GROUP BY o.id, a.name, a.street, a.city, a.state, a.pincode, a.phone, dp.name, dp.phone, dp.rating, dp.image_url
      `, [id, userId]);
    }

    if (!result.rows.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = result.rows[0];

    // Format response
    const trackingInfo = {
      id: order.id,
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      total_amount: order.total_amount,
      delivery_fee: order.delivery_fee,
      handling_fee: order.handling_fee,
      gst: order.gst,
      expected_delivery_time: order.expected_delivery_time,
      distance: order.distance,
      created_at: order.created_at,
      items: order.items,
      delivery_address: {
        name: order.delivery_name,
        street: order.street,
        city: order.city,
        state: order.state,
        pincode: order.pincode,
        phone: order.delivery_phone
      },
      delivery_partner: order.partner_name ? {
        name: order.partner_name,
        phone: order.partner_phone,
        rating: order.partner_rating,
        image_url: order.partner_image
      } : null
    };

    res.json({
      success: true,
      order: trackingInfo
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;