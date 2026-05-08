import api from './api';

export interface CreateRazorpayOrderData {
    order_id: string; // Our internal order ID - amount will be fetched from database
}

export interface RazorpayOrderResponse {
    success: boolean;
    order: {
        id: string;
        amount: number;
        currency: string;
        receipt: string;
    };
    key_id: string;
}

export interface VerifyPaymentData {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    order_id: string; // Our internal order ID
}

export interface PaymentVerificationResponse {
    success: boolean;
    message: string;
    payment?: {
        id: string;
        order_id: string;
        razorpay_order_id: string;
        razorpay_payment_id: string;
        amount: number;
        status: string;
    };
}

// Razorpay checkout options interface
export interface RazorpayCheckoutOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpayResponse) => void;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    notes?: Record<string, string>;
    theme?: {
        color?: string;
    };
    modal?: {
        ondismiss?: () => void;
    };
}

export interface RazorpayResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

// Extend Window interface for Razorpay
declare global {
    interface Window {
        Razorpay: new (options: RazorpayCheckoutOptions) => {
            open: () => void;
            close: () => void;
        };
    }
}

export const paymentsService = {
    // Create a Razorpay order
    createRazorpayOrder: async (data: CreateRazorpayOrderData): Promise<RazorpayOrderResponse> => {
        const response = await api.post<RazorpayOrderResponse>('/payments/create-order', data);
        return response.data;
    },

    // Verify payment after successful Razorpay checkout
    verifyPayment: async (data: VerifyPaymentData): Promise<PaymentVerificationResponse> => {
        const response = await api.post<PaymentVerificationResponse>('/payments/verify', data);
        return response.data;
    },

    // Load Razorpay script dynamically
    loadRazorpayScript: (): Promise<boolean> => {
        return new Promise((resolve) => {
            // Check if script is already loaded
            if (window.Razorpay) {
                resolve(true);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    },

    // Initialize and open Razorpay checkout
    // Note: Amount is fetched from database on backend for security (prevents frontend tampering)
    initiatePayment: async (
        orderId: string,
        userDetails: { name?: string; email?: string; phone?: string },
        onSuccess: (response: RazorpayResponse) => void,
        onDismiss?: () => void
    ): Promise<void> => {
        // Load Razorpay script
        const isLoaded = await paymentsService.loadRazorpayScript();
        if (!isLoaded) {
            throw new Error('Failed to load Razorpay SDK');
        }

        // Create Razorpay order - backend fetches amount from database
        const orderResponse = await paymentsService.createRazorpayOrder({
            order_id: orderId
        });

        if (!orderResponse.success || !orderResponse.order) {
            throw new Error('Failed to create Razorpay order');
        }

        // Configure Razorpay checkout options
        const options: RazorpayCheckoutOptions = {
            key: orderResponse.key_id,
            amount: orderResponse.order.amount,
            currency: orderResponse.order.currency,
            name: 'SliceKart',
            description: 'Order Payment',
            order_id: orderResponse.order.id,
            handler: onSuccess,
            prefill: {
                name: userDetails.name || '',
                email: userDetails.email || '',
                contact: userDetails.phone || ''
            },
            notes: {
                order_id: orderId
            },
            theme: {
                color: '#16a34a' // Green color matching the app theme
            },
            modal: {
                ondismiss: onDismiss
            }
        };

        // Open Razorpay checkout
        const razorpay = new window.Razorpay(options);
        razorpay.open();
    }
};

export default paymentsService;
