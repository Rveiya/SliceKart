/**
 * Admin Seeder Script
 * Creates a default admin user in the database
 * 
 * Usage: node src/database/seed-admin.cjs
 */

require("dotenv").config();
const bcrypt = require("bcrypt");
const { query, connectDB } = require("../config/db.cjs");

const ADMIN_USER = {
    fullname: "Admin User",
    email: "admin@healthysip.com",
    password: "Admin@123", // Change this in production!
    role: "ADMIN"
};

async function seedAdmin() {
    try {
        console.log("🔗 Connecting to database...");
        await connectDB();

        console.log("\n📌 Checking for existing admin user...");

        // Check if admin already exists
        const existingAdmin = await query(
            "SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)",
            [ADMIN_USER.email]
        );

        if (existingAdmin.rows.length > 0) {
            console.log(`⚠️  Admin user already exists with email: ${ADMIN_USER.email}`);
            console.log(`   User ID: ${existingAdmin.rows[0].id}`);
            console.log("\n✅ No changes made.");
            process.exit(0);
        }

        console.log("🔐 Hashing password...");
        const hashedPassword = await bcrypt.hash(ADMIN_USER.password, 12);

        console.log("👤 Creating admin user...");
        const result = await query(
            `INSERT INTO users (fullname, email, password_hash, role)
       VALUES ($1, LOWER($2), $3, $4)
       RETURNING id, fullname, email, role, created_at`,
            [ADMIN_USER.fullname, ADMIN_USER.email, hashedPassword, ADMIN_USER.role]
        );

        const admin = result.rows[0];

        console.log("\n✅ Admin user created successfully!");
        console.log("═══════════════════════════════════════");
        console.log(`   ID:       ${admin.id}`);
        console.log(`   Name:     ${admin.fullname}`);
        console.log(`   Email:    ${admin.email}`);
        console.log(`   Role:     ${admin.role}`);
        console.log(`   Created:  ${admin.created_at}`);
        console.log("═══════════════════════════════════════");
        console.log("\n🔑 Login Credentials:");
        console.log(`   Email:    ${ADMIN_USER.email}`);
        console.log(`   Password: ${ADMIN_USER.password}`);
        console.log("\n⚠️  IMPORTANT: Change the password after first login!");

        process.exit(0);
    } catch (error) {
        console.error("\n❌ Error seeding admin:", error.message);
        process.exit(1);
    }
}

seedAdmin();
