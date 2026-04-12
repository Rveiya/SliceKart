import { useState, useEffect, FormEvent } from 'react';
import api from '../../services/api';
import ImageUpload from '../../components/admin/ImageUpload';

interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    original_price: number | null;
    discount: number;
    category: string;
    image_url: string;
    image_url_signed: string | null; // Presigned URL for display
    images: string[]; // R2 keys
    images_signed: (string | null)[]; // Presigned URLs for display
    volume: string;
    stock: number;
    is_active: boolean;
    rating: number;
    created_at: string;
    return_policy: boolean;
    cash_on_delivery: boolean;
    allow_cancellation: boolean;
    benefits: string[];
    nutrition?: Record<string, string>;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export default function AdminProducts() {
    const [products, setProducts] = useState<Product[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 12, total: 0, pages: 0 });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        category: '',
        status: '',
        search: ''
    });
    const [categories, setCategories] = useState<{ category: string; product_count: number }[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [newStock, setNewStock] = useState(0);
    const [updating, setUpdating] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Form state for adding/editing product
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        price: '',
        original_price: '',
        discount: '',
        stock: '',
        volume: '',
        description: '',
        benefits: '',
        image_url: '', // R2 key for primary image
        images: [] as string[], // R2 keys for all images
        imageUrls: [] as (string | null)[], // Presigned URLs for display
        return_policy: true,
        cash_on_delivery: true,
        allow_cancellation: true,
        nutritionItems: [] as { key: string, value: string }[]
    });

    const resetFormData = () => {
        setFormData({
            name: '',
            category: '',
            price: '',
            original_price: '',
            discount: '',
            stock: '',
            volume: '',
            description: '',
            benefits: '',
            image_url: '',
            images: [],
            imageUrls: [],
            return_policy: true,
            cash_on_delivery: true,
            allow_cancellation: true,
            nutritionItems: []
        });
    };

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, [pagination.page, filters]);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
                ...(filters.category && { category: filters.category }),
                ...(filters.status && { status: filters.status }),
                ...(filters.search && { search: filters.search })
            });

            const response = await api.get<{ products: Product[]; pagination: Pagination }>(`/admin/products?${params}`);
            setProducts(response.data.products);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await api.get<{ categories: { category: string; product_count: number }[] }>('/admin/categories');
            setCategories(response.data.categories);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };

    const toggleProductStatus = async (product: Product) => {
        try {
            await api.patch(`/admin/products/${product.id}/status`, { is_active: !product.is_active });
            await fetchProducts();
        } catch (error) {
            console.error('Failed to toggle product status:', error);
        }
    };

    const exportToExcel = async () => {
        try {
            setExporting(true);
            const params = new URLSearchParams({
                ...(filters.category && { category: filters.category }),
                ...(filters.status && { status: filters.status }),
                ...(filters.search && { search: filters.search })
            });

            const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
            const response = await fetch(`${BASE_URL}/admin/products/export?${params}`, {
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
            link.download = `products_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export products:', error);
            alert('Failed to export products. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    const updateStock = async () => {
        if (!selectedProduct) return;
        try {
            setUpdating(true);
            await api.patch(`/admin/products/${selectedProduct.id}/stock`, { stock: newStock });
            await fetchProducts();
            setShowStockModal(false);
            setSelectedProduct(null);
        } catch (error) {
            console.error('Failed to update stock:', error);
        } finally {
            setUpdating(false);
        }
    };

    const handleImagesChange = (images: string[], urls: (string | null)[]) => {
        setFormData(f => ({
            ...f,
            images: images,
            imageUrls: urls,
            image_url: images[0] || '' // First image is the primary
        }));
    };

    const addProduct = async (e: FormEvent) => {
        e.preventDefault();
        try {
            setUpdating(true);

            // Parse benefits and nutrition
            const benefitsArray = formData.benefits
                .split('\n')
                .map(b => b.trim())
                .filter(b => b.length > 0);

            const nutrition = formData.nutritionItems.reduce((acc, item) => {
                if (item.key.trim()) acc[item.key.trim()] = item.value.trim();
                return acc;
            }, {} as Record<string, string>);

            await api.post('/products', {
                name: formData.name,
                category: formData.category,
                price: parseFloat(formData.price),
                stock: parseInt(formData.stock),
                volume: formData.volume,
                description: formData.description,
                benefits: benefitsArray,
                nutrition,
                image_url: formData.image_url,
                images: formData.images,
                return_policy: formData.return_policy,
                cash_on_delivery: formData.cash_on_delivery,
                allow_cancellation: formData.allow_cancellation
            });
            await fetchProducts();
            setShowAddModal(false);
            resetFormData();
        } catch (error) {
            console.error('Failed to add product:', error);
        } finally {
            setUpdating(false);
        }
    };

    const openEditModal = (product: Product) => {
        setSelectedProduct(product);
        setFormData({
            name: product.name,
            category: product.category,
            price: product.price.toString(),
            original_price: product.original_price?.toString() || '',
            discount: product.discount?.toString() || '',
            stock: product.stock.toString(),
            volume: product.volume || '',
            description: product.description || '',
            benefits: (product.benefits || []).join('\n'),
            image_url: product.image_url || '',
            images: product.images || [],
            imageUrls: product.images_signed || [],
            return_policy: product.return_policy ?? true,
            cash_on_delivery: product.cash_on_delivery ?? true,
            allow_cancellation: product.allow_cancellation ?? true,
            nutritionItems: product.nutrition
                ? Object.entries(product.nutrition).map(([key, value]) => ({ key, value: String(value) }))
                : []
        });
        setShowEditModal(true);
    };

    const updateProduct = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) return;

        try {
            setUpdating(true);
            // Parse benefits and nutrition
            const benefitsArray = formData.benefits
                .split('\n')
                .map(b => b.trim())
                .filter(b => b.length > 0);

            const nutrition = formData.nutritionItems.reduce((acc, item) => {
                if (item.key.trim()) acc[item.key.trim()] = item.value.trim();
                return acc;
            }, {} as Record<string, string>);

            await api.put(`/admin/products/${selectedProduct.id}`, {
                name: formData.name,
                category: formData.category,
                price: parseFloat(formData.price),
                original_price: formData.original_price ? parseFloat(formData.original_price) : null,
                discount: formData.discount ? parseInt(formData.discount) : 0,
                stock: parseInt(formData.stock),
                volume: formData.volume,
                description: formData.description,
                benefits: benefitsArray,
                nutrition,
                image_url: formData.image_url,
                images: formData.images,
                return_policy: formData.return_policy,
                cash_on_delivery: formData.cash_on_delivery,
                allow_cancellation: formData.allow_cancellation,
                is_active: selectedProduct.is_active
            });
            await fetchProducts();
            setShowEditModal(false);
            setSelectedProduct(null);
            resetFormData();
        } catch (error) {
            console.error('Failed to update product:', error);
        } finally {
            setUpdating(false);
        }
    };

    const deleteProduct = async (productId: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await api.delete(`/products/${productId}`);
            await fetchProducts();
        } catch (error) {
            console.error('Failed to delete product:', error);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    // Helper to get display URL for product
    const getProductImageUrl = (product: Product) => {
        return product.image_url_signed || product.image_url || null;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Products</h1>
                    <p className="text-slate-400">Manage your product inventory</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-emerald-500/25"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Product
                </button>
            </div>

            {/* Filters */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={filters.search}
                            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                            className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                    </div>
                    <select
                        value={filters.category}
                        onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
                        className="bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                    >
                        <option value="">All Categories</option>
                        {categories.map(c => (
                            <option key={c.category} value={c.category}>{c.category} ({c.product_count})</option>
                        ))}
                    </select>
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                        className="bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                    >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <button
                        onClick={exportToExcel}
                        disabled={exporting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                        title="Export products to Excel"
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

            {/* Products Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                </div>
            ) : products.length === 0 ? (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl py-20 text-center text-slate-400">
                    <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p>No products found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {products.map((product) => (
                        <div key={product.id} className={`bg-slate-800/50 border rounded-2xl overflow-hidden transition-all ${product.is_active ? 'border-slate-700/50' : 'border-red-500/30 opacity-60'}`}>
                            {/* Product Image */}
                            <div className="relative aspect-square bg-slate-700">
                                {getProductImageUrl(product) ? (
                                    <img src={getProductImageUrl(product)!} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                )}
                                {/* Status Badge */}
                                <div className="absolute top-3 left-3">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-lg ${product.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {product.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                {/* Stock Badge */}
                                {product.stock < 10 && (
                                    <div className="absolute top-3 right-3">
                                        <span className="px-2 py-1 text-xs font-medium rounded-lg bg-red-500/20 text-red-400">
                                            Low Stock
                                        </span>
                                    </div>
                                )}
                                {/* Images Count Badge */}
                                {product.images && product.images.length > 1 && (
                                    <div className="absolute bottom-3 right-3">
                                        <span className="px-2 py-1 text-xs font-medium rounded-lg bg-black/60 text-white">
                                            +{product.images.length - 1} more
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Product Info */}
                            <div className="p-4">
                                <p className="text-xs text-slate-500 uppercase tracking-wider">{product.category}</p>
                                <h3 className="text-white font-medium mt-1 line-clamp-1">{product.name}</h3>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-lg font-bold text-white">{formatCurrency(product.price)}</span>
                                    <span className={`text-sm ${product.stock < 10 ? 'text-red-400' : 'text-slate-400'}`}>
                                        {product.stock} in stock
                                    </span>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700/50">
                                    <button
                                        onClick={() => openEditModal(product)}
                                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedProduct(product);
                                            setNewStock(product.stock);
                                            setShowStockModal(true);
                                        }}
                                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
                                    >
                                        Stock
                                    </button>
                                    <button
                                        onClick={() => toggleProductStatus(product)}
                                        className={`p-2 rounded-lg transition-colors ${product.is_active
                                            ? 'text-red-400 hover:bg-red-500/10'
                                            : 'text-emerald-400 hover:bg-emerald-500/10'
                                            }`}
                                        title={product.is_active ? 'Deactivate' : 'Activate'}
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            {product.is_active ? (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                            ) : (
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            )}
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => deleteProduct(product.id)}
                                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                        title="Delete"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-slate-400 text-sm">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            disabled={pagination.page === 1}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            disabled={pagination.page >= pagination.pages}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Stock Update Modal */}
            {showStockModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-semibold text-white mb-2">Update Stock</h3>
                        <p className="text-slate-400 text-sm mb-6">{selectedProduct.name}</p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-300 mb-2">New Stock Quantity</label>
                            <input
                                type="number"
                                min="0"
                                value={newStock}
                                onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
                                className="w-full bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowStockModal(false);
                                    setSelectedProduct(null);
                                }}
                                className="flex-1 py-3 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={updateStock}
                                disabled={updating}
                                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                            >
                                {updating ? 'Updating...' : 'Update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Product Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl my-8">
                        <div className="p-6 border-b border-slate-700/50">
                            <h3 className="text-xl font-semibold text-white">Add New Product</h3>
                        </div>

                        <form onSubmit={addProduct} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Product Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Category *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.category}
                                        onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))}
                                        className="w-full bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Price (₹) *</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData(f => ({ ...f, price: e.target.value }))}
                                        className="w-full bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Stock Quantity *</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={formData.stock}
                                        onChange={(e) => setFormData(f => ({ ...f, stock: e.target.value }))}
                                        className="w-full bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Volume</label>
                                    <input
                                        type="text"
                                        value={formData.volume}
                                        onChange={(e) => setFormData(f => ({ ...f, volume: e.target.value }))}
                                        placeholder="e.g., 100ml, 250ml"
                                        className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Product Images</label>
                                <ImageUpload
                                    images={formData.images}
                                    imageUrls={formData.imageUrls}
                                    onChange={handleImagesChange}
                                    maxImages={10}
                                    disabled={updating}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                                ></textarea>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Nutrition Facts</label>
                                <div className="space-y-3 mb-3">
                                    {formData.nutritionItems.map((item, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Nutrient"
                                                value={item.key}
                                                onChange={(e) => {
                                                    const newItems = [...formData.nutritionItems];
                                                    newItems[index].key = e.target.value;
                                                    setFormData(f => ({ ...f, nutritionItems: newItems }));
                                                }}
                                                className="flex-1 bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-2 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Value"
                                                value={item.value}
                                                onChange={(e) => {
                                                    const newItems = [...formData.nutritionItems];
                                                    newItems[index].value = e.target.value;
                                                    setFormData(f => ({ ...f, nutritionItems: newItems }));
                                                }}
                                                className="flex-1 bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-2 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newItems = formData.nutritionItems.filter((_, i) => i !== index);
                                                    setFormData(f => ({ ...f, nutritionItems: newItems }));
                                                }}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData(f => ({ ...f, nutritionItems: [...f.nutritionItems, { key: '', value: '' }] }))}
                                    className="text-sm text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 mb-4"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Nutrient
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Nutrition Benefits</label>
                                <textarea
                                    rows={4}
                                    value={formData.benefits}
                                    onChange={(e) => setFormData(f => ({ ...f, benefits: e.target.value }))}
                                    placeholder="Enter each benefit on a new line, e.g.:&#10;Rich in Vitamin C&#10;Low in Calories&#10;High in Antioxidants"
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                                ></textarea>
                                <p className="text-xs text-slate-500 mt-1">Enter each benefit on a new line</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        resetFormData();
                                    }}
                                    className="flex-1 py-3 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={updating}
                                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {updating ? 'Adding...' : 'Add Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Product Modal */}
            {showEditModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl my-8">
                        <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
                            <h3 className="text-xl font-semibold text-white">Edit Product</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-lg ${selectedProduct.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {selectedProduct.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>

                        <form onSubmit={updateProduct} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Product Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Category *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.category}
                                        onChange={(e) => setFormData(f => ({ ...f, category: e.target.value }))}
                                        className="w-full bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Price (₹) *</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData(f => ({ ...f, price: e.target.value }))}
                                        className="w-full bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Original Price (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.original_price}
                                        onChange={(e) => setFormData(f => ({ ...f, original_price: e.target.value }))}
                                        placeholder="Optional"
                                        className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Discount (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={formData.discount}
                                        onChange={(e) => setFormData(f => ({ ...f, discount: e.target.value }))}
                                        placeholder="0"
                                        className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Stock Quantity *</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={formData.stock}
                                        onChange={(e) => setFormData(f => ({ ...f, stock: e.target.value }))}
                                        className="w-full bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Volume</label>
                                    <input
                                        type="text"
                                        value={formData.volume}
                                        onChange={(e) => setFormData(f => ({ ...f, volume: e.target.value }))}
                                        placeholder="e.g., 100ml, 250ml"
                                        className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Product Images</label>
                                <ImageUpload
                                    images={formData.images}
                                    imageUrls={formData.imageUrls}
                                    onChange={handleImagesChange}
                                    maxImages={10}
                                    disabled={updating}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                                ></textarea>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Nutrition Facts</label>
                                <div className="space-y-3 mb-3">
                                    {formData.nutritionItems.map((item, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Nutrient"
                                                value={item.key}
                                                onChange={(e) => {
                                                    const newItems = [...formData.nutritionItems];
                                                    newItems[index].key = e.target.value;
                                                    setFormData(f => ({ ...f, nutritionItems: newItems }));
                                                }}
                                                className="flex-1 bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-2 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Value"
                                                value={item.value}
                                                onChange={(e) => {
                                                    const newItems = [...formData.nutritionItems];
                                                    newItems[index].value = e.target.value;
                                                    setFormData(f => ({ ...f, nutritionItems: newItems }));
                                                }}
                                                className="flex-1 bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-2 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newItems = formData.nutritionItems.filter((_, i) => i !== index);
                                                    setFormData(f => ({ ...f, nutritionItems: newItems }));
                                                }}
                                                className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData(f => ({ ...f, nutritionItems: [...f.nutritionItems, { key: '', value: '' }] }))}
                                    className="text-sm text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 mb-4"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Nutrient
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Nutrition Benefits</label>
                                <textarea
                                    rows={4}
                                    value={formData.benefits}
                                    onChange={(e) => setFormData(f => ({ ...f, benefits: e.target.value }))}
                                    placeholder="Enter each benefit on a new line, e.g.:&#10;Rich in Vitamin C&#10;Low in Calories&#10;High in Antioxidants"
                                    className="w-full bg-slate-900/50 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                                ></textarea>
                                <p className="text-xs text-slate-500 mt-1">Enter each benefit on a new line</p>
                            </div>

                            {/* Product Settings */}
                            <div className="border-t border-slate-700/50 pt-4">
                                <p className="text-sm font-medium text-slate-300 mb-3">Product Settings</p>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.return_policy}
                                            onChange={(e) => setFormData(f => ({ ...f, return_policy: e.target.checked }))}
                                            className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                                        />
                                        <span className="text-slate-300">Return Policy Enabled</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.cash_on_delivery}
                                            onChange={(e) => setFormData(f => ({ ...f, cash_on_delivery: e.target.checked }))}
                                            className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                                        />
                                        <span className="text-slate-300">Cash on Delivery</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.allow_cancellation}
                                            onChange={(e) => setFormData(f => ({ ...f, allow_cancellation: e.target.checked }))}
                                            className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800"
                                        />
                                        <span className="text-slate-300">Allow Cancellation</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setSelectedProduct(null);
                                        resetFormData();
                                    }}
                                    className="flex-1 py-3 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={updating}
                                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                                >
                                    {updating ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
