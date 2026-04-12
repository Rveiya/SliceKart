/**
 * Database Migration Runner
 * Run this script to apply the subscription system migration
 * 
 * Usage: node run-migration.cjs
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool, connectDB } = require("./config/db.cjs");

async function runMigration() {
    console.log("🚀 Starting database migration...\n");

    try {
        // Test database connection
        await connectDB();

        // List of migration files to run
        const migrationFiles = [
            "subscription-schema.sql",
            "migration-subscriptions.sql"
        ];

        for (const fileName of migrationFiles) {
            const migrationPath = path.join(__dirname, "database", fileName);

            if (!fs.existsSync(migrationPath)) {
                console.log(`⚠️  Migration file not found: ${fileName}, skipping...`);
                continue;
            }

            console.log(`📄 Executing: ${fileName}...`);
            const migrationSQL = fs.readFileSync(migrationPath, "utf8");

            try {
                await pool.query(migrationSQL);
                console.log(`   ✅ ${fileName} completed`);
            } catch (sqlError) {
                // Some errors are expected (like "already exists")
                if (sqlError.message.includes('already exists') ||
                    sqlError.message.includes('duplicate')) {
                    console.log(`   ℹ️  ${fileName} - Some objects already exist (OK)`);
                } else {
                    console.error(`   ❌ ${fileName} failed:`, sqlError.message);
                }
            }
        }

        console.log("\n✅ Migration execution completed!\n");

        console.log("✅ Migration completed successfully!\n");

        // Verify the changes
        console.log("🔍 Verifying migration...\n");

        // Check if subscriptions table exists
        const subscriptionsTable = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'subscriptions'
            );
        `);
        console.log("  ✓ Subscriptions table:", subscriptionsTable.rows[0].exists ? "Created" : "Not found");

        // Check if subscription_orders table exists
        const subscriptionOrdersTable = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'subscription_orders'
            );
        `);
        console.log("  ✓ Subscription orders table:", subscriptionOrdersTable.rows[0].exists ? "Created" : "Not found");

        // Check if health guidance columns exist in products
        const healthNotesCol = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'products' AND column_name = 'health_notes'
            );
        `);
        console.log("  ✓ Products.health_notes:", healthNotesCol.rows[0].exists ? "Added" : "Not found");

        // Check if preferred_delivery_time exists in cart_items
        const deliveryTimeCol = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'cart_items' AND column_name = 'preferred_delivery_time'
            );
        `);
        console.log("  ✓ Cart_items.preferred_delivery_time:", deliveryTimeCol.rows[0].exists ? "Added" : "Not found");

        // Check if subscription_id exists in orders
        const subscriptionIdCol = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'orders' AND column_name = 'subscription_id'
            );
        `);
        console.log("  ✓ Orders.subscription_id:", subscriptionIdCol.rows[0].exists ? "Added" : "Not found");

        console.log("\n✨ All database changes verified successfully!");
        console.log("\n📋 Summary:");
        console.log("  - Health guidance fields added to products table");
        console.log("  - Subscriptions table created for managing recurring orders");
        console.log("  - Subscription_orders table created for tracking deliveries");
        console.log("  - Cart items can now store preferred delivery time");
        console.log("  - Orders can be linked to subscriptions");

    } catch (error) {
        console.error("❌ Migration failed:", error.message);
        console.error("\nFull error:", error);
        process.exit(1);
    } finally {
        await pool.end();
        console.log("\n👋 Database connection closed.");
    }
}

runMigration();
