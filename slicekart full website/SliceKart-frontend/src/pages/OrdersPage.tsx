import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, ChevronRight, Clock, MapPin, AlertCircle, ShieldCheck, CreditCard, Banknote } from 'lucide-react';
import { Order } from '../types';
import ordersService from '../services/orders';

const statusColors: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    ACCEPTED: { bg: 'bg-blue-100', text: 'text-blue-700' },
    ON_THE_WAY: { bg: 'bg-purple-100', text: 'text-purple-700' },
    DELIVERED: { bg: 'bg-green-100', text: 'text-green-700' },
    CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
};

const statusLabels: Record<string, string> = {
    PENDING: 'Pending',
    ACCEPTED: 'Accepted',
    ON_THE_WAY: 'On the Way',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
};

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setIsLoading(true);
        setError('');
        try {
            const ordersData = await ordersService.getAll();
            setOrders(ordersData);
        } catch (err) {
            console.error('Failed to fetch orders:', err);
            setError('Failed to load orders. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 animate-pulse">
                                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
                                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                                <div className="h-3 bg-gray-200 rounded w-1/3" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <div className="text-red-500 text-xl font-medium mb-4">{error}</div>
                    <button
                        onClick={fetchOrders}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-warm-cream">
            <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20 py-10">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
                    <span className="text-gray-500 text-sm">{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
                </div>

                {orders.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">No orders yet</h2>
                        <p className="text-gray-500 mb-6">Start shopping to see your orders here!</p>
                        <Link
                            to="/products"
                            className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                        >
                            Browse Products
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <Link
                                key={order.id}
                                to={`/track-order/${order.id}`}
                                className="block bg-white rounded-xl p-5 hover:shadow-md transition-shadow border border-gray-100"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status]?.bg} ${statusColors[order.status]?.text}`}>
                                                {statusLabels[order.status]}
                                            </span>
                                            {/* Payment Status Badge */}
                                            {order.payment_status === 'COMPLETED' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200 shadow-sm">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                    <span>
                                                        {order.method_details
                                                            ? order.method_details.method === 'upi' ? `Paid via UPI${order.method_details.vpa ? ` (${order.method_details.vpa})` : ''}`
                                                                : order.method_details.method === 'card' ? 'Paid via Card'
                                                                    : order.method_details.method === 'netbanking' ? `Paid via ${order.method_details.bank || 'Netbanking'}`
                                                                        : order.method_details.method === 'wallet' ? `Paid via ${order.method_details.wallet || 'Wallet'}`
                                                                            : 'Paid Securely'
                                                            : 'Paid Securely'}
                                                    </span>
                                                    {order.payment_method === 'ONLINE' && (
                                                        <CreditCard className="w-3 h-3 text-emerald-500 ml-0.5" />
                                                    )}
                                                </span>
                                            ) : order.payment_method === 'COD' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                                    <Banknote className="w-3.5 h-3.5" />
                                                    <span>Cash on Delivery</span>
                                                </span>
                                            ) : order.payment_status === 'PENDING' && order.payment_method === 'ONLINE' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                                                    <CreditCard className="w-3.5 h-3.5" />
                                                    <span>Payment Pending</span>
                                                </span>
                                            ) : null}
                                            <span className="text-gray-500 text-xs">
                                                Order #{order.id.slice(0, 8).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {formatDate(order.created_at)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-4 h-4" />
                                                {order.delivery_address.city}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>

                                <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                                    <div className="flex -space-x-2">
                                        {order.items.slice(0, 3).map((item, i) => (
                                            <img
                                                key={i}
                                                src={item.product.image_url}
                                                alt={item.product.name}
                                                className="w-10 h-10 rounded-lg object-cover border-2 border-white"
                                            />
                                        ))}
                                        {order.items.length > 3 && (
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                                                +{order.items.length - 3}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-900 font-medium">
                                            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-green-600">₹{order.total_amount}</p>
                                    </div>
                                </div>

                                {/* Delivery Partner Info */}
                                {order.delivery_partner && (
                                    <div className="flex items-center gap-3 border-t border-gray-100 pt-3 mt-3">
                                        <div className="flex items-center gap-2.5 bg-blue-50 rounded-xl px-3.5 py-2 flex-1">
                                            {order.delivery_partner.image_url ? (
                                                <img
                                                    src={order.delivery_partner.image_url}
                                                    alt={order.delivery_partner.name}
                                                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                    {order.delivery_partner.name?.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{order.delivery_partner.name}</p>
                                                <p className="text-xs text-gray-500">{order.delivery_partner.phone}</p>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                <span className="text-xs font-semibold text-gray-700">{parseFloat(String(order.delivery_partner.rating || 0)).toFixed(1)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
