import api from './api';
import { Product } from '../types';

export interface FavoriteItem extends Product {
    favorite_id: string;
    favorited_at: string;
}

export const favoritesService = {
    getAll: async () => {
        const response = await api.get<{ favorites: FavoriteItem[] }>('/favorites');
        return response.data.favorites;
    },

    add: async (product_id: string) => {
        const response = await api.post('/favorites', { product_id });
        return response.data;
    },

    remove: async (product_id: string) => {
        const response = await api.delete(`/favorites/${product_id}`);
        return response.data;
    }
};
