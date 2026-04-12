const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const { query } = require("../config/db.cjs");
const { authenticateToken, requireRole } = require("../middlewares/auth.middleware.cjs");

/* GET current user (me endpoint) */
router.get("/me", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await query(`
      SELECT id, fullname, email, role, phone, created_at
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    // Get default address
    const addressResult = await query(`
      SELECT * FROM addresses 
      WHERE user_id = $1 AND is_default = true
      LIMIT 1
    `, [userId]);

    res.json({
      success: true,
      user: {
        ...user,
        address: addressResult.rows[0] || null
      }
    });
  } catch (err) {
    next(err);
  }
});

/* GET all users (Admin only) */
router.get("/", authenticateToken, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT id, fullname, email, role, phone, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      users: rows,
      count: rows.length
    });
  } catch (err) {
    next(err);
  }
});

/* GET user by id (Admin only) */
router.get("/:id", authenticateToken, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      "SELECT id, fullname, email, role, phone, created_at FROM users WHERE id = $1",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      user: rows[0]
    });
  } catch (err) {
    next(err);
  }
});

/* PUT update current user profile */
router.put("/me", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { fullname, phone } = req.body;

    const result = await query(`
      UPDATE users 
      SET fullname = COALESCE($1, fullname),
          phone = COALESCE($2, phone),
          updated_at = NOW()
      WHERE id = $3
      RETURNING id, fullname, email, role, phone
    `, [fullname, phone, userId]);

    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

/* PUT change password */
router.put("/me/password", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    // Get current password hash
    const userResult = await query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update password
    await query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [newPasswordHash, userId]
    );

    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (err) {
    next(err);
  }
});

/* PUT update user role (Admin only) */
router.put("/:id/role", authenticateToken, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['ADMIN', 'CUSTOMER'].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Prevent admin from changing their own role
    if (id === req.user.userId) {
      return res.status(400).json({ message: "Cannot change your own role" });
    }

    const result = await query(`
      UPDATE users 
      SET role = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, fullname, email, role
    `, [role, id]);

    if (!result.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      message: "User role updated",
      user: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

/* DELETE a user by id (Admin only) */
router.delete("/:id", authenticateToken, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user.userId) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    const { rowCount } = await query(
      "DELETE FROM users WHERE id = $1",
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;