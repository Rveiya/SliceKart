import api from './api';

export interface Coupon {
    id: string;
    code: string;
    description: string | null;
    discount_type: 'percentage' | 'flat';
    discount_value: number;
    min_order_amount: number;
    max_discount_amount: number | null;
    usage_limit: number | null;
    used_count: number;
}

export interface CouponValidationResponse {
    success: boolean;
    coupon: {
        id: string;
        code: string;
        description: string | null;
        discount_type: 'percentage' | 'flat';
        discount_value: number;
        max_discount_amount: number | null;
    };
    discount_amount: number;
    total_after_discount: number;
}

export const couponService = {
    /**
     * Get all available coupons for customers
     */
    async getAvailableCoupons(): Promise<{ success: boolean; coupons: Coupon[] }> {
        const response = await api.get<{ success: boolean; coupons: Coupon[] }>('/coupons');
        return response.data;
    },

    /**
     * Validate a coupon code and preview discount
     */
    async validateCoupon(couponCode: string, subtotal: number): Promise<CouponValidationResponse> {
        const response = await api.post<CouponValidationResponse>('/coupons/validate', {
            coupon_code: couponCode,
            subtotal
        });
        return response.data;
    }
};
