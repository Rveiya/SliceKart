-- ============================================================
-- HEALTHYSIP SUBSCRIPTION SYSTEM MIGRATION
-- Run this script to add subscription support to your database
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ADD HEALTH GUIDANCE FIELDS TO PRODUCTS TABLE
-- ============================================================



-- Add health notes for detailed guidance
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS health_notes TEXT;

-- Add best before food flag
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS best_before_food BOOLEAN DEFAULT false;

-- Add health tags array
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS health_tags TEXT[];

-- ============================================================
-- 2. ADD PREFERRED_DELIVERY_TIME TO CART_ITEMS TABLE
-- ============================================================

ALTER TABLE cart_items 
ADD COLUMN IF NOT EXISTS preferred_delivery_time VARCHAR(20) DEFAULT NULL
CHECK (preferred_delivery_time IS NULL OR preferred_delivery_time IN ('morning', 'afternoon', 'evening'));

-- ============================================================
-- 3. CREATE SUBSCRIPTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    
    -- Subscription settings
    subscription_type VARCHAR(20) NOT NULL CHECK (subscription_type IN ('weekly', 'monthly')),
    quantity INTEGER NOT NULL DEFAULT 1,
    preferred_delivery_time VARCHAR(20) DEFAULT 'morning' 
        CHECK (preferred_delivery_time IN ('morning', 'afternoon', 'evening')),
    preferred_delivery_day VARCHAR(20), -- e.g., 'monday', 'tuesday', etc. for weekly subscriptions
    
    -- Status management
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' 
        CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED')),
    
    -- Pricing
    price_per_delivery DECIMAL(10, 2) NOT NULL,
    
    -- Delivery scheduling
    next_delivery_date DATE,
    last_delivery_date DATE,
    
    -- Address and payment
    delivery_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
    total_deliveries INTEGER DEFAULT 0, -- Count of completed deliveries
    payment_method VARCHAR(20) DEFAULT 'COD' CHECK (payment_method IN ('COD', 'ONLINE')),
    
    -- Additional info
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paused_at TIMESTAMP,
    cancelled_at TIMESTAMP
);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_product_id ON subscriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_delivery ON subscriptions(next_delivery_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_deliveries 
    ON subscriptions(status, next_delivery_date) 
    WHERE status = 'ACTIVE';

-- ============================================================
-- 4. CREATE SUBSCRIPTION_ORDERS TABLE
-- For tracking individual recurring orders
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL, -- Link to actual order when created
    
    -- Scheduling
    scheduled_delivery_date DATE NOT NULL,
    actual_delivery_date DATE,
    
    -- Status: SCHEDULED -> PENDING -> IN_PROGRESS -> COMPLETED/FAILED/SKIPPED
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' 
        CHECK (status IN ('SCHEDULED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED')),
    
    -- For tracking
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_time DECIMAL(10, 2), -- Price when order was created
    
    -- Notes
    skip_reason TEXT,
    failure_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for subscription_orders
CREATE INDEX IF NOT EXISTS idx_subscription_orders_subscription_id ON subscription_orders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_order_id ON subscription_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_status ON subscription_orders(status);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_scheduled ON subscription_orders(scheduled_delivery_date);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_pending 
    ON subscription_orders(status, scheduled_delivery_date) 
    WHERE status IN ('SCHEDULED', 'PENDING');

-- ============================================================
-- 5. ADD SUBSCRIPTION REFERENCE TO ORDERS TABLE
-- ============================================================

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_subscription_order BOOLEAN DEFAULT false;

-- Index for subscription orders
CREATE INDEX IF NOT EXISTS idx_orders_subscription_id ON orders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_subscription ON orders(is_subscription_order) WHERE is_subscription_order = true;

-- ============================================================
-- 6. UPDATE SAMPLE PRODUCTS WITH HEALTH GUIDANCE (Optional)
-- Run these only if you want to update existing products
-- ============================================================

-- Example: Update a juice product with morning recommendation
-- UPDATE products SET 

--     health_notes = 'Best consumed on an empty stomach for maximum nutrient absorption',
--     best_before_food = true,
--     health_tags = ARRAY['Immune Boost', 'Vitamin C', 'Detox']
-- WHERE name ILIKE '%orange%' OR name ILIKE '%citrus%';

-- Example: Update a smoothie product with evening recommendation
-- UPDATE products SET 

--     health_notes = 'Rich in antioxidants, perfect for post-workout recovery',
--     best_before_food = false,
--     health_tags = ARRAY['Protein', 'Recovery', 'Energy']
-- WHERE name ILIKE '%protein%' OR name ILIKE '%smoothie%';

-- ============================================================
-- 7. CREATE HELPER FUNCTION FOR SUBSCRIPTION PROCESSING
-- ============================================================

-- Function to get subscriptions due for processing today
CREATE OR REPLACE FUNCTION get_due_subscriptions()
RETURNS TABLE (
    subscription_id UUID,
    user_id UUID,
    product_id UUID,
    quantity INTEGER,
    price_per_delivery DECIMAL(10,2),
    delivery_address_id UUID,
    payment_method VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as subscription_id,
        s.user_id,
        s.product_id,
        s.quantity,
        s.price_per_delivery,
        s.delivery_address_id,
        s.payment_method
    FROM subscriptions s
    WHERE s.status = 'ACTIVE'
      AND s.next_delivery_date <= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. ADD TRIGGER FOR UPDATED_AT TIMESTAMPS
-- ============================================================

-- Create or replace the timestamp update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to new tables
DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS subscription_orders_updated_at ON subscription_orders;
CREATE TRIGGER subscription_orders_updated_at
    BEFORE UPDATE ON subscription_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MIGRATION COMPLETE!
-- 
-- Summary of changes:
-- 1. Added health guidance fields to products table
-- 2. Added preferred_delivery_time to cart_items table
-- 3. Created subscriptions table for managing recurring orders
-- 4. Created subscription_orders table for tracking deliveries
-- 5. Added subscription reference to orders table
-- 6. Created indexes for performance
-- 7. Added helper function for processing due subscriptions
-- 8. Added timestamp triggers
-- ============================================================

-- Verify the migration
SELECT 'Migration completed successfully!' as status;

-- Show new columns added to products
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND column_name IN ('health_notes', 'best_before_food', 'health_tags');

-- Show subscriptions table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'subscriptions'
ORDER BY ordinal_position;
