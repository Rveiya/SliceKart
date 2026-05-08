import { useState, useEffect, FormEvent } from 'react';
import api from '../../services/api';

interface User {
    id: string;
    fullname: string;
    email: string;
    phone: string | null;
    role: 'ADMIN' | 'CUSTOMER';
    created_at: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export default function AdminUsers() {
    const [users, setUsers] = useState<User[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, pages: 0 });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        role: '',
        search: ''
    });
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [formError, setFormError] = useState('');
    const [formData, setFormData] = useState({
        fullname: '',
        email: '',
        password: '',
        phone: '',
        role: 'CUSTOMER' as 'ADMIN' | 'CUSTOMER'
    });

    useEffect(() => {
        fetchUsers();
    }, [pagination.page, filters]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
                ...(filters.role && { role: filters.role }),
                ...(filters.search && { search: filters.search })
            });

            const response = await api.get<{ users: User[]; pagination: Pagination }>(`/admin/users?${params}`);
            setUsers(response.data.users);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = async () => {
        try {
            setExporting(true);
            const params = new URLSearchParams({
                ...(filters.role && { role: filters.role }),
                ...(filters.search && { search: filters.search })
            });

            const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const response = await fetch(`${BASE_URL}/admin/users/export?${params}`, {
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
            link.download = `users_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export users:', error);
            alert('Failed to export users. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    const createUser = async (e: FormEvent) => {
        e.preventDefault();
        try {
            setCreating(true);
            setFormError('');
            await api.post('/admin/users', {
                fullname: formData.fullname,
                email: formData.email,
                password: formData.password,
                phone: formData.phone || undefined,
                role: formData.role
            });
            await fetchUsers();
            setShowAddModal(false);
            setFormData({ fullname: '', email: '', password: '', phone: '', role: 'CUSTOMER' });
        } catch (error: any) {
            console.error('Failed to create user:', error);
            setFormError(error?.data?.message || error?.message || 'Failed to create user. Please try again.');
        } finally {
            setCreating(false);
        }
    };


    const deleteUser = async () => {
        if (!selectedUser) return;
        try {
            setDeleting(true);
            await api.delete(`/admin/users/${selectedUser.id}`);
            await fetchUsers();
            setShowDeleteModal(false);
            setSelectedUser(null);
        } catch (error) {
            console.error('Failed to delete user:', error);
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
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Users</h1>
                    <p className="text-slate-400">Manage user accounts and permissions</p>
                </div>
                <button
                    onClick={() => { setShowAddModal(true); setFormError(''); setFormData({ fullname: '', email: '', password: '', phone: '', role: 'CUSTOMER' }); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-emerald-500/25"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add User
                </button>
            </div>

            {/* Filters */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={filters.search}
                            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                            className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                    </div>
                    <select
                        value={filters.role}
                        onChange={(e) => setFilters(f => ({ ...f, role: e.target.value }))}
                        className="bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                    >
                        <option value="">All Roles</option>
                        <option value="ADMIN">Admin</option>
                        <option value="CUSTOMER">Customer</option>
                    </select>
                    <button
                        onClick={exportToExcel}
                        disabled={exporting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                        title="Export users to Excel"
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

            {/* Users Table */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p>No users found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700/30">
                                <tr>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">User</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Contact</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Role</th>
                                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Joined</th>
                                    <th className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider py-4 px-5">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-700/20 transition-colors">
                                        <td className="py-4 px-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                                                    {user.fullname?.charAt(0).toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium">{user.fullname}</p>
                                                    {/* <p className="text-slate-400 text-sm font-mono text-xs">{user.id.slice(0, 8)}...</p> */}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5">
                                            <p className="text-white">{user.email}</p>
                                            <p className="text-slate-400 text-sm">{user.phone || 'No phone'}</p>
                                        </td>
                                        <td className="py-4 px-5">
                                            <span className={`text-sm font-medium px-3 py-1.5 rounded-lg ${user.role === 'ADMIN'
                                                ? 'bg-purple-500/20 text-purple-400'
                                                : 'bg-blue-500/20 text-blue-400'
                                                }`}
                                            >
                                                {user.role === 'ADMIN' ? 'Admin' : 'Customer'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-5">
                                            <span className="text-slate-400 text-sm">{formatDate(user.created_at)}</span>
                                        </td>
                                        <td className="py-4 px-5 text-center">
                                            <button
                                                onClick={() => {
                                                    setSelectedUser(user);
                                                    setShowDeleteModal(true);
                                                }}
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Delete User"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">Delete User</h3>
                            <p className="text-slate-400 mb-6">
                                Are you sure you want to delete <span className="text-white font-medium">{selectedUser.fullname}</span>? This action cannot be undone.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setSelectedUser(null);
                                }}
                                className="flex-1 py-3 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={deleteUser}
                                disabled={deleting}
                                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                                {deleting ? 'Deleting...' : 'Delete User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md">
                        <div className="p-6 border-b border-slate-700/50">
                            <h3 className="text-xl font-semibold text-white">Create New User</h3>
                            <p className="text-slate-400 text-sm mt-1">Add a new user or admin account</p>
                        </div>

                        <form onSubmit={createUser} className="p-6 space-y-4">
                            {formError && (
                                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                                    {formError}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.fullname}
                                    onChange={(e) => setFormData(f => ({ ...f, fullname: e.target.value }))}
                                    placeholder="Enter full name"
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Email *</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
                                    placeholder="Enter email address"
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Password *</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={formData.password}
                                    onChange={(e) => setFormData(f => ({ ...f, password: e.target.value }))}
                                    placeholder="Minimum 6 characters"
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData(f => ({ ...f, phone: e.target.value }))}
                                    placeholder="Optional"
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Role *</label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(f => ({ ...f, role: 'CUSTOMER' }))}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all text-sm ${formData.role === 'CUSTOMER'
                                            ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50'
                                            : 'bg-slate-700/50 text-slate-400 border-2 border-transparent hover:bg-slate-700'
                                            }`}
                                    >
                                        <svg className="w-5 h-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        Customer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(f => ({ ...f, role: 'ADMIN' }))}
                                        className={`flex-1 py-3 rounded-xl font-medium transition-all text-sm ${formData.role === 'ADMIN'
                                            ? 'bg-purple-500/20 text-purple-400 border-2 border-purple-500/50'
                                            : 'bg-slate-700/50 text-slate-400 border-2 border-transparent hover:bg-slate-700'
                                            }`}
                                    >
                                        <svg className="w-5 h-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        Admin
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-3 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {creating ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
