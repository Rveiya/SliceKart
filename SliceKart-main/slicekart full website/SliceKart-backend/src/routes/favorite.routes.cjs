const express = require("express");
const router = express.Router();

const { query } = require("../config/db.cjs");
const { authenticateToken } = require("../middlewares/auth.middleware.cjs");

/* GET all favorites for the logged in user */
router.get("/", authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.userId;

        // Join with products table to get full product details
        const text = `
      SELECT p.*, f.id as favorite_id, f.created_at as favorited_at
      FROM favorites f
      JOIN products p ON f.product_id = p.id
      WHERE f.user_id = $1
      ORDER BY f.created_at DESC
    `;

        const { rows } = await query(text, [userId]);

        res.json({
            message: "Favorites retrieved successfully",
            success: true,
            favorites: rows
        });
    } catch (err) {
        next(err);
    }
});

/* POST add a product to favorites */
router.post("/", authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { product_id } = req.body;

        if (!product_id) {
            return res.status(400).json({ message: "Product ID is required" });
        }

        const { rows } = await query(
            "INSERT INTO favorites (user_id, product_id) VALUES ($1, $2) ON CONFLICT (user_id, product_id) DO NOTHING RETURNING *",
            [userId, product_id]
        );

        if (rows.length === 0) {
            return res.json({ message: "Product already in favorites" });
        }

        res.status(201).json({
            message: "Added to favorites",
            success: true,
            favorite: rows[0]
        });
    } catch (err) {
        next(err);
    }
});

/* DELETE remove a product from favorites */
router.delete("/:product_id", authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { product_id } = req.params;

        const { rowCount } = await query(
            "DELETE FROM favorites WHERE user_id = $1 AND product_id = $2",
            [userId, product_id]
        );

        if (rowCount === 0) {
            return res.status(404).json({ message: "Favorite not found" });
        }

        res.json({
            message: "Removed from favorites",
            success: true
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
