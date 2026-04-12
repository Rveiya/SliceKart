const express = require("express");
const router = express.Router();

const { query } = require("../config/db.cjs");
const { authenticateToken, requireRole } = require("../middlewares/auth.middleware.cjs");
const { getPresignedUrl, getMultiplePresignedUrls } = require("../config/r2.cjs");

/**
 * Helper function to add presigned URLs to product images
 * @param {object} product - Product object
 * @returns {Promise<object>} - Product with presigned URLs
 */
const addPresignedUrlsToProduct = async (product) => {
  if (!product) return product;

  const productCopy = { ...product };

  // Handle main image (stored as R2 key)
  if (productCopy.image_url && productCopy.image_url.startsWith('products/')) {
    const urlResult = await getPresignedUrl(productCopy.image_url, 3600);
    productCopy.image_url_signed = urlResult.success ? urlResult.url : null;
  } else {
    productCopy.image_url_signed = productCopy.image_url;
  }

  // Handle multiple images array
  if (productCopy.images && Array.isArray(productCopy.images) && productCopy.images.length > 0) {
    const r2Keys = productCopy.images.filter(img => img && img.startsWith('products/'));
    if (r2Keys.length > 0) {
      const presignedResults = await getMultiplePresignedUrls(r2Keys, 3600);
      productCopy.images_signed = presignedResults.map(r => r.url);
    } else {
      productCopy.images_signed = productCopy.images;
    }
  } else {
    productCopy.images_signed = [];
  }

  return productCopy;
};

/**
 * Helper function to add presigned URLs to multiple products
 * @param {Array} products - Array of product objects
 * @returns {Promise<Array>} - Products with presigned URLs
 */
const addPresignedUrlsToProducts = async (products) => {
  return Promise.all(products.map(addPresignedUrlsToProduct));
};

/* GET all products (public) */
router.get("/", async (req, res, next) => {
  try {
    const { category, search, min_price, max_price, sort } = req.query;

    let queryText = "SELECT * FROM products WHERE is_active = true";
    let params = [];
    let paramCount = 0;

    // Filter by category
    if (category) {
      paramCount++;
      queryText += ` AND category = $${paramCount}`;
      params.push(category);
    }

    // Search by name or description
    if (search) {
      paramCount++;
      queryText += ` AND (LOWER(name) LIKE $${paramCount} OR LOWER(description) LIKE $${paramCount})`;
      params.push(`%${search.toLowerCase()}%`);
    }

    // Price range filters
    if (min_price) {
      paramCount++;
      queryText += ` AND price >= $${paramCount}`;
      params.push(parseFloat(min_price));
    }
    if (max_price) {
      paramCount++;
      queryText += ` AND price <= $${paramCount}`;
      params.push(parseFloat(max_price));
    }

    // Sorting
    if (sort === 'price_asc') {
      queryText += " ORDER BY price ASC";
    } else if (sort === 'price_desc') {
      queryText += " ORDER BY price DESC";
    } else if (sort === 'rating') {
      queryText += " ORDER BY rating DESC";
    } else if (sort === 'newest') {
      queryText += " ORDER BY created_at DESC";
    } else {
      queryText += " ORDER BY created_at DESC";
    }

    const result = await query(queryText, params);

    // Add presigned URLs to all products
    const productsWithUrls = await addPresignedUrlsToProducts(result.rows);

    res.json({
      message: "Products retrieved successfully",
      success: true,
      products: productsWithUrls,
      count: result.rowCount
    });
  } catch (err) {
    next(err);
  }
});

/* GET product by id (public) */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      "SELECT * FROM products WHERE id = $1 AND is_active = true",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Add presigned URLs to product
    const productWithUrls = await addPresignedUrlsToProduct(rows[0]);

    res.json({
      message: "Product retrieved successfully",
      success: true,
      product: productWithUrls
    });
  } catch (err) {
    next(err);
  }
});

