const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const { query } = require("../config/db.cjs");
const { authenticateToken, requireRole } = require("../middlewares/auth.middleware.cjs");

// All admin routes require authentication and ADMIN role
router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

/* ===================== DASHBOARD STATS ===================== */
router.get("/dashboard/stats", async (req, res, next) => {
    try {
        // Get total users count
        const usersResult = await query("SELECT COUNT(*) as count FROM users WHERE role = 'CUSTOMER'");

        // Get total products count
        const productsResult = await query("SELECT COUNT(*) as count FROM products WHERE is_active = true");

        // Get total orders count and revenue
        const ordersResult = await query(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as total_revenue,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_orders
      FROM orders
    `);

        // Get today's orders
        const todayOrdersResult = await query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as revenue
      FROM orders 
      WHERE DATE(created_at) = CURRENT_DATE
    `);

        // Get this month's orders
        const monthOrdersResult = await query(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as revenue
      FROM orders 
      WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
    `);

        // Get low stock products (stock < 10)
        const lowStockResult = await query("SELECT COUNT(*) as count FROM products WHERE stock < 10 AND is_active = true");

        // Get delivery partners count
        const partnersResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_available = true THEN 1 END) as available
      FROM delivery_partners
    `);

        res.json({
            success: true,
            stats: {
                customers: parseInt(usersResult.rows[0].count),
                products: parseInt(productsResult.rows[0].count),
                totalOrders: parseInt(ordersResult.rows[0].total_orders),
                totalRevenue: parseFloat(ordersResult.rows[0].total_revenue),
                pendingOrders: parseInt(ordersResult.rows[0].pending_orders),
                deliveredOrders: parseInt(ordersResult.rows[0].delivered_orders),
                cancelledOrders: parseInt(ordersResult.rows[0].cancelled_orders),
                todayOrders: parseInt(todayOrdersResult.rows[0].count),
                todayRevenue: parseFloat(todayOrdersResult.rows[0].revenue),
                monthOrders: parseInt(monthOrdersResult.rows[0].count),
                monthRevenue: parseFloat(monthOrdersResult.rows[0].revenue),
                lowStockProducts: parseInt(lowStockResult.rows[0].count),
                deliveryPartners: parseInt(partnersResult.rows[0].total),
                availablePartners: parseInt(partnersResult.rows[0].available)
            }
        });
    } catch (err) {
        next(err);
    }
});

/* ===================== RECENT ORDERS ===================== */
router.get("/dashboard/recent-orders", async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 5;

        const result = await query(`
      SELECT o.id, o.total_amount, o.status, o.payment_status, o.created_at,
             u.fullname as customer_name, u.email as customer_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT $1
    `, [limit]);

        res.json({
            success: true,
            orders: result.rows
        });
    } catch (err) {
        next(err);
    }
});

/* ===================== TOP PRODUCTS ===================== */
router.get("/dashboard/top-products", async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 5;

        const result = await query(`
      SELECT p.id, p.name, p.image_url, p.price, p.stock,
             COALESCE(SUM(oi.quantity), 0) as total_sold,
             COALESCE(SUM(oi.quantity * oi.price), 0) as total_revenue
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status != 'CANCELLED'
      WHERE p.is_active = true
      GROUP BY p.id
      ORDER BY total_sold DESC
      LIMIT $1
    `, [limit]);

        res.json({
            success: true,
            products: result.rows
        });
    } catch (err) {
        next(err);
    }
});

/* ===================== USER MANAGEMENT ===================== */

