import { useState, useEffect } from 'react';
import api from '../../services/api';
import ImageUpload from '../../components/admin/ImageUpload';

interface DeliveryPartner {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    rating: number;
    image_url: string | null;
    image_url_signed?: string | null;
    is_available: boolean;
    active_orders: number;
    created_at: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

interface PartnerFormData {
    name: string;
    phone: string;
    email: string;
    rating: string;
    image_url: string;
    image_url_signed: string | null;
    is_available: boolean;
}

const emptyForm: PartnerFormData = {
    name: '',
    phone: '',
    email: '',
    rating: '0',
    image_url: '',
    image_url_signed: null,
    is_available: true
};

export default function AdminDeliveryPartners() {
    const [partners, setPartners] = useState<DeliveryPartner[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, pages: 0 });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: '', search: '' });

    // Modal state
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null);
    const [formData, setFormData] = useState<PartnerFormData>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    // Delete modal state
    const [selectedPartner, setSelectedPartner] = useState<DeliveryPartner | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        fetchPartners();
    }, [pagination.page, filters]);

    const fetchPartners = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
                ...(filters.status && { status: filters.status }),
                ...(filters.search && { search: filters.search })
            });

            const response = await api.get<{ partners: DeliveryPartner[]; pagination: Pagination }>(`/admin/delivery-partners?${params}`);
            setPartners(response.data.partners);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Failed to fetch delivery partners:', error);
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingPartner(null);
        setFormData(emptyForm);
        setFormError('');
        setShowFormModal(true);
    };

    const exportToExcel = async () => {
        try {
            setExporting(true);
            const params = new URLSearchParams({
                ...(filters.status && { status: filters.status }),
                ...(filters.search && { search: filters.search })
            });

            const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const response = await fetch(`${BASE_URL}/admin/delivery-partners/export?${params}`, {
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
            link.download = `delivery_partners_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export delivery partners:', error);
            alert('Failed to export delivery partners. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    const openEditModal = (partner: DeliveryPartner) => {
        setEditingPartner(partner);
        setFormData({
            name: partner.name,
            phone: partner.phone,
            email: partner.email || '',
            rating: partner.rating.toString(),
            image_url: partner.image_url || '',
            image_url_signed: partner.image_url_signed || null,
            is_available: partner.is_available
        });
        setFormError('');
        setShowFormModal(true);
    };

    const handleImagesChange = (images: string[], urls: (string | null)[]) => {
        setFormData(f => ({
            ...f,
            image_url: images[0] || '',
            image_url_signed: urls[0] || null
        }));
    };

    const handleSave = async () => {
        if (!formData.name.trim() || !formData.phone.trim()) {
            setFormError('Name and phone are required');
            return;
        }
        try {
            setSaving(true);
            setFormError('');
            const payload = {
                name: formData.name.trim(),
                phone: formData.phone.trim(),
                email: formData.email.trim() || null,
                rating: parseFloat(formData.rating) || 0,
                image_url: formData.image_url.trim() || null,
                is_available: formData.is_available
            };

            if (editingPartner) {
                await api.put(`/admin/delivery-partners/${editingPartner.id}`, payload);
            } else {
                await api.post('/admin/delivery-partners', payload);
            }
            setShowFormModal(false);
            await fetchPartners();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            setFormError(err.response?.data?.message || 'Failed to save partner');
        } finally {
            setSaving(false);
        }
    };

    const toggleAvailability = async (partner: DeliveryPartner) => {
        try {
            await api.patch(`/admin/delivery-partners/${partner.id}/availability`, {
                is_available: !partner.is_available
            });
            await fetchPartners();
        } catch (error) {
            console.error('Failed to toggle availability:', error);
        }
    };

    const deletePartner = async () => {
        if (!selectedPartner) return;
        try {
            setDeleting(true);
            await api.delete(`/admin/delivery-partners/${selectedPartner.id}`);
            await fetchPartners();
            setShowDeleteModal(false);
            setSelectedPartner(null);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err.response?.data?.message || 'Failed to delete partner');
        } finally {
            setDeleting(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Delivery Partners</h1>
                    <p className="text-slate-400">Manage delivery partners and their availability</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Partner
                </button>
            </div>

            {/* Filters */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Search by name or phone..."
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
                        <option value="available">Available</option>
                        <option value="unavailable">Unavailable</option>
                    </select>
                    <button
                        onClick={exportToExcel}
                        disabled={exporting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                        title="Export delivery partners to Excel"
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

            {/* Partners Table */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    </div>
                ) : partners.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                        </svg>
                        <p>No delivery partners found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700/30">
                                <tr>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Partner</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Contact</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Rating</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Status</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Active Orders</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Joined</th>
                                    <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {partners.map((partner) => (
                                    <tr key={partner.id} className="hover:bg-slate-700/20 transition-colors">
                                        <td className="py-4 px-5">
                                            <div className="flex items-center gap-3">
                                                {partner.image_url_signed || partner.image_url ? (
                                                    <img
                                                        src={partner.image_url_signed || partner.image_url!}
                                                        alt={partner.name}
                                                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                                                        {partner.name?.charAt(0).toUpperCase() || 'D'}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-white font-medium">{partner.name}</p>
                                                    {/* <p className="text-slate-400 text-sm font-mono text-xs">{partner.id.slice(0, 8)}...</p> */}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5">
                                            <p className="text-white">{partner.phone}</p>
                                            <p className="text-slate-400 text-sm">{partner.email || 'No email'}</p>
                                        </td>
                                        <td className="py-4 px-5">
                                            <div className="flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                <span className="text-white font-medium">{parseFloat(String(partner.rating || 0)).toFixed(1)}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5">
                                            <button
                                                onClick={() => toggleAvailability(partner)}
                                                className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${partner.is_available
                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                    : 'bg-red-500/20 text-red-400'
                                                    }`}
                                            >
                                                <span className={`w-2 h-2 rounded-full ${partner.is_available ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                                                {partner.is_available ? 'Available' : 'Unavailable'}
                                            </button>
                                        </td>
                                        <td className="py-4 px-5">
                                            <span className={`text-sm font-semibold ${partner.active_orders > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                                                {partner.active_orders}
                                            </span>
                                        </td>
                                        <td className="py-4 px-5">
                                            <span className="text-slate-400 text-sm">{formatDate(partner.created_at)}</span>
                                        </td>
                                        <td className="py-4 px-5">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => openEditModal(partner)}
                                                    className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                    title="Edit Partner"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedPartner(partner);
                                                        setShowDeleteModal(true);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Delete Partner"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
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

            {/* Add/Edit Modal */}
            {showFormModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6">
                        <h3 className="text-xl font-semibold text-white mb-5">
                            {editingPartner ? 'Edit Delivery Partner' : 'Add Delivery Partner'}
                        </h3>

                        {formError && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                {formError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    placeholder="Full name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone *</label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    placeholder="+91 9876543210"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    placeholder="email@example.com"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Rating</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="5"
                                        step="0.1"
                                        value={formData.rating}
                                        onChange={(e) => setFormData(f => ({ ...f, rating: e.target.value }))}
                                        className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                                <div className="flex items-end pb-1">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <div
                                            className={`relative w-12 h-6 rounded-full transition-colors ${formData.is_available ? 'bg-emerald-500' : 'bg-slate-600'}`}
                                            onClick={() => setFormData(f => ({ ...f, is_available: !f.is_available }))}
                                        >
                                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.is_available ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                        </div>
                                        <span className="text-sm text-slate-300">Available</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Image</label>
                                <ImageUpload
                                    images={formData.image_url ? [formData.image_url] : []}
                                    imageUrls={formData.image_url_signed ? [formData.image_url_signed] : (formData.image_url ? [formData.image_url] : [])}
                                    onChange={handleImagesChange}
                                    maxImages={1}
                                    disabled={saving}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowFormModal(false)}
                                className="flex-1 py-3 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : editingPartner ? 'Update Partner' : 'Add Partner'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedPartner && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">Delete Delivery Partner</h3>
                            <p className="text-slate-400 mb-6">
                                Are you sure you want to delete <span className="text-white font-medium">{selectedPartner.name}</span>? This action cannot be undone.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setSelectedPartner(null);
                                }}
                                className="flex-1 py-3 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={deletePartner}
                                disabled={deleting}
                                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                                {deleting ? 'Deleting...' : 'Delete Partner'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
