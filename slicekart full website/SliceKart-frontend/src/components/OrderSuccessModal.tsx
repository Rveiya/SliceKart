import { Check } from 'lucide-react';

interface OrderSuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTrackOrder?: () => void;
    onBackToProducts: () => void;
    savedAmount?: number;
    variant?: 'placed' | 'delivered';
}

export default function OrderSuccessModal({
    isOpen,
    onClose,
    onTrackOrder,
    onBackToProducts,
    savedAmount = 30,
    variant = 'placed'
}: OrderSuccessModalProps) {
    if (!isOpen) return null;

    const title = variant === 'delivered'
        ? 'Your Order Delivered Successfully'
        : 'Your Order Placed Successfully';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
                {/* Success Icon */}
                <div className="flex justify-center mb-6">
                    <div className="relative">
                        {/* Decorative elements */}
                        <div className="absolute -top-2 -left-4 w-2 h-2 bg-green-400 rounded-full"></div>
                        <div className="absolute -top-4 left-6 w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                        <div className="absolute top-2 -right-6 w-2 h-2 bg-blue-400 rounded-full"></div>
                        <div className="absolute -bottom-2 -left-6 w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                        <div className="absolute -bottom-4 right-4 w-2 h-2 bg-pink-400 rounded-full"></div>
                        <div className="absolute top-8 -left-8 w-1 h-1 bg-yellow-400 rounded-full"></div>
                        <div className="absolute top-6 -right-8 w-1.5 h-1.5 bg-red-400 rounded-full"></div>

                        {/* Main circle with checkmark */}
                        <div className="w-24 h-24 rounded-full bg-green-50 border-4 border-green-500 flex items-center justify-center">
                            <Check className="w-12 h-12 text-green-500" strokeWidth={3} />
                        </div>
                    </div>
                </div>

                {/* Success Text */}
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-green-600 mb-2 whitespace-pre-line">
                        {title.split(' ').slice(0, -1).join(' ')}<br />
                        {title.split(' ').slice(-1)}
                    </h2>
                    <p className="text-green-600 text-sm">
                        You saved ₹{savedAmount} on this order
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    {variant === 'placed' && onTrackOrder ? (
                        <>
                            <button
                                onClick={onTrackOrder}
                                className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-all active:scale-[0.99] text-sm"
                            >
                                Track Order
                            </button>
                            <button
                                onClick={onBackToProducts}
                                className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-all active:scale-[0.99] text-sm"
                            >
                                Back to Products
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onBackToProducts}
                            className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition-all active:scale-[0.99] text-sm"
                        >
                            Back to Products
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
