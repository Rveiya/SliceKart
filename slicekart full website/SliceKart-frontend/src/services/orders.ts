import api from './api';
import { Order } from '../types';

export interface CreateOrderData {
    items: Array<{
        product_id: string;
        quantity: number;
    }>;
    delivery_address_id: string;
    delivery_fee?: number;
    handling_fee?: number;
    payment_method?: 'COD' | 'ONLINE' | 'UPI' | 'CARD';
}

interface OrdersResponse {
    orders: Order[];
}

interface OrderResponse {
    order: Order;
}

export const ordersService = {
    // Get all orders for current user
    getAll: async (): Promise<Order[]> => {
        const response = await api.get<OrdersResponse>('/orders');
        return response.data.orders;
    },

    // Get order by ID
    getById: async (id: string): Promise<Order> => {
        const response = await api.get<OrderResponse>(`/orders/${id}`);
        return response.data.order;
    },

    // Create a new order
    create: async (data: CreateOrderData): Promise<Order> => {
        const response = await api.post<OrderResponse>('/orders', data);
        return response.data.order;
    },

    // Cancel an order
    cancel: async (id: string): Promise<void> => {
        await api.post(`/orders/${id}/cancel`);
    },

    // Track an order
    track: async (id: string): Promise<Order> => {
        const response = await api.get<OrderResponse>(`/orders/${id}/track`);
        return response.data.order;
    },

    // Update order status (admin only)
    updateStatus: async (id: string, status: string, additionalData?: {
        delivery_partner_id?: string;
        expected_delivery_time?: string;
        distance?: string;
    }): Promise<Order> => {
        const response = await api.patch<OrderResponse>(`/orders/${id}/status`, {
            status,
            ...additionalData
        });
        return response.data.order;
    }
};

export default ordersService;
