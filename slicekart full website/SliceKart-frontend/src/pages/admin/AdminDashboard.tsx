import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface DashboardStats {
    customers: number;
    products: number;
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    todayOrders: number;
    todayRevenue: number;
    monthOrders: number;
    monthRevenue: number;
    lowStockProducts: number;
    deliveryPartners: number;
    availablePartners: number;
}

interface RecentOrder {
    id: string;
    total_amount: number;
    status: string;
    payment_status: string;
    created_at: string;
    customer_name: string;
    customer_email: string;
}

interface TopProduct {
    id: string;
    name: string;
    image_url: string;
    price: number;
    stock: number;
    total_sold: number;
    total_revenue: number;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
    const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [statsRes, ordersRes, productsRes] = await Promise.all([
                api.get<{ stats: DashboardStats }>('/admin/dashboard/stats'),
                api.get<{ orders: RecentOrder[] }>('/admin/dashboard/recent-orders?limit=5'),
                api.get<{ products: TopProduct[] }>('/admin/dashboard/top-products?limit=5')
            ]);

            setStats(statsRes.data.stats);
            setRecentOrders(ordersRes.data.orders);
            setTopProducts(productsRes.data.products);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            PENDING: 'bg-amber-500/20 text-amber-400',
            ACCEPTED: 'bg-blue-500/20 text-blue-400',
            ON_THE_WAY: 'bg-purple-500/20 text-purple-400',
            DELIVERED: 'bg-emerald-500/20 text-emerald-400',
            CANCELLED: 'bg-red-500/20 text-red-400'
        };
        return colors[status] || 'bg-slate-500/20 text-slate-400';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Revenue */}
                <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-emerald-400/80 text-sm font-medium">Total Revenue</p>
                            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(stats?.totalRevenue || 0)}</p>
                            <p className="text-emerald-400 text-xs mt-2">+{formatCurrency(stats?.todayRevenue || 0)} Today</p>
                        </div>
                        <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Total Orders */}
                <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-400/80 text-sm font-medium">Total Orders</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats?.totalOrders || 0}</p>
                            <p className="text-blue-400 text-xs mt-2">+{stats?.todayOrders || 0} Today</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Customers */}
                <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/20 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-400/80 text-sm font-medium">Customers</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats?.customers || 0}</p>
                            <p className="text-purple-400 text-xs mt-2">Registered Users</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Products */}
                <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-amber-400/80 text-sm font-medium">Products</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats?.products || 0}</p>
                            <p className="text-red-400 text-xs mt-2">{stats?.lowStockProducts || 0} Low Stock</p>
                        </div>
                        <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Delivery Partners */}
                <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-cyan-400/80 text-sm font-medium">Delivery Partners</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats?.deliveryPartners || 0}</p>
                            <p className="text-cyan-400 text-xs mt-2">{stats?.availablePartners || 0} Available</p>
                        </div>
                        <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Order Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{stats?.pendingOrders || 0}</p>
                        <p className="text-slate-400 text-sm">Pending Orders</p>
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{stats?.deliveredOrders || 0}</p>
                        <p className="text-slate-400 text-sm">Delivered</p>
                    </div>
                </div>

                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{stats?.cancelledOrders || 0}</p>
                        <p className="text-slate-400 text-sm">Cancelled</p>
                    </div>
                </div>
            </div>

            {/* Recent Orders & Top Products */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Orders */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
                        <h3 className="text-lg font-semibold text-white">Recent Orders</h3>
                        <Link to="/admin/orders" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                            View All →
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-700/50">
                        {recentOrders.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">No orders yet</div>
                        ) : (
                            recentOrders.map((order) => (
                                <div key={order.id} className="p-4 hover:bg-slate-700/20 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-white font-medium">{order.customer_name || 'Guest'}</p>
                                            <p className="text-slate-400 text-sm">{formatDate(order.created_at)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-semibold">{formatCurrency(order.total_amount)}</p>
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Top Products */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
                        <h3 className="text-lg font-semibold text-white">Top Products</h3>
                        <Link to="/admin/products" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                            View All →
                        </Link>
                    </div>
                    <div className="divide-y divide-slate-700/50">
                        {topProducts.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">No products yet</div>
                        ) : (
                            topProducts.map((product) => (
                                <div key={product.id} className="p-4 hover:bg-slate-700/20 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-700 rounded-lg overflow-hidden flex-shrink-0">
                                            {product.image_url ? (
                                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-medium truncate">{product.name}</p>
                                            <p className="text-slate-400 text-sm">{product.total_sold} sold</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-white font-semibold">{formatCurrency(product.price)}</p>
                                            <p className={`text-sm ${product.stock < 10 ? 'text-red-400' : 'text-slate-400'}`}>
                                                {product.stock} in stock
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
