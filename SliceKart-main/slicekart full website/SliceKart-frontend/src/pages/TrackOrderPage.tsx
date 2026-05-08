import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Check,
    MessageSquare,
    Phone,
    MapPin,
    FileText,
    Star,
    CreditCard,
    Banknote
} from 'lucide-react';
import { Order } from '../types';
import OrderSuccessModal from '../components/OrderSuccessModal';
import ordersService from '../services/orders';

const orderStatuses = [
    { key: 'PENDING', label: 'Order Placed' },
    { key: 'ACCEPTED', label: 'Accepted' },
    { key: 'DELIVERED', label: 'Delivered' },
];

export default function TrackOrderPage() {
    const { id: orderId } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showDeliveredModal, setShowDeliveredModal] = useState(false);

    useEffect(() => {
        if (orderId) {
            fetchOrder();
        }
    }, [orderId]);

    const fetchOrder = async () => {
        if (!orderId) return;

        setIsLoading(true);
        setError('');
        try {
            const orderData = await ordersService.track(orderId);
            setOrder(orderData);

            if (orderData.status === 'DELIVERED') {
                setShowDeliveredModal(true);
            }
        } catch (err) {
            console.error('Failed to fetch order:', err);
            setError('Failed to load order. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const getCurrentStatusIndex = () => {
        if (!order) return -1;
        return orderStatuses.findIndex(s => s.key === order.status);
    };

    const handleBackToProducts = () => {
        setShowDeliveredModal(false);
        navigate('/products');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 text-xl font-medium mb-4">{error || 'Order not found'}</div>
                    <button
                        onClick={() => navigate('/orders')}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                        View All Orders
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="min-h-screen bg-warm-cream">
                <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20 py-6">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-xl font-bold text-gray-900">Track Order</h1>
                        <button
                            onClick={fetchOrder}
                            className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                        >
                            Refresh Status
                        </button>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-5">
                        {/* Order Items */}
                        <div className="mb-6">
                            <h2 className="text-sm text-gray-500 mb-3">Your Items</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {order.items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                        <img
                                            src={item.product.image_url}
                                            alt={item.product.name}
                                            className="w-12 h-12 rounded-lg object-cover"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 text-sm">{item.product.name}</h3>
                                            <p className="text-xs text-gray-400">{item.product.volume}</p>
                                            <p className="text-green-600 font-medium text-sm">₹{item.price}</p>
                                        </div>
                                        <div className="bg-green-600 text-white w-8 h-8 rounded-lg text-sm font-medium flex items-center justify-center">
                                            {item.quantity}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Delivery Status */}
                        <div className="py-4 border-t border-gray-100">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                                <p className="text-green-600 font-semibold text-sm">
                                    Expected Time {order.expected_delivery_time || '30 mins'}
                                </p>
                                <div className="flex items-center gap-6 text-xs">
                                    <span className="text-gray-500">
                                        Delivery Time : <span className="text-green-600 font-medium">{order.expected_delivery_time || '30 mins'}</span>
                                    </span>
                                    <span className="text-gray-500">
                                        Distance : <span className="text-green-600 font-medium">{order.distance || '10 kms'}</span>
                                    </span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="relative px-6 py-4 bg-gradient-to-r from-green-50/50 to-emerald-50/50 rounded-xl">
                                {/* Background track */}
                                <div className="absolute top-[2.25rem] left-10 right-10 h-1 bg-gray-200 rounded-full" />
                                {/* Active progress line */}
                                <div
                                    className="absolute top-[2.25rem] left-10 h-1 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `calc(${(getCurrentStatusIndex() / (orderStatuses.length - 1)) * 100}% - 2rem)` }}
                                />
                                <div className="relative flex justify-between">
                                    {orderStatuses.map((status, index) => {
                                        const isCompleted = index <= getCurrentStatusIndex();
                                        const isCurrent = index === getCurrentStatusIndex();
                                        return (
                                            <div key={status.key} className="flex flex-col items-center relative">
                                                {/* Status circle */}
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all duration-500 shadow-sm ${isCompleted
                                                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-200'
                                                    : 'bg-white border-2 border-gray-200'
                                                    } ${isCurrent ? 'ring-4 ring-green-100 animate-pulse' : ''}`}>
                                                    {isCompleted && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                                                </div>
                                                {/* Status label */}
                                                <span className={`mt-3 text-xs font-semibold transition-colors text-center ${isCurrent
                                                    ? 'text-green-600'
                                                    : isCompleted
                                                        ? 'text-green-600'
                                                        : 'text-gray-400'
                                                    }`}>
                                                    {status.label}
                                                </span>
                                                {/* Current status indicator */}
                                                {isCurrent && (
                                                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                        Current
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Order Details Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-4 border-t border-gray-100 mt-4">
                            {/* Bill Summary */}
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-gray-400" />
                                        <h3 className="font-semibold text-gray-900 text-sm">Bill Summary</h3>
                                    </div>
                                    {/* Payment Status */}
                                    {order.payment_status === 'COMPLETED' && (
                                        <span className="text-green-600 font-semibold text-sm">Payment Successful</span>
                                    )}
                                    {order.payment_method === 'COD' && order.payment_status !== 'COMPLETED' && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                            <Banknote className="w-3 h-3" />
                                            Pay on Delivery
                                        </span>
                                    )}
                                    {order.payment_status === 'PENDING' && order.payment_method === 'ONLINE' && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                                            <CreditCard className="w-3 h-3" />
                                            Payment Pending
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Items Total</span>
                                        <span className="text-gray-900">₹{(order.total_amount - order.delivery_fee - (order.handling_fee || 0) - order.gst).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Delivery Fee</span>
                                        <span className={order.delivery_fee > 0 ? "text-gray-900" : "text-green-600 font-medium"}>{order.delivery_fee > 0 ? `₹${order.delivery_fee}` : 'Free'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Handling Fee</span>
                                        <span className="text-gray-900">{order.handling_fee > 0 ? `₹${order.handling_fee}` : 'Free'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">GST Charges (18%)</span>
                                        <span className="text-gray-900">₹{order.gst}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-gray-200">
                                        <span className="font-semibold text-gray-900">Total Amount</span>
                                        <span className="font-bold text-gray-900">₹{order.total_amount}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Partner */}
                            {order.delivery_partner && (
                                <div className="p-4 bg-gray-50 rounded-xl">
                                    <h3 className="font-semibold text-gray-900 text-sm mb-3">Delivery Partner</h3>
                                    <div className="flex items-center gap-3 mb-3">
                                        <img
                                            src={order.delivery_partner.image_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop'}
                                            alt={order.delivery_partner.name}
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                        <div>
                                            <p className="font-semibold text-gray-900 text-sm">{order.delivery_partner.name}</p>
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`w-3 h-3 ${i < Math.floor(order.delivery_partner!.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                                    />
                                                ))}
                                                <span>({order.delivery_partner.rating} Rating)</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-gray-700 text-sm hover:bg-white transition-colors">
                                            <MessageSquare className="w-4 h-4" />
                                            Message
                                        </button>
                                        <a
                                            href={`tel:${order.delivery_partner.phone}`}
                                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                                        >
                                            <Phone className="w-4 h-4" />
                                            Call
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Delivery Address */}
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <div className="flex items-start gap-2 mb-3">
                                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <MapPin className="w-4 h-4 text-green-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-gray-900 text-sm">Delivering to {order.delivery_address.name}</h3>
                                        <p className="text-xs text-gray-500">
                                            {order.delivery_address.name}, {order.delivery_address.street}, {order.delivery_address.city}
                                        </p>
                                        <a href={`tel:${order.delivery_address.phone}`} className="text-green-600 font-medium text-xs">
                                            {order.delivery_address.phone}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Order Delivered Success Modal */}
            <OrderSuccessModal
                isOpen={showDeliveredModal}
                onClose={() => setShowDeliveredModal(false)}
                onBackToProducts={handleBackToProducts}
                savedAmount={30}
                variant="delivered"
            />
        </>
    );
}
