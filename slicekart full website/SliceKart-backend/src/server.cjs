require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db.cjs");

const authRoutes = require("./routes/auth.routes.cjs");
const userRoutes = require("./routes/user.routes.cjs");
const productRoutes = require("./routes/product.routes.cjs");
const cartRoutes = require("./routes/cart.routes.cjs");
const orderRoutes = require("./routes/order.routes.cjs");
const paymentRoutes = require("./routes/payment.routes.cjs");
const addressRoutes = require("./routes/address.routes.cjs");
const adminRoutes = require("./routes/admin.routes.cjs");
const uploadRoutes = require("./routes/upload.routes.cjs");
const subscriptionRoutes = require("./routes/subscription.routes.cjs");
const couponRoutes = require("./routes/coupons.routes.cjs");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 5000;

/* -------------------- Middlewares -------------------- */
app.use(cors({
  origin: process.env.CORS_ORIGIN_CLIENT_URL,
  methods: process.env.CORS_METHODS,
  credentials: true
}));
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use((req, res, next) => {
  if (req.originalUrl === "/api/payments/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});

/* -------------------- Routes -------------------- */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
// Test route
app.get("/", (req, res) => {
  res.send("SliceKart Backend is Running 🚀");
});
app.use("/api/carts", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/addresses", addressRoutes);
const favoriteRoutes = require("./routes/favorite.routes.cjs");
app.use("/api/favorites", favoriteRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
const checkoutRoutes = require("./routes/checkout.routes.cjs");
app.use("/api/checkout", checkoutRoutes);
app.use("/api/coupons", couponRoutes);

/* -------------------- Global Error Handler -------------------- */
app.use((err, req, res, next) => {
  console.error("Error:", err);

  // Handle Razorpay errors specifically
  if (err.error && err.error.description) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.error.description,
      error: err.error
    });
  }

  // Handle general errors
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

/* -------------------- Start Server AFTER DB -------------------- */
const startServer = async () => {
  await connectDB(); // Ensure DB is connected before starting the server

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`🔗 CORS Origin: ${process.env.CORS_ORIGIN_CLIENT_URL}`);

    // Initialize cron jobs for subscription processing
    // Set to false to disable in development if needed
    const enableCron = process.env.ENABLE_CRON !== 'false';
    if (enableCron) {
      try {
        const { initCronJobs } = require("./cron/index.cjs");
        initCronJobs(true);
      } catch (cronError) {
        console.log("⚠️  Cron jobs not initialized (node-cron may not be installed)");
        console.log("   Run: npm install node-cron");
      }
    }
  });
};

startServer();
