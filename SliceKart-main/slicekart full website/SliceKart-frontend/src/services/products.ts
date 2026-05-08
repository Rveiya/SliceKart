import api from './api';
import { Product } from '../types';

export interface ProductFilters {
    category?: string;
    search?: string;
    min_price?: number;
    max_price?: number;
    sort?: 'price_asc' | 'price_desc' | 'rating' | 'newest';
}

interface ProductsResponse {
    products: Product[];
    count: number;
}

interface ProductResponse {
    product: Product;
}

export const productsService = {
    // Get all products with optional filters
    getAll: async (filters?: ProductFilters): Promise<{ products: Product[]; count: number }> => {
        const params = new URLSearchParams();

        if (filters?.category) params.append('category', filters.category);
        if (filters?.search) params.append('search', filters.search);
        if (filters?.min_price) params.append('min_price', filters.min_price.toString());
        if (filters?.max_price) params.append('max_price', filters.max_price.toString());
        if (filters?.sort) params.append('sort', filters.sort);

        const response = await api.get<ProductsResponse>(`/products?${params.toString()}`);
        return {
            products: response.data.products,
            count: response.data.count
        };
    },

    // Get product by ID
    getById: async (id: string): Promise<Product> => {
        const response = await api.get<ProductResponse>(`/products/${id}`);
        return response.data.product;
    },

    // Create a new product (admin only)
    create: async (data: Partial<Product>): Promise<Product> => {
        const response = await api.post<Product>('/products', data);
        return response.data;
    },

    // Update a product (admin only)
    update: async (id: string, data: Partial<Product>): Promise<Product> => {
        const response = await api.put<Product>(`/products/${id}`, data);
        return response.data;
    },

    // Delete a product (admin only)
    delete: async (id: string): Promise<void> => {
        await api.delete(`/products/${id}`);
    }
};

export default productsService;