/* POST create a new product */
router.post("/", authenticateToken, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const {
      name,
      category,
      price,
      stock,
      description,
      volume,
      benefits,
      image_url,
      images,
      return_policy,
      cash_on_delivery,
      allow_cancellation,
      nutrition // Added nutrition
    } = req.body;

    const { rows } = await query(
      `INSERT INTO products (name, description, price, category, image_url, images, return_policy, cash_on_delivery, allow_cancellation, stock, volume, benefits, nutrition) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        name, 
        description, 
        price, 
        category, 
        image_url, 
        images || [], 
        return_policy, 
        cash_on_delivery, 
        allow_cancellation, 
        stock, 
        volume, 
        benefits || [], 
        nutrition || {}
      ]
    );

    // Add presigned URLs to response
    const productWithUrls = await addPresignedUrlsToProduct(rows[0]);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: productWithUrls
    });
  } catch (err) {
    next(err);
  }
});

/* PUT update a product by id */
router.put("/:id", authenticateToken, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      category, 
      price, 
      stock, 
      description, 
      volume, 
      benefits, 
      image_url, 
      images, 
      return_policy, 
      cash_on_delivery, 
      allow_cancellation, 
      nutrition,
      is_active
    } = req.body;

    const { rows } = await query(
      `UPDATE products SET 
        name = $1, 
        description = $2, 
        price = $3, 
        category = $4, 
        image_url = $5, 
        stock = $6, 
        volume = $7, 
        benefits = $8, 
        images = $9, 
        return_policy = $10, 
        cash_on_delivery = $11, 
        allow_cancellation = $12, 
        nutrition = $13,
        is_active = COALESCE($14, is_active)
       WHERE id = $15 RETURNING *`,
      [
        name, 
        description, 
        price, 
        category, 
        image_url, 
        stock, 
        volume, 
        benefits, 
        images || [], 
        return_policy, 
        cash_on_delivery, 
        allow_cancellation, 
        nutrition || {}, 
        is_active,
        id
      ]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Add presigned URLs to response
    const productWithUrls = await addPresignedUrlsToProduct(rows[0]);
    res.json(productWithUrls);
  } catch (err) {
    next(err);
  }
});

/* PATCH update a product status or partial update */
router.patch("/:id", authenticateToken, requireRole(['ADMIN']), async (req, res, next) => {
    try {
      const { id } = req.params;
      // For PATCH, we construct the query dynamically based on fields provided
      // But for simplicity/logic consistency with existing code, often PATCH is used for status toggle 
      // or partials. If it's a full update partial, we might need a dynamic query builder.
      // Given the previous code just replicated PUT logic but with fewer fields, 
      // I'll stick to a dynamic approach or just the status update if that's what's mainly used.
      // However, the original code had a fixed query. Let's make it support at least status update efficiently.
      
      const fields = req.body;
      const keys = Object.keys(fields);
      
      if (keys.length === 0) {
          return res.status(400).json({ message: "No fields to update" });
      }

      // Simple dynamic query construction
      const clauses = keys.map((key, i) => `${key} = $${i + 1}`);
      const values = keys.map(key => fields[key]);
      
      const queryText = `UPDATE products SET ${clauses.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`;
      
      const { rows } = await query(queryText, [...values, id]);

      if (!rows.length) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      const productWithUrls = await addPresignedUrlsToProduct(rows[0]);
      res.json(productWithUrls);
    } catch (err) {
      next(err);
    }
  });

/* DELETE a product by id */
router.delete("/:id", authenticateToken, requireRole(['ADMIN']), async (req, res, next) => {
  try {
    const { id } = req.params;

    // First, fetch the product to get image keys
    const { rows } = await query(
      "SELECT image_url, images FROM products WHERE id = $1",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = rows[0];
    const imagesToDelete = [];

    // Collect main image if it's an R2 key
    if (product.image_url && product.image_url.startsWith('products/')) {
      imagesToDelete.push(product.image_url);
    }

    // Collect all additional images that are R2 keys
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach(img => {
        if (img && img.startsWith('products/') && !imagesToDelete.includes(img)) {
          imagesToDelete.push(img);
        }
      });
    }

    // Delete images from R2 (don't block on errors)
    if (imagesToDelete.length > 0) {
      const { deleteMultipleFromR2 } = require("../config/r2.cjs");
      try {
        const deleteResult = await deleteMultipleFromR2(imagesToDelete);
        console.log(`🗑️ Deleted ${deleteResult.deletedCount}/${imagesToDelete.length} images from R2 for product ${id}`);
      } catch (r2Error) {
        console.error(`⚠️ Failed to delete R2 images for product ${id}:`, r2Error.message);
        // Continue with product deletion even if R2 deletion fails
      }
    }

    // Delete product from database
    const { rowCount } = await query(
      "DELETE FROM products WHERE id = $1",
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
