import api from './api';
import { Order } from '../types';
import { Subscription } from './subscriptions';

export interface CheckoutResult {
    success: boolean;
    message: string;
    order: Order | null;
    subscriptions: Subscription[];
    subscriptionOrders: Order[];
}

export interface CheckoutFromProductResult {
    success: boolean;
    message: string;
    type: 'order' | 'subscription';
    order?: Order;
    subscription?: Subscription;
}

export interface CheckoutData {
    delivery_address_id: string;
    delivery_fee?: number;
    handling_fee?: number;
    payment_method?: 'COD' | 'ONLINE';
    tip?: number;
    coupon_code?: string;
}

export interface CheckoutFromProductData {
    product_id: string;
    quantity?: number;
    subscription_type?: 'one-time' | 'weekly' | 'monthly';
    preferred_delivery_time?: 'morning' | 'afternoon' | 'evening';
    delivery_address_id: string;
    delivery_fee?: number;
    payment_method?: 'COD' | 'ONLINE';
}

export const checkoutService = {
    /**
     * Checkout with cart items
     * Creates orders for one-time items and subscriptions for recurring items
     */
    async checkout(data: CheckoutData): Promise<CheckoutResult> {
        const response = await api.post<CheckoutResult>('/checkout', data);
        return response.data;
    },

    /**
     * Direct checkout from product page
     * Creates order or subscription without going through cart
     */
    async checkoutFromProduct(data: CheckoutFromProductData): Promise<CheckoutFromProductResult> {
        const response = await api.post<CheckoutFromProductResult>('/checkout/from-product', data);
        return response.data;
    }
};
