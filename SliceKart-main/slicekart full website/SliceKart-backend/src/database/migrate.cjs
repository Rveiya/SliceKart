const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
});

async function runMigration() {
    console.log("Starting database migration...\n");

    try {
        const schemaPath = path.join(__dirname, "schema.sql");
        const schema = fs.readFileSync(schemaPath, "utf8");

        // Split by semicolons but be careful about functions
        const statements = schema.split(/;\s*$/m).filter(stmt => stmt.trim());

        for (const statement of statements) {
            const trimmedStatement = statement.trim();
            if (!trimmedStatement) continue;

            try {
                await pool.query(trimmedStatement);
                const firstLine = trimmedStatement.split('\n')[0].substring(0, 60);
                console.log(`✓ ${firstLine}...`);
            } catch (err) {
                // Ignore some expected errors
                if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
                    console.log(`⏭ Skipped (already exists): ${trimmedStatement.split('\n')[0].substring(0, 40)}...`);
                } else {
                    console.error(`✗ Error: ${err.message}`);
                    console.error(`  Statement: ${trimmedStatement.substring(0, 100)}...`);
                }
            }
        }

        console.log("\n✅ Database migration completed!");
    } catch (err) {
        console.error("Migration failed:", err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
