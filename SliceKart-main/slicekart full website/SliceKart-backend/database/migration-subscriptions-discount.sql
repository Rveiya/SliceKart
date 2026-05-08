-- Add initial_discount to subscriptions table
ALTER TABLE subscriptions
ADD COLUMN initial_discount NUMERIC(10, 2) DEFAULT 0;
