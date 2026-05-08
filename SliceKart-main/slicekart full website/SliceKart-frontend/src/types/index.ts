export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    original_price?: number;
    discount?: number;
    category: string;
    image_url: string;
    image_url_signed?: string | null; // Presigned URL for R2 images
    images?: string[];
    images_signed?: (string | null)[]; // Presigned URLs for R2 images
    volume: string;
    stock: number;
    rating?: number;
    nutrition?: {
        protein: string;
        carbs: string;
        sugar: string;
        fiber: string;
    };
    benefits?: string[];
    return_policy?: boolean;
    cash_on_delivery?: boolean;
    allow_cancellation?: boolean;
    // Health guidance fields
    health_notes?: string;
    best_before_food?: boolean;
    health_tags?: string[];
}

export interface CartItem {
    id: string;
    product: Product;
    quantity: number;
    subscription_type?: 'weekly' | 'monthly' | 'one-time';
    preferred_delivery_time?: 'morning' | 'afternoon' | 'evening';
}

export interface User {
    id: string;
    fullname: string;
    email: string;
    role: 'ADMIN' | 'CUSTOMER';
    phone?: string;
    address?: Address;
}

export interface Address {
    id: string;
    name: string;
    flat_no?: string;
    building_name?: string;
    area?: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    address_type?: 'Home' | 'Work' | 'Other';
    is_default?: boolean;
}

export interface Order {
    id: string;
    user_id: string;
    items: OrderItem[];
    total_amount: number;
    delivery_fee: number;
    handling_fee: number;
    gst: number;
    status: OrderStatus;
    payment_status?: PaymentStatus;
    payment_method?: PaymentMethod;
    delivery_address: Address;
    delivery_partner?: DeliveryPartner;
    expected_delivery_time?: string;
    distance?: string;
    created_at: string;
    updated_at: string;
    method_details?: {
        method?: string;
        wallet?: string;
        bank?: string;
        vpa?: string;
        card_id?: string;
    };
}

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'COD' | 'ONLINE' | 'UPI' | 'CARD';

export interface OrderItem {
    id: string;
    product: Product;
    quantity: number;
    price: number;
}

export type OrderStatus = 'PENDING' | 'ACCEPTED' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED';

export interface DeliveryPartner {
    id: string;
    name: string;
    phone: string;
    rating: number;
    image_url?: string;
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

export interface CartState {
    items: CartItem[];
    total: number;
}
