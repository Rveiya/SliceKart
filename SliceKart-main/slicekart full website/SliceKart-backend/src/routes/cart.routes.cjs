const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const { query } = require("../config/db.cjs");
const { authenticateToken, requireRole } = require("../middlewares/auth.middleware.cjs");

/* GET cart for current user */
router.get("/", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await query(`
      SELECT ci.*, 
             p.id as product_id, p.name, p.description, p.price, p.original_price, 
             p.discount, p.category, p.image_url, p.volume, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = $1
      ORDER BY ci.created_at DESC
    `, [userId]);

    const items = result.rows.map(row => ({
      id: row.id,
      quantity: row.quantity,
      subscription_type: row.subscription_type,
      preferred_delivery_time: row.preferred_delivery_time,
      product: {
        id: row.product_id,
        name: row.name,
        description: row.description,
        price: row.price,
        original_price: row.original_price,
        discount: row.discount,
        category: row.category,
        image_url: row.image_url,
        volume: row.volume,
        stock: row.stock
      }
    }));

    const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    res.json({
      success: true,
      items,
      total,
      count: items.length
    });
  } catch (err) {
    next(err);
  }
});

/* POST add item to cart */
router.post("/", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { product_id, quantity = 1, subscription_type = 'one-time', preferred_delivery_time } = req.body;

    if (!product_id) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Check if product exists
    const productCheck = await query(
      "SELECT id, stock FROM products WHERE id = $1",
      [product_id]
    );

    if (!productCheck.rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = productCheck.rows[0];

    if (product.stock < quantity) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    // Check if item already exists in cart with same subscription type
    const existingItem = await query(
      "SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2 AND subscription_type = $3",
      [userId, product_id, subscription_type]
    );

    let result;
    if (existingItem.rows.length) {
      // Update quantity
      const newQuantity = existingItem.rows[0].quantity + quantity;
      if (newQuantity > product.stock) {
        return res.status(400).json({ message: "Insufficient stock" });
      }

      result = await query(
        "UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
        [newQuantity, existingItem.rows[0].id]
      );
    } else {
      // Add new item
      const cartItemId = uuidv4();
      result = await query(`
        INSERT INTO cart_items (id, user_id, product_id, quantity, subscription_type, preferred_delivery_time)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [cartItemId, userId, product_id, quantity, subscription_type, preferred_delivery_time || null]);
    }

    res.status(201).json({
      success: true,
      message: "Item added to cart",
      item: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

/* PUT update cart item quantity */
router.put("/:id", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    // Get the cart item
    const cartItem = await query(
      "SELECT * FROM cart_items WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (!cartItem.rows.length) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    // If quantity is 0, delete the item
    if (quantity === 0) {
      await query("DELETE FROM cart_items WHERE id = $1", [id]);
      return res.json({
        success: true,
        message: "Item removed from cart"
      });
    }

    // Check stock
    const productCheck = await query(
      "SELECT stock FROM products WHERE id = $1",
      [cartItem.rows[0].product_id]
    );

    if (productCheck.rows[0].stock < quantity) {
      return res.status(400).json({ message: "Insufficient stock" });
    }

    // Update quantity
    const result = await query(
      "UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [quantity, id]
    );

    res.json({
      success: true,
      message: "Cart updated",
      item: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

/* DELETE remove item from cart */
router.delete("/:id", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await query(
      "DELETE FROM cart_items WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    res.json({
      success: true,
      message: "Item removed from cart"
    });
  } catch (err) {
    next(err);
  }
});

/* DELETE clear entire cart */
router.delete("/", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
  try {
    const userId = req.user.userId;

    await query("DELETE FROM cart_items WHERE user_id = $1", [userId]);

    res.json({
      success: true,
      message: "Cart cleared"
    });
  } catch (err) {
    next(err);
  }
});

/* POST validate cart items against current stock */
router.post("/validate", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Get all cart items with current product stock
    const result = await query(`
      SELECT ci.*, 
             p.id as product_id, p.name, p.price, p.stock, p.image_url, p.volume
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = $1
    `, [userId]);

    const validItems = [];
    const insufficientStockItems = [];
    const outOfStockItems = [];

    for (const row of result.rows) {
      const item = {
        id: row.id,
        quantity: row.quantity,
        available_stock: row.stock,
        product: {
          id: row.product_id,
          name: row.name,
          price: row.price,
          image_url: row.image_url,
          volume: row.volume,
          stock: row.stock
        }
      };

      if (row.stock === 0) {
        outOfStockItems.push(item);
      } else if (row.quantity > row.stock) {
        insufficientStockItems.push({
          ...item,
          max_available: row.stock,
          requested_quantity: row.quantity
        });
      } else {
        validItems.push(item);
      }
    }

    const hasIssues = outOfStockItems.length > 0 || insufficientStockItems.length > 0;

    res.json({
      success: true,
      valid: !hasIssues,
      validItems,
      insufficientStockItems,
      outOfStockItems,
      summary: {
        totalItems: result.rows.length,
        validCount: validItems.length,
        insufficientCount: insufficientStockItems.length,
        outOfStockCount: outOfStockItems.length
      }
    });
  } catch (err) {
    next(err);
  }
});

/* POST adjust cart to available stock (auto-fix stock issues) */
router.post("/adjust", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Get all cart items with current product stock
    const result = await query(`
      SELECT ci.*, 
             p.id as product_id, p.name, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = $1
    `, [userId]);

    const adjustments = [];

    for (const row of result.rows) {
      if (row.stock === 0) {
        // Remove out of stock items
        await query("DELETE FROM cart_items WHERE id = $1", [row.id]);
        adjustments.push({
          product_id: row.product_id,
          product_name: row.name,
          action: 'removed',
          reason: 'out_of_stock',
          previous_quantity: row.quantity
        });
      } else if (row.quantity > row.stock) {
        // Adjust quantity to available stock
        await query(
          "UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2",
          [row.stock, row.id]
        );
        adjustments.push({
          product_id: row.product_id,
          product_name: row.name,
          action: 'adjusted',
          reason: 'insufficient_stock',
          previous_quantity: row.quantity,
          new_quantity: row.stock
        });
      }
    }

    // Fetch the updated cart
    const updatedCart = await query(`
      SELECT ci.*, 
             p.id as product_id, p.name, p.description, p.price, p.original_price, 
             p.discount, p.category, p.image_url, p.volume, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = $1
      ORDER BY ci.created_at DESC
    `, [userId]);

    const items = updatedCart.rows.map(row => ({
      id: row.id,
      quantity: row.quantity,
      subscription_type: row.subscription_type,
      product: {
        id: row.product_id,
        name: row.name,
        description: row.description,
        price: row.price,
        original_price: row.original_price,
        discount: row.discount,
        category: row.category,
        image_url: row.image_url,
        volume: row.volume,
        stock: row.stock
      }
    }));

    const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

    res.json({
      success: true,
      message: adjustments.length > 0
        ? `Cart adjusted: ${adjustments.length} item(s) modified`
        : 'No adjustments needed',
      adjustments,
      items,
      total,
      count: items.length
    });
  } catch (err) {
    next(err);
  }
});

/* POST sync cart (for syncing localStorage cart with server) */
router.post("/sync", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Items must be an array" });
    }

    // Process each item from the local cart
    for (const item of items) {
      if (!item.product_id || !item.quantity) continue;

      const subscriptionType = item.subscription_type || 'one-time';

      // Verify product exists and has stock
      const productCheck = await query(
        "SELECT id, stock FROM products WHERE id = $1",
        [item.product_id]
      );

      if (!productCheck.rows.length) continue;

      const productStock = productCheck.rows[0].stock;
      if (productStock === 0) continue;

      // Check if this item already exists in the user's DB cart
      const existingItem = await query(
        "SELECT id, quantity FROM cart_items WHERE user_id = $1 AND product_id = $2 AND subscription_type = $3",
        [userId, item.product_id, subscriptionType]
      );

      if (existingItem.rows.length > 0) {
        // Update existing item
        const currentDbQuantity = existingItem.rows[0].quantity;
        let newQuantity = currentDbQuantity + item.quantity;

        // Cap at available stock
        if (newQuantity > productStock) {
          newQuantity = productStock;
        }

        await query(
          "UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2",
          [newQuantity, existingItem.rows[0].id]
        );
      } else {
        // Insert new item
        let quantity = item.quantity;

        // Cap at available stock
        if (quantity > productStock) {
          quantity = productStock;
        }

        const cartItemId = uuidv4();
        await query(`
          INSERT INTO cart_items (id, user_id, product_id, quantity, subscription_type)
          VALUES ($1, $2, $3, $4, $5)
        `, [cartItemId, userId, item.product_id, quantity, subscriptionType]);
      }
    }

    // Return updated cart
    const result = await query(`
      SELECT ci.*, 
             p.id as product_id, p.name, p.description, p.price, p.original_price, 
             p.discount, p.category, p.image_url, p.volume, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = $1
      ORDER BY ci.created_at DESC
    `, [userId]);

    const syncedItems = result.rows.map(row => ({
      id: row.id,
      quantity: row.quantity,
      subscription_type: row.subscription_type,
      product: {
        id: row.product_id,
        name: row.name,
        description: row.description,
        price: row.price,
        original_price: row.original_price,
        discount: row.discount,
        category: row.category,
        image_url: row.image_url,
        volume: row.volume,
        stock: row.stock
      }
    }));

    res.json({
      success: true,
      message: "Cart synced successfully",
      items: syncedItems
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;