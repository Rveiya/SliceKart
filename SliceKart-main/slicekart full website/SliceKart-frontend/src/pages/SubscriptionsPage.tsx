import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, Clock, Package, Play, Pause, X, MapPin,
    RefreshCw, AlertCircle, CheckCircle2,
    Sun, Moon, Repeat
} from 'lucide-react';
import { subscriptionsService, Subscription } from '../services/subscriptions';
import { toast } from 'react-hot-toast';

type SubscriptionFilter = 'all' | 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export default function SubscriptionsPage() {
    const navigate = useNavigate();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<SubscriptionFilter>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchSubscriptions();
    }, [filter]);

    const fetchSubscriptions = async () => {
        setIsLoading(true);
        try {
            const status = filter === 'all' ? undefined : filter;
            const data = await subscriptionsService.getAll(status);
            setSubscriptions(data);
        } catch (error) {
            console.error('Failed to fetch subscriptions:', error);
            toast.error('Failed to load subscriptions');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePause = async (id: string) => {
        setActionLoading(id);
        try {
            await subscriptionsService.pause(id);
            toast.success('Subscription paused');
            fetchSubscriptions();
        } catch (error) {
            console.error('Failed to pause subscription:', error);
            toast.error('Failed to pause subscription');
        } finally {
            setActionLoading(null);
        }
    };

    const handleResume = async (id: string) => {
        setActionLoading(id);
        try {
            await subscriptionsService.resume(id);
            toast.success('Subscription resumed');
            fetchSubscriptions();
        } catch (error) {
            console.error('Failed to resume subscription:', error);
            toast.error('Failed to resume subscription');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancel = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this subscription? This action cannot be undone.')) {
            return;
        }
        setActionLoading(id);
        try {
            await subscriptionsService.cancel(id);
            toast.success('Subscription cancelled');
            fetchSubscriptions();
        } catch (error) {
            console.error('Failed to cancel subscription:', error);
            toast.error('Failed to cancel subscription');
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                    </span>
                );
            case 'PAUSED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <Pause className="w-3 h-3" />
                        Paused
                    </span>
                );
            case 'CANCELLED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <X className="w-3 h-3" />
                        Cancelled
                    </span>
                );
            default:
                return null;
        }
    };

    const getDeliveryTimeIcon = (time: string) => {
        switch (time) {
            case 'morning':
                return <Sun className="w-4 h-4 text-amber-500" />;
            case 'evening':
                return <Moon className="w-4 h-4 text-indigo-500" />;
            default:
                return <Clock className="w-4 h-4 text-blue-500" />;
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Not scheduled';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const filterButtons: { label: string; value: SubscriptionFilter }[] = [
        { label: 'All', value: 'all' },
        { label: 'Active', value: 'ACTIVE' },
        { label: 'Paused', value: 'PAUSED' },
        { label: 'Cancelled', value: 'CANCELLED' },
    ];

    return (
        <div className="min-h-screen bg-warm-cream">
            <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20 py-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">My Subscriptions</h1>
                        <p className="text-gray-500 mt-1 text-sm">Manage your recurring deliveries</p>
                    </div>
                    <span className="text-gray-500 text-sm">
                        {subscriptions.length} subscription{subscriptions.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {filterButtons.map((btn) => (
                        <button
                            key={btn.value}
                            onClick={() => setFilter(btn.value)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${filter === btn.value
                                ? 'bg-green-600 text-white shadow-md'
                                : 'bg-white text-gray-600 border border-gray-200 hover:border-green-300'
                                }`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-6 animate-pulse">
                                <div className="flex items-start gap-4">
                                    <div className="w-16 h-16 bg-gray-200 rounded-xl" />
                                    <div className="flex-1">
                                        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                                        <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                                        <div className="h-3 bg-gray-200 rounded w-2/3" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : subscriptions.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Repeat className="w-8 h-8 text-gray-300" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Subscriptions Found</h2>
                        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                            {filter === 'all'
                                ? "You don't have any subscriptions yet. Start saving with weekly or monthly deliveries!"
                                : `No ${filter.toLowerCase()} subscriptions found.`
                            }
                        </p>
                        <button
                            onClick={() => navigate('/products')}
                            className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                        >
                            Browse Products
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {subscriptions.map((subscription) => (
                            <div
                                key={subscription.id}
                                className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                            >
                                <div className="p-5">
                                    <div className="flex items-start gap-4">
                                        {/* Product Image */}
                                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                                            <img
                                                src={subscription.product.image_url}
                                                alt={subscription.product.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>

                                        {/* Product Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-base leading-tight">
                                                        {subscription.product.name}
                                                    </h3>
                                                    <p className="text-sm text-gray-500 mt-0.5">
                                                        {subscription.product.volume} × {subscription.quantity}
                                                    </p>
                                                </div>
                                                {getStatusBadge(subscription.status)}
                                            </div>

                                            {/* Subscription Details */}
                                            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Repeat className="w-3.5 h-3.5 text-purple-600" />
                                                    <span className="text-xs text-gray-500">Frequency</span>
                                                    <span className="text-xs font-semibold text-gray-900 capitalize">
                                                        {subscription.subscription_type}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    {getDeliveryTimeIcon(subscription.preferred_delivery_time)}
                                                    <span className="text-xs text-gray-500">Delivery Time</span>
                                                    <span className="text-xs font-semibold text-gray-900 capitalize">
                                                        {subscription.preferred_delivery_time}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-green-600" />
                                                    <span className="text-xs text-gray-500">Next</span>
                                                    <span className="text-xs font-semibold text-gray-900">
                                                        {formatDate(subscription.next_delivery_date)}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <Package className="w-3.5 h-3.5 text-blue-600" />
                                                    <span className="text-xs text-gray-500">Deliveries</span>
                                                    <span className="text-xs font-semibold text-gray-900">
                                                        {subscription.total_deliveries} completed
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Row: Price + Actions + Address */}
                                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <span className="text-lg font-bold text-green-600">
                                                    ₹{subscription.price_per_delivery}
                                                </span>
                                                <span className="text-xs text-gray-500 ml-1">
                                                    per delivery
                                                </span>
                                            </div>

                                            {/* Delivery Address */}
                                            {subscription.delivery_address && (
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="font-medium text-gray-700">
                                                        {subscription.delivery_address.name}
                                                    </span>
                                                    <span>
                                                        {subscription.delivery_address.street}, {subscription.delivery_address.city}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        {subscription.status !== 'CANCELLED' && (
                                            <div className="flex items-center gap-2">
                                                {subscription.status === 'ACTIVE' ? (
                                                    <button
                                                        onClick={() => handlePause(subscription.id)}
                                                        disabled={actionLoading === subscription.id}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50"
                                                    >
                                                        {actionLoading === subscription.id ? (
                                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Pause className="w-3.5 h-3.5" />
                                                        )}
                                                        Pause
                                                    </button>
                                                ) : subscription.status === 'PAUSED' ? (
                                                    <button
                                                        onClick={() => handleResume(subscription.id)}
                                                        disabled={actionLoading === subscription.id}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50"
                                                    >
                                                        {actionLoading === subscription.id ? (
                                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Play className="w-3.5 h-3.5" />
                                                        )}
                                                        Resume
                                                    </button>
                                                ) : null}

                                                <button
                                                    onClick={() => handleCancel(subscription.id)}
                                                    disabled={actionLoading === subscription.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Health Recommendation */}
                                {subscription.product.health_notes && (
                                    <div className="px-5 py-2.5 border-t bg-blue-50 border-blue-100">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
                                            <span className="text-xs font-medium text-blue-700">
                                                {subscription.product.health_notes}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
