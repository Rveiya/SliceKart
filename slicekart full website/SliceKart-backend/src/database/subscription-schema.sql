-- =============================================
-- SUBSCRIPTION SYSTEM SCHEMA
-- =============================================

-- Add health guidance fields to products

ALTER TABLE products ADD COLUMN IF NOT EXISTS health_notes TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS best_before_food BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS health_tags TEXT[];

-- =============================================
-- SUBSCRIPTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    subscription_type VARCHAR(20) NOT NULL CHECK (subscription_type IN ('weekly', 'monthly')),
    quantity INTEGER NOT NULL DEFAULT 1,
    preferred_delivery_time VARCHAR(20) DEFAULT 'morning' CHECK (preferred_delivery_time IN ('morning', 'afternoon', 'evening')),
    preferred_delivery_day VARCHAR(10), -- For weekly: 'monday', 'tuesday', etc. For monthly: day number like '1', '15'
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED')),
    price_per_delivery DECIMAL(10, 2) NOT NULL,
    next_delivery_date DATE,
    last_delivery_date DATE,
    delivery_address_id UUID REFERENCES addresses(id),
    total_deliveries INTEGER DEFAULT 0,
    payment_method VARCHAR(20) DEFAULT 'COD' CHECK (payment_method IN ('COD', 'ONLINE', 'UPI', 'CARD')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- SUBSCRIPTION ORDERS TABLE (Track each delivery)
-- =============================================
CREATE TABLE IF NOT EXISTS subscription_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    scheduled_delivery_date DATE NOT NULL,
    actual_delivery_date DATE,
    status VARCHAR(20) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED')),
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_time DECIMAL(10, 2),
    skip_reason TEXT,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add subscription reference to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_subscription_order BOOLEAN DEFAULT false;

-- Add subscription reference to cart items for delivery time preference
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS preferred_delivery_time VARCHAR(20) 
    CHECK (preferred_delivery_time IN ('morning', 'afternoon', 'evening', NULL));

-- =============================================
-- INDEXES FOR SUBSCRIPTIONS
-- =============================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_delivery ON subscriptions(next_delivery_date);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_subscription_id ON subscription_orders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_orders_scheduled ON subscription_orders(scheduled_delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_subscription_id ON orders(subscription_id);
