import api from './api';
import { CartItem } from '../types';

export interface StockValidationItem {
    id: string;
    quantity: number;
    available_stock: number;
    max_available?: number;
    requested_quantity?: number;
    product: {
        id: string;
        name: string;
        price: number;
        image_url: string;
        volume: string;
        stock: number;
    };
}

export interface CartValidationResult {
    valid: boolean;
    validItems: StockValidationItem[];
    insufficientStockItems: StockValidationItem[];
    outOfStockItems: StockValidationItem[];
    summary: {
        totalItems: number;
        validCount: number;
        insufficientCount: number;
        outOfStockCount: number;
    };
}

export interface CartAdjustment {
    product_id: string;
    product_name: string;
    action: 'removed' | 'adjusted';
    reason: 'out_of_stock' | 'insufficient_stock';
    previous_quantity: number;
    new_quantity?: number;
}

export interface CartAdjustResult {
    message: string;
    adjustments: CartAdjustment[];
    items: CartItem[];
    total: number;
    count: number;
}

export const cartApi = {
    get: () =>
        api.get<{ items: CartItem[], total: number, count: number }>('/carts'),

    addItem: (
        productId: string,
        quantity: number = 1,
        subscriptionType: 'weekly' | 'monthly' | 'one-time' = 'one-time',
        preferredDeliveryTime?: 'morning' | 'afternoon' | 'evening'
    ) =>
        api.post<{ item: CartItem }>('/carts', {
            product_id: productId,
            quantity,
            subscription_type: subscriptionType,
            preferred_delivery_time: preferredDeliveryTime
        }),

    updateItem: (itemId: string, quantity: number) =>
        api.put<{ item: CartItem }>(`/carts/${itemId}`, { quantity }),

    removeItem: (itemId: string) =>
        api.delete(`/carts/${itemId}`),

    clear: () =>
        api.delete('/carts'),

    sync: (items: CartItem[]) =>
        api.post<{ items: CartItem[] }>('/carts/sync', {
            items: items.map(item => ({
                product_id: item.product.id,
                quantity: item.quantity,
                subscription_type: item.subscription_type
            }))
        }),

    // Validate cart items against current stock levels
    validate: () =>
        api.post<CartValidationResult>('/carts/validate', {}),

    // Auto-adjust cart quantities to available stock
    adjust: () =>
        api.post<CartAdjustResult>('/carts/adjust', {})
};