// Get all users
router.get("/users", async (req, res, next) => {
    try {
        const { role, search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let queryText = "SELECT id, fullname, email, phone, role, created_at FROM users WHERE 1=1";
        let countQuery = "SELECT COUNT(*) FROM users WHERE 1=1";
        let params = [];
        let countParams = [];
        let paramCount = 0;

        if (role) {
            paramCount++;
            queryText += ` AND role = $${paramCount}`;
            countQuery += ` AND role = $${paramCount}`;
            params.push(role);
            countParams.push(role);
        }

        if (search) {
            paramCount++;
            queryText += ` AND (LOWER(fullname) LIKE $${paramCount} OR LOWER(email) LIKE $${paramCount})`;
            countQuery += ` AND (LOWER(fullname) LIKE $${paramCount} OR LOWER(email) LIKE $${paramCount})`;
            const searchTerm = `%${search.toLowerCase()}%`;
            params.push(searchTerm);
            countParams.push(searchTerm);
        }

        queryText += " ORDER BY created_at DESC";
        queryText += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(parseInt(limit), offset);

        const [usersResult, countResult] = await Promise.all([
            query(queryText, params),
            query(countQuery, countParams)
        ]);

        res.json({
            success: true,
            users: usersResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (err) {
        next(err);
    }
});

// Export users to Excel
router.get("/users/export", async (req, res, next) => {
    try {
        const { role, search } = req.query;

        let queryText = "SELECT id, fullname, email, phone, role, created_at FROM users WHERE 1=1";
        let params = [];
        let paramCount = 0;

        if (role) {
            paramCount++;
            queryText += ` AND role = $${paramCount}`;
            params.push(role);
        }

        if (search) {
            paramCount++;
            queryText += ` AND (LOWER(fullname) LIKE $${paramCount} OR LOWER(email) LIKE $${paramCount})`;
            const searchTerm = `%${search.toLowerCase()}%`;
            params.push(searchTerm);
        }

        queryText += " ORDER BY created_at DESC";

        const usersResult = await query(queryText, params);

        // Get order stats for each user
        const userIds = usersResult.rows.map(u => u.id);
        let orderStatsMap = {};
        if (userIds.length > 0) {
            const statsResult = await query(
                `SELECT user_id, COUNT(*) as order_count, 
                        COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) as total_spent
                 FROM orders
                 WHERE user_id = ANY($1)
                 GROUP BY user_id`,
                [userIds]
            );
            statsResult.rows.forEach(row => {
                orderStatsMap[row.user_id] = {
                    order_count: parseInt(row.order_count),
                    total_spent: parseFloat(row.total_spent)
                };
            });
        }

        const sheetData = usersResult.rows.map(user => ({
            "User ID": user.id,
            "Full Name": user.fullname || "",
            "Email": user.email || "",
            "Phone": user.phone || "",
            "Role": user.role,
            "Total Orders": (orderStatsMap[user.id]?.order_count) || 0,
            "Total Spent": (orderStatsMap[user.id]?.total_spent) || 0,
            "Joined Date": new Date(user.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sheetData);
        ws["!cols"] = [
            { wch: 38 }, // User ID
            { wch: 22 }, // Full Name
            { wch: 28 }, // Email
            { wch: 15 }, // Phone
            { wch: 12 }, // Role
            { wch: 14 }, // Total Orders
            { wch: 14 }, // Total Spent
            { wch: 22 }, // Joined Date
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Users");

        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        const filename = `users_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(Buffer.from(buf));
    } catch (err) {
        next(err);
    }
});

// Create user (admin can create users/admins with password)
router.post("/users", async (req, res, next) => {
    try {
        const { fullname, email, password, phone, role } = req.body;

        // Validate required fields
        if (!fullname || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Full name, email and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        // Validate role
        const validRoles = ['ADMIN', 'CUSTOMER'];
        const userRole = role && validRoles.includes(role) ? role : 'CUSTOMER';

        // Check if email already exists
        const exists = await query(
            "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
            [email]
        );

        if (exists.rows.length) {
            return res.status(409).json({
                success: false,
                message: "A user with this email already exists"
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Insert user
        const result = await query(
            `INSERT INTO users (fullname, email, password_hash, phone, role)
             VALUES ($1, LOWER($2), $3, $4, $5)
             RETURNING id, fullname, email, phone, role, created_at`,
            [fullname, email, hashedPassword, phone || null, userRole]
        );

        res.status(201).json({
            success: true,
            message: `${userRole === 'ADMIN' ? 'Admin' : 'User'} created successfully`,
            user: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

// Get user by ID
router.get("/users/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        const userResult = await query(
            "SELECT id, fullname, email, phone, role, created_at, updated_at FROM users WHERE id = $1",
            [id]
        );

        if (!userResult.rows.length) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Get user's orders count
        const ordersResult = await query(
            "SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total_spent FROM orders WHERE user_id = $1 AND status != 'CANCELLED'",
            [id]
        );

        // Get user's addresses
        const addressesResult = await query(
            "SELECT * FROM addresses WHERE user_id = $1",
            [id]
        );

        res.json({
            success: true,
            user: {
                ...userResult.rows[0],
                ordersCount: parseInt(ordersResult.rows[0].count),
                totalSpent: parseFloat(ordersResult.rows[0].total_spent),
                addresses: addressesResult.rows
            }
        });
    } catch (err) {
        next(err);
    }
});

// Update user role
router.patch("/users/:id/role", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['ADMIN', 'CUSTOMER'].includes(role)) {
            return res.status(400).json({ success: false, message: "Invalid role" });
        }

        // Prevent self-demotion
        if (id === req.user.userId && role !== 'ADMIN') {
            return res.status(400).json({ success: false, message: "Cannot change your own role" });
        }

        const result = await query(
            "UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, fullname, email, role",
            [role, id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "User not found" });
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

// Delete user
router.delete("/users/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion
        if (id === req.user.userId) {
            return res.status(400).json({ success: false, message: "Cannot delete your own account" });
        }

        const result = await query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({
            success: true,
            message: "User deleted successfully"
        });
    } catch (err) {
        next(err);
    }
});

/* ===================== PRODUCTS MANAGEMENT ===================== */

const { getPresignedUrl, getMultiplePresignedUrls } = require("../config/r2.cjs");

/**
 * Helper function to add presigned URLs to product images
 */
const addPresignedUrlsToProduct = async (product) => {
    if (!product) return product;
    const productCopy = { ...product };

    if (productCopy.image_url && productCopy.image_url.startsWith('products/')) {
        const urlResult = await getPresignedUrl(productCopy.image_url, 3600);
        productCopy.image_url_signed = urlResult.success ? urlResult.url : null;
    } else {
        productCopy.image_url_signed = productCopy.image_url;
    }

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

const addPresignedUrlsToProducts = async (products) => {
    return Promise.all(products.map(addPresignedUrlsToProduct));
};

// Get all products (including inactive)
router.get("/products", async (req, res, next) => {
    try {
        const { category, search, status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let queryText = "SELECT * FROM products WHERE 1=1";
        let countQuery = "SELECT COUNT(*) FROM products WHERE 1=1";
        let params = [];
        let countParams = [];
        let paramCount = 0;

        if (category) {
            paramCount++;
            queryText += ` AND category = $${paramCount}`;
            countQuery += ` AND category = $${paramCount}`;
            params.push(category);
            countParams.push(category);
        }

        if (search) {
            paramCount++;
            queryText += ` AND (LOWER(name) LIKE $${paramCount} OR LOWER(description) LIKE $${paramCount})`;
            countQuery += ` AND (LOWER(name) LIKE $${paramCount} OR LOWER(description) LIKE $${paramCount})`;
            const searchTerm = `%${search.toLowerCase()}%`;
            params.push(searchTerm);
            countParams.push(searchTerm);
        }

        if (status === 'active') {
            paramCount++;
            queryText += ` AND is_active = true`;
            countQuery += ` AND is_active = true`;
        } else if (status === 'inactive') {
            paramCount++;
            queryText += ` AND is_active = false`;
            countQuery += ` AND is_active = false`;
        }

        queryText += " ORDER BY created_at DESC";
        queryText += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(parseInt(limit), offset);

        const [productsResult, countResult] = await Promise.all([
            query(queryText, params),
            query(countQuery, countParams)
        ]);

        // Add presigned URLs to products
        const productsWithUrls = await addPresignedUrlsToProducts(productsResult.rows);

        res.json({
            success: true,
            products: productsWithUrls,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (err) {
        next(err);
    }
});

// Export products to Excel
router.get("/products/export", async (req, res, next) => {
    try {
        const { category, search, status } = req.query;

        let queryText = "SELECT * FROM products WHERE 1=1";
        let params = [];
        let paramCount = 0;

        if (category) {
            paramCount++;
            queryText += ` AND category = $${paramCount}`;
            params.push(category);
        }

        if (search) {
            paramCount++;
            queryText += ` AND (LOWER(name) LIKE $${paramCount} OR LOWER(description) LIKE $${paramCount})`;
            const searchTerm = `%${search.toLowerCase()}%`;
            params.push(searchTerm);
        }

        if (status === 'active') {
            queryText += ` AND is_active = true`;
        } else if (status === 'inactive') {
            queryText += ` AND is_active = false`;
        }

        queryText += " ORDER BY created_at DESC";

        const productsResult = await query(queryText, params);

        // Get sales data for each product
        const productIds = productsResult.rows.map(p => p.id);
        let salesMap = {};
        if (productIds.length > 0) {
            const salesResult = await query(
                `SELECT oi.product_id, 
                        COALESCE(SUM(oi.quantity), 0) as total_sold,
                        COALESCE(SUM(oi.quantity * oi.price), 0) as total_revenue
                 FROM order_items oi
                 LEFT JOIN orders o ON oi.order_id = o.id
                 WHERE oi.product_id = ANY($1) AND o.status != 'CANCELLED'
                 GROUP BY oi.product_id`,
                [productIds]
            );
            salesResult.rows.forEach(row => {
                salesMap[row.product_id] = {
                    total_sold: parseInt(row.total_sold),
                    total_revenue: parseFloat(row.total_revenue)
                };
            });
        }

        const sheetData = productsResult.rows.map(product => ({
            "Product ID": product.id,
            "Name": product.name,
            "Category": product.category,
            "Price (₹)": parseFloat(product.price),
            "Original Price (₹)": product.original_price ? parseFloat(product.original_price) : "",
            "Discount (%)": product.discount || 0,
            "Stock": product.stock,
            "Volume": product.volume || "",
            "Rating": parseFloat(product.rating || 0),
            "Status": product.is_active ? "Active" : "Inactive",
            "Total Sold": (salesMap[product.id]?.total_sold) || 0,
            "Total Revenue (₹)": (salesMap[product.id]?.total_revenue) || 0,
            "Benefits": (product.benefits || []).join("; "),
            "Return Policy": product.return_policy ? "Yes" : "No",
            "Cash on Delivery": product.cash_on_delivery ? "Yes" : "No",
            "Cancellation Allowed": product.allow_cancellation ? "Yes" : "No",
            "Created Date": new Date(product.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sheetData);
        ws["!cols"] = [
            { wch: 38 }, // Product ID
            { wch: 28 }, // Name
            { wch: 16 }, // Category
            { wch: 12 }, // Price
            { wch: 16 }, // Original Price
            { wch: 12 }, // Discount
            { wch: 10 }, // Stock
            { wch: 12 }, // Volume
            { wch: 10 }, // Rating
            { wch: 10 }, // Status
            { wch: 12 }, // Total Sold
            { wch: 16 }, // Total Revenue
            { wch: 40 }, // Benefits
            { wch: 14 }, // Return Policy
            { wch: 16 }, // COD
            { wch: 18 }, // Cancellation
            { wch: 22 }, // Created Date
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Products");

        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        const filename = `products_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(Buffer.from(buf));
    } catch (err) {
        next(err);
    }
});

// Get single product by ID (for editing)
router.get("/products/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await query(
            "SELECT * FROM products WHERE id = $1",
            [id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const productWithUrls = await addPresignedUrlsToProduct(result.rows[0]);

        res.json({
            success: true,
            product: productWithUrls
        });
    } catch (err) {
        next(err);
    }
});

// Full product update
router.put("/products/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            price,
            original_price,
            discount,
            category,
            image_url,
            images,
            volume,
            stock,
            rating,
            nutrition,
            benefits,
            return_policy,
            cash_on_delivery,
            allow_cancellation,
            is_active
        } = req.body;

        const result = await query(
            `UPDATE products SET 
                name = $1, 
                description = $2, 
                price = $3, 
                original_price = $4,
                discount = $5,
                category = $6, 
                image_url = $7, 
                images = $8,
                volume = $9,
                stock = $10, 
                rating = $11,
                nutrition = $12,
                benefits = $13,
                return_policy = $14, 
                cash_on_delivery = $15, 
                allow_cancellation = $16,
                is_active = $17,
                updated_at = NOW() 
             WHERE id = $18 
             RETURNING *`,
            [
                name, description, price, original_price, discount,
                category, image_url, images || [], volume, stock,
                rating, nutrition, benefits || [], return_policy,
                cash_on_delivery, allow_cancellation, is_active, id
            ]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const productWithUrls = await addPresignedUrlsToProduct(result.rows[0]);

        res.json({
            success: true,
            message: "Product updated successfully",
            product: productWithUrls
        });
    } catch (err) {
        next(err);
    }
});

// Toggle product status (activate/deactivate)
router.patch("/products/:id/status", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        const result = await query(
            "UPDATE products SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            [is_active, id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        const productWithUrls = await addPresignedUrlsToProduct(result.rows[0]);

        res.json({
            success: true,
            message: `Product ${is_active ? 'activated' : 'deactivated'}`,
            product: productWithUrls
        });
    } catch (err) {
        next(err);
    }
});

// Update product stock
router.patch("/products/:id/stock", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { stock } = req.body;

        if (stock < 0) {
            return res.status(400).json({ success: false, message: "Stock cannot be negative" });
        }

        const result = await query(
            "UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            [stock, id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.json({
            success: true,
            message: "Stock updated",
            product: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

/* ===================== ORDERS MANAGEMENT ===================== */

// Get all orders with filters
router.get("/orders", async (req, res, next) => {
    try {
        const { status, payment_status, search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let queryText = `
      SELECT o.*, u.fullname as customer_name, u.email as customer_email,
             a.name as addr_name, a.street, a.city, a.state, a.pincode,
             dp.id as partner_id, dp.name as partner_name, dp.phone as partner_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN addresses a ON o.delivery_address_id = a.id
      LEFT JOIN delivery_partners dp ON o.delivery_partner_id = dp.id
      WHERE 1=1
    `;
        let countQuery = "SELECT COUNT(*) FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1";
        let params = [];
        let countParams = [];
        let paramCount = 0;

        if (status) {
            paramCount++;
            queryText += ` AND o.status = $${paramCount}`;
            countQuery += ` AND o.status = $${paramCount}`;
            params.push(status);
            countParams.push(status);
        }

        if (payment_status) {
            paramCount++;
            queryText += ` AND o.payment_status = $${paramCount}`;
            countQuery += ` AND o.payment_status = $${paramCount}`;
            params.push(payment_status);
            countParams.push(payment_status);
        }

        if (search) {
            paramCount++;
            queryText += ` AND (LOWER(u.fullname) LIKE $${paramCount} OR LOWER(u.email) LIKE $${paramCount} OR o.id::text LIKE $${paramCount})`;
            countQuery += ` AND (LOWER(u.fullname) LIKE $${paramCount} OR LOWER(u.email) LIKE $${paramCount} OR o.id::text LIKE $${paramCount})`;
            const searchTerm = `%${search.toLowerCase()}%`;
            params.push(searchTerm);
            countParams.push(searchTerm);
        }

        queryText += " ORDER BY o.created_at DESC";
        queryText += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(parseInt(limit), offset);

        const [ordersResult, countResult] = await Promise.all([
            query(queryText, params),
            query(countQuery, countParams)
        ]);

        res.json({
            success: true,
            orders: ordersResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (err) {
        next(err);
    }
});

// Export orders to Excel
const XLSX = require("xlsx");
router.get("/orders/export", async (req, res, next) => {
    try {
        const { status, payment_status, search } = req.query;

        let queryText = `
      SELECT o.id, o.total_amount, o.status, o.payment_status, o.payment_method,
             o.created_at,
             u.fullname as customer_name, u.email as customer_email, u.phone as customer_phone,
             a.name as addr_name, a.street, a.city, a.state, a.pincode,
             dp.name as partner_name, dp.phone as partner_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN addresses a ON o.delivery_address_id = a.id
      LEFT JOIN delivery_partners dp ON o.delivery_partner_id = dp.id
      WHERE 1=1
    `;
        let params = [];
        let paramCount = 0;

        if (status) {
            paramCount++;
            queryText += ` AND o.status = $${paramCount}`;
            params.push(status);
        }

        if (payment_status) {
            paramCount++;
            queryText += ` AND o.payment_status = $${paramCount}`;
            params.push(payment_status);
        }

        if (search) {
            paramCount++;
            queryText += ` AND (LOWER(u.fullname) LIKE $${paramCount} OR LOWER(u.email) LIKE $${paramCount} OR o.id::text LIKE $${paramCount})`;
            const searchTerm = `%${search.toLowerCase()}%`;
            params.push(searchTerm);
        }

        queryText += " ORDER BY o.created_at DESC";

        const ordersResult = await query(queryText, params);

        // Also fetch order items for each order
        const orderIds = ordersResult.rows.map(o => o.id);
        let orderItemsMap = {};
        if (orderIds.length > 0) {
            const itemsResult = await query(
                `SELECT oi.order_id, oi.quantity, oi.price, p.name as product_name
                 FROM order_items oi
                 LEFT JOIN products p ON oi.product_id = p.id
                 WHERE oi.order_id = ANY($1)
                 ORDER BY oi.order_id`,
                [orderIds]
            );
            itemsResult.rows.forEach(item => {
                if (!orderItemsMap[item.order_id]) {
                    orderItemsMap[item.order_id] = [];
                }
                orderItemsMap[item.order_id].push(item);
            });
        }

        // Build the Orders sheet data
        const ordersSheetData = ordersResult.rows.map(order => ({
            "Order ID": order.id,
            "Customer Name": order.customer_name || "Guest",
            "Customer Email": order.customer_email || "",
            "Customer Phone": order.customer_phone || "",
            "Total Amount": parseFloat(order.total_amount),
            "Order Status": order.status,
            "Payment Status": order.payment_status,
            "Payment Method": order.payment_method || "",
            "Delivery Address": [order.addr_name, order.street, order.city, order.state, order.pincode].filter(Boolean).join(", "),
            "Delivery Partner": order.partner_name || "Not Assigned",
            "Partner Phone": order.partner_phone || "",
            "Items": (orderItemsMap[order.id] || []).map(i => `${i.product_name} x${i.quantity}`).join("; "),
            "Order Date": new Date(order.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
        }));

        // Build the Order Items sheet data
        const itemsSheetData = [];
        ordersResult.rows.forEach(order => {
            const items = orderItemsMap[order.id] || [];
            items.forEach(item => {
                itemsSheetData.push({
                    "Order ID": order.id,
                    "Customer Name": order.customer_name || "Guest",
                    "Product Name": item.product_name || "Unknown",
                    "Quantity": item.quantity,
                    "Unit Price": parseFloat(item.price),
                    "Subtotal": parseFloat(item.price) * item.quantity,
                    "Order Status": order.status,
                    "Order Date": new Date(order.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
                });
            });
        });

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Orders sheet
        const ordersWs = XLSX.utils.json_to_sheet(ordersSheetData);
        // Set column widths
        ordersWs["!cols"] = [
            { wch: 38 }, // Order ID
            { wch: 20 }, // Customer Name
            { wch: 25 }, // Customer Email
            { wch: 15 }, // Customer Phone
            { wch: 14 }, // Total Amount
            { wch: 14 }, // Order Status
            { wch: 14 }, // Payment Status
            { wch: 14 }, // Payment Method
            { wch: 40 }, // Delivery Address
            { wch: 18 }, // Delivery Partner
            { wch: 15 }, // Partner Phone
            { wch: 40 }, // Items
            { wch: 22 }, // Order Date
        ];
        XLSX.utils.book_append_sheet(wb, ordersWs, "Orders");

        // Order Items sheet
        if (itemsSheetData.length > 0) {
            const itemsWs = XLSX.utils.json_to_sheet(itemsSheetData);
            itemsWs["!cols"] = [
                { wch: 38 }, // Order ID
                { wch: 20 }, // Customer Name
                { wch: 25 }, // Product Name
                { wch: 10 }, // Quantity
                { wch: 12 }, // Unit Price
                { wch: 12 }, // Subtotal
                { wch: 14 }, // Order Status
                { wch: 22 }, // Order Date
            ];
            XLSX.utils.book_append_sheet(wb, itemsWs, "Order Items");
        }

        // Generate buffer
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        const filename = `orders_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(Buffer.from(buf));
    } catch (err) {
        next(err);
    }
});

// Get categories list
router.get("/categories", async (req, res, next) => {
    try {
        const result = await query(`
      SELECT DISTINCT category, COUNT(*) as product_count 
      FROM products 
      WHERE is_active = true 
      GROUP BY category 
      ORDER BY category
    `);

        res.json({
            success: true,
            categories: result.rows
        });
    } catch (err) {
        next(err);
    }
});

/* ===================== DELIVERY PARTNERS MANAGEMENT ===================== */

const addPresignedUrlsToPartner = async (partner) => {
    if (!partner) return partner;
    const partnerCopy = { ...partner };

    if (partnerCopy.image_url && partnerCopy.image_url.startsWith('products/')) {
        const urlResult = await getPresignedUrl(partnerCopy.image_url, 3600);
        partnerCopy.image_url_signed = urlResult.success ? urlResult.url : null;
    } else {
        partnerCopy.image_url_signed = partnerCopy.image_url;
    }

    return partnerCopy;
};

const addPresignedUrlsToPartners = async (partners) => {
    return Promise.all(partners.map(addPresignedUrlsToPartner));
};

// Get all delivery partners
router.get("/delivery-partners", async (req, res, next) => {
    try {
        const { search, status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let queryText = "SELECT * FROM delivery_partners WHERE 1=1";
        let countQuery = "SELECT COUNT(*) FROM delivery_partners WHERE 1=1";
        let params = [];
        let countParams = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            queryText += ` AND (LOWER(name) LIKE $${paramCount} OR phone LIKE $${paramCount})`;
            countQuery += ` AND (LOWER(name) LIKE $${paramCount} OR phone LIKE $${paramCount})`;
            const searchTerm = `%${search.toLowerCase()}%`;
            params.push(searchTerm);
            countParams.push(searchTerm);
        }

        if (status === 'available') {
            queryText += ` AND is_available = true`;
            countQuery += ` AND is_available = true`;
        } else if (status === 'unavailable') {
            queryText += ` AND is_available = false`;
            countQuery += ` AND is_available = false`;
        }

        queryText += " ORDER BY created_at DESC";
        queryText += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(parseInt(limit), offset);

        const [partnersResult, countResult] = await Promise.all([
            query(queryText, params),
            query(countQuery, countParams)
        ]);

        // Get assigned orders count for each partner
        const partnerIds = partnersResult.rows.map(p => p.id);
        let ordersCountMap = {};
        if (partnerIds.length > 0) {
            const ordersResult = await query(
                `SELECT delivery_partner_id, COUNT(*) as count 
                 FROM orders 
                 WHERE delivery_partner_id = ANY($1) AND status NOT IN ('CANCELLED', 'DELIVERED')
                 GROUP BY delivery_partner_id`,
                [partnerIds]
            );
            ordersResult.rows.forEach(r => {
                ordersCountMap[r.delivery_partner_id] = parseInt(r.count);
            });
        }

        const partnersWithOrders = partnersResult.rows.map(p => ({
            ...p,
            active_orders: ordersCountMap[p.id] || 0
        }));

        const partnersWithUrls = await addPresignedUrlsToPartners(partnersWithOrders);

        res.json({
            success: true,
            partners: partnersWithUrls,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (err) {
        next(err);
    }
});

// Export delivery partners to Excel
router.get("/delivery-partners/export", async (req, res, next) => {
    try {
        const { search, status } = req.query;

        let queryText = "SELECT * FROM delivery_partners WHERE 1=1";
        let params = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            queryText += ` AND (LOWER(name) LIKE $${paramCount} OR phone LIKE $${paramCount})`;
            const searchTerm = `%${search.toLowerCase()}%`;
            params.push(searchTerm);
        }

        if (status === 'available') {
            queryText += ` AND is_available = true`;
        } else if (status === 'unavailable') {
            queryText += ` AND is_available = false`;
        }

        queryText += " ORDER BY created_at DESC";

        const partnersResult = await query(queryText, params);

        // Get active orders count for each partner
        const partnerIds = partnersResult.rows.map(p => p.id);
        let ordersCountMap = {};
        if (partnerIds.length > 0) {
            const ordersResult = await query(
                `SELECT delivery_partner_id, COUNT(*) as count 
                 FROM orders 
                 WHERE delivery_partner_id = ANY($1) AND status NOT IN ('CANCELLED', 'DELIVERED')
                 GROUP BY delivery_partner_id`,
                [partnerIds]
            );
            ordersResult.rows.forEach(r => {
                ordersCountMap[r.delivery_partner_id] = parseInt(r.count);
            });
        }

        // Get total delivered orders count
        let deliveredCountMap = {};
        if (partnerIds.length > 0) {
            const deliveredResult = await query(
                `SELECT delivery_partner_id, COUNT(*) as count 
                 FROM orders 
                 WHERE delivery_partner_id = ANY($1) AND status = 'DELIVERED'
                 GROUP BY delivery_partner_id`,
                [partnerIds]
            );
            deliveredResult.rows.forEach(r => {
                deliveredCountMap[r.delivery_partner_id] = parseInt(r.count);
            });
        }

        const sheetData = partnersResult.rows.map(partner => ({
            "Partner ID": partner.id,
            "Name": partner.name,
            "Phone": partner.phone,
            "Email": partner.email || "",
            "Rating": parseFloat(partner.rating || 0),
            "Availability": partner.is_available ? "Available" : "Unavailable",
            "Active Orders": ordersCountMap[partner.id] || 0,
            "Total Delivered": deliveredCountMap[partner.id] || 0,
            "Joined Date": new Date(partner.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sheetData);
        ws["!cols"] = [
            { wch: 38 }, // Partner ID
            { wch: 20 }, // Name
            { wch: 15 }, // Phone
            { wch: 25 }, // Email
            { wch: 10 }, // Rating
            { wch: 14 }, // Availability
            { wch: 14 }, // Active Orders
            { wch: 16 }, // Total Delivered
            { wch: 22 }, // Joined Date
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Delivery Partners");

        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        const filename = `delivery_partners_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(Buffer.from(buf));
    } catch (err) {
        next(err);
    }
});

// Create delivery partner
router.post("/delivery-partners", async (req, res, next) => {
    try {
        const { name, phone, email, rating, image_url, is_available } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ success: false, message: "Name and phone are required" });
        }

        // Check for duplicate phone
        const existing = await query("SELECT id FROM delivery_partners WHERE phone = $1", [phone]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: "A delivery partner with this phone already exists" });
        }

        const result = await query(
            `INSERT INTO delivery_partners (name, phone, email, rating, image_url, is_available)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [name, phone, email || null, rating || 0, image_url || null, is_available !== false]
        );

        res.status(201).json({
            success: true,
            message: "Delivery partner created",
            partner: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

// Update delivery partner
router.put("/delivery-partners/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, phone, email, rating, image_url, is_available } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ success: false, message: "Name and phone are required" });
        }

        // Check for duplicate phone (excluding self)
        const existing = await query("SELECT id FROM delivery_partners WHERE phone = $1 AND id != $2", [phone, id]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Another delivery partner with this phone already exists" });
        }

        const result = await query(
            `UPDATE delivery_partners SET 
                name = $1, phone = $2, email = $3, rating = $4, 
                image_url = $5, is_available = $6, updated_at = NOW()
             WHERE id = $7 RETURNING *`,
            [name, phone, email || null, rating || 0, image_url || null, is_available !== false, id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Delivery partner not found" });
        }

        res.json({
            success: true,
            message: "Delivery partner updated",
            partner: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

// Toggle delivery partner availability
router.patch("/delivery-partners/:id/availability", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { is_available } = req.body;

        const result = await query(
            "UPDATE delivery_partners SET is_available = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            [is_available, id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Delivery partner not found" });
        }

        res.json({
            success: true,
            message: `Delivery partner ${is_available ? 'marked available' : 'marked unavailable'}`,
            partner: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

// Delete delivery partner
router.delete("/delivery-partners/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if partner has active orders
        const activeOrders = await query(
            "SELECT COUNT(*) as count FROM orders WHERE delivery_partner_id = $1 AND status NOT IN ('CANCELLED', 'DELIVERED')",
            [id]
        );
        if (parseInt(activeOrders.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete partner with active orders. Reassign orders first."
            });
        }

        const result = await query("DELETE FROM delivery_partners WHERE id = $1 RETURNING id", [id]);

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Delivery partner not found" });
        }

        res.json({
            success: true,
            message: "Delivery partner deleted successfully"
        });
    } catch (err) {
        next(err);
    }
});

/* ===================== COUPONS MANAGEMENT ===================== */

// Get all coupons
router.get("/coupons", async (req, res, next) => {
    try {
        const { search, status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let queryText = "SELECT * FROM coupons WHERE 1=1";
        let countQuery = "SELECT COUNT(*) FROM coupons WHERE 1=1";
        let params = [];
        let countParams = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            queryText += ` AND (LOWER(code) LIKE $${paramCount} OR LOWER(description) LIKE $${paramCount})`;
            countQuery += ` AND (LOWER(code) LIKE $${paramCount} OR LOWER(description) LIKE $${paramCount})`;
            const searchTerm = `%${search.toLowerCase()}%`;
            params.push(searchTerm);
            countParams.push(searchTerm);
        }

        if (status === 'active') {
            queryText += ` AND is_active = true`;
            countQuery += ` AND is_active = true`;
        } else if (status === 'inactive') {
            queryText += ` AND is_active = false`;
            countQuery += ` AND is_active = false`;
        }

        queryText += " ORDER BY created_at DESC";
        queryText += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(parseInt(limit), offset);

        const [couponsResult, countResult] = await Promise.all([
            query(queryText, params),
            query(countQuery, countParams)
        ]);

        res.json({
            success: true,
            coupons: couponsResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count),
                pages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (err) {
        next(err);
    }
});

// Get single coupon
router.get("/coupons/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await query("SELECT * FROM coupons WHERE id = $1", [id]);

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        res.json({ success: true, coupon: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

// Create coupon
router.post("/coupons", async (req, res, next) => {
    try {
        const {
            code,
            description,
            discount_type = 'percentage',
            discount_value,
            min_order_amount = 0,
            max_discount_amount,
            usage_limit,
            is_active = true,
            starts_at,
            expires_at
        } = req.body;

        if (!code || !discount_value) {
            return res.status(400).json({
                success: false,
                message: "Coupon code and discount value are required"
            });
        }

        if (!['percentage', 'flat'].includes(discount_type)) {
            return res.status(400).json({
                success: false,
                message: "Discount type must be 'percentage' or 'flat'"
            });
        }

        if (discount_type === 'percentage' && (discount_value < 0 || discount_value > 100)) {
            return res.status(400).json({
                success: false,
                message: "Percentage discount must be between 0 and 100"
            });
        }

        // Check if code already exists
        const existing = await query("SELECT id FROM coupons WHERE LOWER(code) = LOWER($1)", [code]);
        if (existing.rows.length) {
            return res.status(409).json({
                success: false,
                message: "A coupon with this code already exists"
            });
        }

        const result = await query(
            `INSERT INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, is_active, starts_at, expires_at)
             VALUES (UPPER($1), $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [code, description || null, discount_type, discount_value, min_order_amount, max_discount_amount || null, usage_limit || null, is_active, starts_at || new Date(), expires_at || null]
        );

        res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            coupon: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

// Update coupon
router.put("/coupons/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            code,
            description,
            discount_type,
            discount_value,
            min_order_amount,
            max_discount_amount,
            usage_limit,
            is_active,
            starts_at,
            expires_at
        } = req.body;

        // Check if code conflicts with another coupon
        if (code) {
            const existing = await query("SELECT id FROM coupons WHERE LOWER(code) = LOWER($1) AND id != $2", [code, id]);
            if (existing.rows.length) {
                return res.status(409).json({
                    success: false,
                    message: "A coupon with this code already exists"
                });
            }
        }

        const result = await query(
            `UPDATE coupons SET
                code = COALESCE(UPPER($1), code),
                description = COALESCE($2, description),
                discount_type = COALESCE($3, discount_type),
                discount_value = COALESCE($4, discount_value),
                min_order_amount = COALESCE($5, min_order_amount),
                max_discount_amount = $6,
                usage_limit = $7,
                is_active = COALESCE($8, is_active),
                starts_at = COALESCE($9, starts_at),
                expires_at = $10,
                updated_at = NOW()
             WHERE id = $11
             RETURNING *`,
            [code, description, discount_type, discount_value, min_order_amount, max_discount_amount || null, usage_limit || null, is_active, starts_at, expires_at || null, id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        res.json({
            success: true,
            message: "Coupon updated successfully",
            coupon: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

// Toggle coupon status
router.patch("/coupons/:id/status", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        const result = await query(
            "UPDATE coupons SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
            [is_active, id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        res.json({
            success: true,
            message: `Coupon ${is_active ? 'activated' : 'deactivated'}`,
            coupon: result.rows[0]
        });
    } catch (err) {
        next(err);
    }
});

// Delete coupon
router.delete("/coupons/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await query("DELETE FROM coupons WHERE id = $1 RETURNING id", [id]);

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        res.json({
            success: true,
            message: "Coupon deleted successfully"
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
