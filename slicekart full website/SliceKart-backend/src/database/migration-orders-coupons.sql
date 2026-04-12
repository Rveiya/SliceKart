-- Migration: Add coupon support to orders table
-- Allows orders to track applied coupons and discounts

-- Add coupon_id and discount fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20);

-- Create index for faster coupon lookups
CREATE INDEX IF NOT EXISTS idx_orders_coupon_id ON orders(coupon_id);
CREATE INDEX IF NOT EXISTS idx_orders_coupon_code ON orders(coupon_code);
