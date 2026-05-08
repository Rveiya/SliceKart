const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

const { query } = require("../config/db.cjs");
const { authenticateToken, requireRole } = require("../middlewares/auth.middleware.cjs");

/* GET all addresses for current user */
router.get("/", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const result = await query(`
      SELECT * FROM addresses 
      WHERE user_id = $1 
      ORDER BY is_default DESC, created_at DESC
    `, [userId]);

        res.json({
            success: true,
            addresses: result.rows,
            count: result.rowCount
        });
    } catch (err) {
        next(err);
    }
});

/* GET address by id */
router.get("/:id", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const result = await query(
            "SELECT * FROM addresses WHERE id = $1 AND user_id = $2",
            [id, userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Address not found" });
        }

        res.json({
            success: true,
            address: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

/* POST create a new address */
router.post("/", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const {
            name,
            flat_no,
            building_name,
            area,
            street,
            city,
            state,
            pincode,
            phone,
            address_type = 'Home',
            is_default = false
        } = req.body;

        // Validate required fields
        if (!name || !street || !city || !state || !pincode || !phone) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // If this is set as default, unset other defaults
        if (is_default) {
            await query(
                "UPDATE addresses SET is_default = false WHERE user_id = $1",
                [userId]
            );
        }

        // Check if this is the first address - make it default
        const existingAddresses = await query(
            "SELECT COUNT(*) FROM addresses WHERE user_id = $1",
            [userId]
        );
        const shouldBeDefault = is_default || existingAddresses.rows[0].count === '0';

        const addressId = uuidv4();
        const result = await query(`
      INSERT INTO addresses (id, user_id, name, flat_no, building_name, area, street, city, state, pincode, phone, address_type, is_default)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [addressId, userId, name, flat_no, building_name, area, street, city, state, pincode, phone, address_type, shouldBeDefault]);

        res.status(201).json({
            success: true,
            message: "Address created successfully",
            address: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

/* PUT update an address */
router.put("/:id", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const {
            name,
            flat_no,
            building_name,
            area,
            street,
            city,
            state,
            pincode,
            phone,
            address_type,
            is_default
        } = req.body;

        // Check if address exists and belongs to user
        const existingAddress = await query(
            "SELECT * FROM addresses WHERE id = $1 AND user_id = $2",
            [id, userId]
        );

        if (!existingAddress.rows.length) {
            return res.status(404).json({ message: "Address not found" });
        }

        // If setting as default, unset other defaults
        if (is_default) {
            await query(
                "UPDATE addresses SET is_default = false WHERE user_id = $1 AND id != $2",
                [userId, id]
            );
        }

        const result = await query(`
      UPDATE addresses 
      SET name = COALESCE($1, name),
          flat_no = COALESCE($2, flat_no),
          building_name = COALESCE($3, building_name),
          area = COALESCE($4, area),
          street = COALESCE($5, street),
          city = COALESCE($6, city),
          state = COALESCE($7, state),
          pincode = COALESCE($8, pincode),
          phone = COALESCE($9, phone),
          address_type = COALESCE($10, address_type),
          is_default = COALESCE($11, is_default),
          updated_at = NOW()
      WHERE id = $12 AND user_id = $13
      RETURNING *
    `, [name, flat_no, building_name, area, street, city, state, pincode, phone, address_type, is_default, id, userId]);

        res.json({
            success: true,
            message: "Address updated successfully",
            address: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

/* PATCH set address as default */
router.patch("/:id/default", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Check if address exists and belongs to user
        const existingAddress = await query(
            "SELECT * FROM addresses WHERE id = $1 AND user_id = $2",
            [id, userId]
        );

        if (!existingAddress.rows.length) {
            return res.status(404).json({ message: "Address not found" });
        }

        // Unset all other defaults
        await query(
            "UPDATE addresses SET is_default = false WHERE user_id = $1",
            [userId]
        );

        // Set this one as default
        const result = await query(
            "UPDATE addresses SET is_default = true, updated_at = NOW() WHERE id = $1 RETURNING *",
            [id]
        );

        res.json({
            success: true,
            message: "Default address updated",
            address: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

/* DELETE an address */
router.delete("/:id", authenticateToken, requireRole(['ADMIN', 'CUSTOMER']), async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        // Check if address is used in any active orders
        const ordersUsingAddress = await query(`
      SELECT COUNT(*) FROM orders 
      WHERE delivery_address_id = $1 
      AND status NOT IN ('DELIVERED', 'CANCELLED')
    `, [id]);

        if (parseInt(ordersUsingAddress.rows[0].count) > 0) {
            return res.status(400).json({
                message: "Cannot delete address used in active orders"
            });
        }

        const result = await query(
            "DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING *",
            [id, userId]
        );

        if (!result.rows.length) {
            return res.status(404).json({ message: "Address not found" });
        }

        // If deleted address was default, set another one as default
        if (result.rows[0].is_default) {
            await query(`
        UPDATE addresses 
        SET is_default = true 
        WHERE user_id = $1 
        AND id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)
      `, [userId]);
        }

        res.json({
            success: true,
            message: "Address deleted successfully"
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
