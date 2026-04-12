/**
 * Cron Job Scheduler
 * 
 * This module sets up scheduled jobs for the HealthySip backend.
 * Import and call initCronJobs() from your server.cjs to enable.
 * 
 * Jobs included:
 *   - Subscription order processing (daily at 5:00 AM)
 */

const cron = require("node-cron");
const { processSubscriptions } = require("./process-subscriptions.cjs");

/**
 * Initialize all cron jobs
 * @param {boolean} enabled - Whether to enable cron jobs (disable in dev if needed)
 */
function initCronJobs(enabled = true) {
    if (!enabled) {
        console.log("⏰ Cron jobs disabled");
        return;
    }

    console.log("⏰ Initializing cron jobs...");

    // Process subscription orders daily at 5:00 AM
    // Cron format: minute hour day-of-month month day-of-week
    cron.schedule("0 5 * * *", async () => {
        console.log("\n🔔 Cron triggered: Processing subscription orders...");
        try {
            const stats = await processSubscriptions();
            console.log(`✅ Subscription processing complete: ${stats.ordersCreated} orders created`);
        } catch (error) {
            console.error("❌ Cron job failed:", error.message);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata" // IST timezone
    });

    console.log("  ✓ Subscription processor: Daily at 5:00 AM IST");

    // Optional: Run every hour to catch any missed orders
    // Uncomment if you want more frequent processing
    /*
    cron.schedule("0 * * * *", async () => {
        console.log("\n🔔 Hourly check: Processing subscription orders...");
        try {
            await processSubscriptions();
        } catch (error) {
            console.error("❌ Hourly cron job failed:", error.message);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
    console.log("  ✓ Hourly subscription check: Every hour");
    */

    console.log("✅ Cron jobs initialized successfully\n");
}

module.exports = { initCronJobs };
