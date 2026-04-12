import { useState } from 'react';
import { couponService } from '../../services/coupons';

interface CouponInputProps {
    subtotal: number;
    onCouponApplied: (couponCode: string, discount: number) => void;
    onCouponRemoved: () => void;
}

export default function CouponInput({ subtotal, onCouponApplied, onCouponRemoved }: CouponInputProps) {
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleValidate = async () => {
        if (!couponCode.trim()) {
            setError('Please enter a coupon code');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await couponService.validateCoupon(couponCode, subtotal);

            if (response.success) {
                setAppliedCoupon({
                    code: couponCode.toUpperCase(),
                    discount: response.discount_amount
                });
                setSuccess(`Coupon applied! Save ₹${response.discount_amount.toFixed(2)}`);
                onCouponApplied(couponCode.toUpperCase(), response.discount_amount);
                setCouponCode('');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || 'Failed to validate coupon';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = () => {
        setAppliedCoupon(null);
        setError('');
        setSuccess('');
        onCouponRemoved();
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleValidate();
        }
    };

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Apply Coupon</h3>
                {appliedCoupon && (
                    <span className="text-sm text-emerald-600 font-medium">
                        ✓ Applied
                    </span>
                )}
            </div>

            {!appliedCoupon ? (
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Enter coupon code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        onKeyPress={handleKeyPress}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                    <button
                        onClick={handleValidate}
                        disabled={loading}
                        className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Validating...' : 'Apply'}
                    </button>
                </div>
            ) : (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div>
                        <p className="text-sm font-semibold text-emerald-900">
                            {appliedCoupon.code}
                        </p>
                        <p className="text-xs text-emerald-700">
                            Discount: ₹{appliedCoupon.discount.toFixed(2)}
                        </p>
                    </div>
                    <button
                        onClick={handleRemove}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                    >
                        Remove
                    </button>
                </div>
            )}

            {error && (
                <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-700">{error}</p>
                </div>
            )}

            {success && (
                <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-xs text-emerald-700">{success}</p>
                </div>
            )}
        </div>
    );
}
