import { useState, useEffect } from 'react';
import { couponService, Coupon } from '../services/coupons';
import { toast } from 'react-hot-toast';
import { Tag } from 'lucide-react';

export default function CouponsPage() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCoupons = async () => {
            try {
                const response = await couponService.getAvailableCoupons();
                if (response.success) {
                    setCoupons(response.coupons);
                } else {
                    toast.error('Could not load coupons.');
                }
            } catch (error) {
                console.error('Error fetching coupons:', error);
                toast.error('Could not load coupons.');
            } finally {
                setLoading(false);
            }
        };

        fetchCoupons();
    }, []);

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast.success(`Coupon "${code}" copied to clipboard!`);
    };

    const getDiscountDisplay = (coupon: Coupon): string => {
        if (coupon.discount_type === 'percentage') {
            return `${coupon.discount_value}% OFF`;
        } else {
            return `₹${coupon.discount_value} OFF`;
        }
    };

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
                        Available Coupons
                    </h1>
                    <p className="mt-4 text-xl text-gray-600">
                        Apply these coupons at checkout to get exciting discounts on your orders.
                    </p>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-white p-6 rounded-lg shadow-md animate-pulse">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                            </div>
                        ))}
                    </div>
                ) : coupons.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {coupons.map((coupon) => (
                            <div key={coupon.id} className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                                            <Tag className="w-6 h-6 mr-2 text-green-500" />
                                            {coupon.code}
                                        </h2>
                                        <p className="text-gray-600 mt-2">{coupon.description || 'Get discount on your order'}</p>
                                        <p className="text-lg font-bold text-green-600 mt-3">{getDiscountDisplay(coupon)}</p>
                                    </div>
                                    <button
                                        onClick={() => handleCopyCode(coupon.code)}
                                        className="text-sm font-semibold text-green-600 hover:text-green-800 transition-colors"
                                    >
                                        COPY
                                    </button>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-500 space-y-1">
                                    <p>Min Order: <span className="font-semibold">₹{coupon.min_order_amount}</span></p>
                                    {coupon.max_discount_amount && (
                                        <p>Max Discount: <span className="font-semibold">₹{coupon.max_discount_amount}</span></p>
                                    )}
                                    {coupon.usage_limit && (
                                        <p>Usage Limit: <span className="font-semibold">{coupon.usage_limit}</span></p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <Tag className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No Coupons Available</h3>
                        <p className="mt-1 text-sm text-gray-500">Check back later for new offers.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
