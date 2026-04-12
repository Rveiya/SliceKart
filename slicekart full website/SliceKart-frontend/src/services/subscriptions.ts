import api from './api';

export interface Subscription {
    id: string;
    subscription_type: 'weekly' | 'monthly';
    quantity: number;
    preferred_delivery_time: 'morning' | 'afternoon' | 'evening';
    preferred_delivery_day?: string;
    status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
    price_per_delivery: number;
    next_delivery_date: string | null;
    last_delivery_date: string | null;
    total_deliveries: number;
    payment_method: string;
    created_at: string;
    product: {
        id: string;
        name: string;
        description: string;
        price: number;
        image_url: string;
        volume: string;
        health_notes?: string;
    };
    delivery_address: {
        name: string;
        street: string;
        city: string;
        state: string;
        pincode: string;
        phone?: string;
    } | null;
}

export interface CreateSubscriptionData {
    product_id: string;
    subscription_type: 'weekly' | 'monthly';
    quantity?: number;
    preferred_delivery_time?: 'morning' | 'afternoon' | 'evening';
    preferred_delivery_day?: string;
    delivery_address_id?: string;
    payment_method?: 'COD' | 'ONLINE';
}

export interface UpdateSubscriptionData {
    quantity?: number;
    preferred_delivery_time?: 'morning' | 'afternoon' | 'evening';
    preferred_delivery_day?: string;
    delivery_address_id?: string;
    payment_method?: 'COD' | 'ONLINE';
}

export const subscriptionsService = {
    // Get all user subscriptions
    async getAll(status?: string): Promise<Subscription[]> {
        const params = status ? `?status=${status}` : '';
        const response = await api.get<{ subscriptions: Subscription[] }>(`/subscriptions${params}`);
        return response.data.subscriptions;
    },

    // Get single subscription
    async getById(id: string): Promise<Subscription> {
        const response = await api.get<{ subscription: Subscription }>(`/subscriptions/${id}`);
        return response.data.subscription;
    },

    // Create subscription
    async create(data: CreateSubscriptionData): Promise<Subscription> {
        const response = await api.post<{ subscription: Subscription }>('/subscriptions', data);
        return response.data.subscription;
    },

    // Update subscription
    async update(id: string, data: UpdateSubscriptionData): Promise<Subscription> {
        const response = await api.put<{ subscription: Subscription }>(`/subscriptions/${id}`, data);
        return response.data.subscription;
    },

    // Pause subscription
    async pause(id: string): Promise<Subscription> {
        const response = await api.post<{ subscription: Subscription }>(`/subscriptions/${id}/pause`);
        return response.data.subscription;
    },

    // Resume subscription
    async resume(id: string): Promise<Subscription> {
        const response = await api.post<{ subscription: Subscription }>(`/subscriptions/${id}/resume`);
        return response.data.subscription;
    },

    // Cancel subscription
    async cancel(id: string): Promise<Subscription> {
        const response = await api.post<{ subscription: Subscription }>(`/subscriptions/${id}/cancel`);
        return response.data.subscription;
    }
};
