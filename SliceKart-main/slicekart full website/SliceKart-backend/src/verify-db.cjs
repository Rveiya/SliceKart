/**
 * Database Verification Script
 * Run this to verify subscription tables are properly set up
 */

require("dotenv").config();
const { pool, connectDB } = require("./config/db.cjs");

async function verifyDatabase() {
    console.log("\n🔍 Verifying database schema...\n");

    try {
        await connectDB();

        // Check tables
        const tables = ['subscriptions', 'subscription_orders'];
        console.log("📋 Checking tables:");
        for (const table of tables) {
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                );
            `, [table]);
            console.log(`   ${result.rows[0].exists ? '✅' : '❌'} ${table}`);
        }

        // Check products columns
        console.log("\n📋 Checking products columns:");
        const productCols = ['health_notes', 'best_before_food', 'health_tags'];
        for (const col of productCols) {
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'products' AND column_name = $1
                );
            `, [col]);
            console.log(`   ${result.rows[0].exists ? '✅' : '❌'} products.${col}`);
        }

        // Check cart_items columns
        console.log("\n📋 Checking cart_items columns:");
        const cartCols = ['preferred_delivery_time'];
        for (const col of cartCols) {
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'cart_items' AND column_name = $1
                );
            `, [col]);
            console.log(`   ${result.rows[0].exists ? '✅' : '❌'} cart_items.${col}`);
        }

        // Check orders columns  
        console.log("\n📋 Checking orders columns:");
        const orderCols = ['subscription_id', 'is_subscription_order'];
        for (const col of orderCols) {
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'orders' AND column_name = $1
                );
            `, [col]);
            console.log(`   ${result.rows[0].exists ? '✅' : '❌'} orders.${col}`);
        }

        // Check subscription_orders columns
        console.log("\n📋 Checking subscription_orders columns:");
        const subOrderCols = ['scheduled_delivery_date', 'actual_delivery_date', 'quantity', 'status'];
        for (const col of subOrderCols) {
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'subscription_orders' AND column_name = $1
                );
            `, [col]);
            console.log(`   ${result.rows[0].exists ? '✅' : '❌'} subscription_orders.${col}`);
        }

        console.log("\n✨ Verification complete!\n");

    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        await pool.end();
    }
}

verifyDatabase();
