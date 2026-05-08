import { useState, useEffect } from 'react';
import api from '../../services/api';

interface Order {
    id: string;
    total_amount: number;
    status: string;
    payment_status: string;
    payment_method: string;
    delivery_partner_id: string | null;
    created_at: string;
    customer_name: string;
    customer_email: string;
    addr_name: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
    partner_id: string | null;
    partner_name: string | null;
    partner_phone: string | null;
}

interface DeliveryPartner {
    id: string;
    name: string;
    phone: string;
    rating: number;
    is_available: boolean;
    active_orders: number;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

const ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'];
const PAYMENT_STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];

export default function AdminOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, pages: 0 });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        status: '',
        payment_status: '',
        search: ''
    });
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Delivery partner assignment
    const [availablePartners, setAvailablePartners] = useState<DeliveryPartner[]>([]);
    const [loadingPartners, setLoadingPartners] = useState(false);
    const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
    const [assigningPartner, setAssigningPartner] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, [pagination.page, filters]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
                ...(filters.status && { status: filters.status }),
                ...(filters.payment_status && { payment_status: filters.payment_status }),
                ...(filters.search && { search: filters.search })
            });

            const response = await api.get<{ orders: Order[]; pagination: Pagination }>(`/admin/orders?${params}`);
            setOrders(response.data.orders);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailablePartners = async () => {
        try {
            setLoadingPartners(true);
            const response = await api.get<{ partners: DeliveryPartner[] }>('/admin/delivery-partners?limit=100&status=available');
            setAvailablePartners(response.data.partners);
        } catch (error) {
            console.error('Failed to fetch delivery partners:', error);
        } finally {
            setLoadingPartners(false);
        }
    };

    const exportToExcel = async () => {
        try {
            setExporting(true);
            const params = new URLSearchParams({
                ...(filters.status && { status: filters.status }),
                ...(filters.payment_status && { payment_status: filters.payment_status }),
                ...(filters.search && { search: filters.search })
            });

            const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const response = await fetch(`${BASE_URL}/admin/orders/export?${params}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `orders_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export orders:', error);
            alert('Failed to export orders. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    const openManageModal = (order: Order) => {
        setSelectedOrder(order);
        setSelectedPartnerId(order.partner_id || '');
        setShowStatusModal(true);
        fetchAvailablePartners();
    };

    const updateOrderStatus = async (orderId: string, newStatus: string) => {
        try {
            setUpdatingStatus(true);
            await api.patch(`/orders/${orderId}/status`, { status: newStatus });
            await fetchOrders();
            setShowStatusModal(false);
            setSelectedOrder(null);
        } catch (error) {
            console.error('Failed to update order status:', error);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const assignDeliveryPartner = async () => {
        if (!selectedOrder || !selectedPartnerId) return;
        try {
            setAssigningPartner(true);
            await api.patch(`/orders/${selectedOrder.id}/status`, {
                status: selectedOrder.status,
                delivery_partner_id: selectedPartnerId
            });
            await fetchOrders();
            setShowStatusModal(false);
            setSelectedOrder(null);
        } catch (error) {
            console.error('Failed to assign delivery partner:', error);
        } finally {
            setAssigningPartner(false);
        }
    };

    const removeDeliveryPartner = async () => {
        if (!selectedOrder) return;
        try {
            setAssigningPartner(true);
            await api.patch(`/orders/${selectedOrder.id}/status`, {
                status: selectedOrder.status,
                delivery_partner_id: null
            });
            setSelectedPartnerId('');
            await fetchOrders();
            setShowStatusModal(false);
            setSelectedOrder(null);
        } catch (error) {
            console.error('Failed to remove delivery partner:', error);
        } finally {
            setAssigningPartner(false);
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
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            PENDING: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            ACCEPTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            ON_THE_WAY: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            DELIVERED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            CANCELLED: 'bg-red-500/20 text-red-400 border-red-500/30'
        };
        return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    };

    const getPaymentStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            PENDING: 'text-amber-400',
            COMPLETED: 'text-emerald-400',
            FAILED: 'text-red-400',
            REFUNDED: 'text-blue-400'
        };
        return colors[status] || 'text-slate-400';
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Search orders..."
                            value={filters.search}
                            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                            className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                    </div>
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                        className="bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                    >
                        <option value="">All Status</option>
                        {ORDER_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <select
                        value={filters.payment_status}
                        onChange={(e) => setFilters(f => ({ ...f, payment_status: e.target.value }))}
                        className="bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                    >
                        <option value="">All Payments</option>
                        {PAYMENT_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <button
                        onClick={exportToExcel}
                        disabled={exporting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                        title="Export orders to Excel"
                    >
                        {exporting ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        )}
                        {exporting ? 'Exporting...' : 'Export Excel'}
                    </button>
                </div>
            </div>

            {/* Orders Table */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <p>No orders found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700/30">
                                <tr>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Order ID</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Customer</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Amount</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Status</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Payment</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Delivery Partner</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Date</th>
                                    <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-slate-700/20 transition-colors">
                                        <td className="py-4 px-5">
                                            <span className="text-white font-mono text-sm">#{order.id.slice(0, 8)}</span>
                                        </td>
                                        <td className="py-4 px-5">
                                            <p className="text-white font-medium">{order.customer_name || 'Guest'}</p>
                                            <p className="text-slate-400 text-sm">{order.customer_email}</p>
                                        </td>
                                        <td className="py-4 px-5">
                                            <span className="text-white font-semibold">{formatCurrency(order.total_amount)}</span>
                                        </td>
                                        <td className="py-4 px-5">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-5">
                                            <p className={`font-medium ${getPaymentStatusColor(order.payment_status)}`}>
                                                {order.payment_status}
                                            </p>
                                            <p className="text-slate-500 text-xs">{order.payment_method}</p>
                                        </td>
                                        <td className="py-4 px-5">
                                            {order.partner_name ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                                                        {order.partner_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-white text-sm font-medium">{order.partner_name}</p>
                                                        <p className="text-slate-500 text-xs">{order.partner_phone}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500 text-sm italic">Not assigned</span>
                                            )}
                                        </td>
                                        <td className="py-4 px-5">
                                            <span className="text-slate-400 text-sm">{formatDate(order.created_at)}</span>
                                        </td>
                                        <td className="py-4 px-5 text-center">
                                            <button
                                                onClick={() => openManageModal(order)}
                                                className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                title="Manage Order"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-5 py-4 border-t border-slate-700/50">
                        <p className="text-slate-400 text-sm">
                            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                                disabled={pagination.page === 1}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                                disabled={pagination.page >= pagination.pages}
                                className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Management Modal */}
            {showStatusModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-semibold text-white mb-1">Manage Order</h3>
                        <p className="text-slate-400 text-sm mb-6">
                            Order: <span className="text-white font-mono">#{selectedOrder.id.slice(0, 8)}</span>
                            <span className="mx-2">•</span>
                            <span className="text-white">{selectedOrder.customer_name}</span>
                        </p>

                        {/* Update Status Section */}
                        <div className="mb-6">
                            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Order Status</h4>
                            <div className="space-y-2">
                                {ORDER_STATUSES.map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => updateOrderStatus(selectedOrder.id, status)}
                                        disabled={updatingStatus || selectedOrder.status === status}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${selectedOrder.status === status
                                            ? getStatusColor(status)
                                            : 'border-slate-600/50 text-slate-400 hover:border-slate-500 hover:text-white'
                                            } disabled:opacity-50`}
                                    >
                                        <span>{status}</span>
                                        {selectedOrder.status === status && (
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Assign Delivery Partner Section */}
                        <div className="mb-6 border-t border-slate-700/50 pt-6">
                            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                                </svg>
                                Delivery Partner
                            </h4>

                            {/* Currently assigned partner */}
                            {selectedOrder.partner_name && (
                                <div className="flex items-center justify-between p-3 mb-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                            {selectedOrder.partner_name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-cyan-300 font-medium text-sm">{selectedOrder.partner_name}</p>
                                            <p className="text-cyan-400/60 text-xs">{selectedOrder.partner_phone}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={removeDeliveryPartner}
                                        disabled={assigningPartner}
                                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-xs"
                                        title="Remove partner"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            )}

                            {loadingPartners ? (
                                <div className="flex items-center justify-center py-4">
                                    <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                                    <span className="ml-3 text-slate-400 text-sm">Loading partners...</span>
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={selectedPartnerId}
                                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                                        className="w-full bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors mb-3"
                                    >
                                        <option value="">Select delivery partner...</option>
                                        {availablePartners.map((partner) => (
                                            <option key={partner.id} value={partner.id} className="bg-slate-800">
                                                {partner.name} — {partner.phone} (★{parseFloat(String(partner.rating || 0)).toFixed(1)}, {partner.active_orders} active)
                                            </option>
                                        ))}
                                    </select>

                                    {availablePartners.length === 0 && (
                                        <p className="text-slate-500 text-xs mb-3">No available delivery partners found.</p>
                                    )}

                                    <button
                                        onClick={assignDeliveryPartner}
                                        disabled={!selectedPartnerId || assigningPartner}
                                        className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                                        </svg>
                                        {assigningPartner ? 'Assigning...' : selectedOrder.partner_name ? 'Reassign Partner' : 'Assign Partner'}
                                    </button>
                                </>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                setShowStatusModal(false);
                                setSelectedOrder(null);
                            }}
                            className="w-full py-3 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
