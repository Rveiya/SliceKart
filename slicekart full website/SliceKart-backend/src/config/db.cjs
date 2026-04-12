const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

const query = (text, params) => pool.query(text, params);

const connectDB = async () => {
  try {
    await query("SELECT 1");
    console.log("✅ PostgreSQL connected");
  } catch (err) {
    console.error("DB connection failed:", err.message);
    process.exit(1);
  }
};

module.exports = {
  query,
  connectDB,
  pool,
};
