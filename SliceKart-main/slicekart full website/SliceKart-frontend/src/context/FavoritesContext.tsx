import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { favoritesService, FavoriteItem } from '../services/favorites';
import { useAuth } from './AuthContext';
import { Product } from '../types';

interface FavoritesContextType {
    favorites: FavoriteItem[];
    addToFavorites: (product: Product) => Promise<void>;
    removeFromFavorites: (productId: string) => Promise<void>;
    isFavorite: (productId: string) => boolean;
    refreshFavorites: () => Promise<void>;
    loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [loading, setLoading] = useState(false);
    const { isAuthenticated } = useAuth();

    const fetchFavorites = async () => {
        if (!isAuthenticated) {
            setFavorites([]);
            return;
        }

        setLoading(true);
        try {
            const data = await favoritesService.getAll();
            setFavorites(data);
        } catch (error) {
            console.error('Failed to fetch favorites:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFavorites();
    }, [isAuthenticated]);

    const addToFavorites = async (product: Product) => {
        if (!isAuthenticated) return;
        try {
            const result: any = await favoritesService.add(product.id);
            if (result.success) {
                // Optimistically update or re-fetch
                const newFav: FavoriteItem = {
                    ...product,
                    favorite_id: result.favorite?.id || 'temp',
                    favorited_at: new Date().toISOString()
                };
                setFavorites(prev => [...prev, newFav]);
            }
        } catch (error) {
            console.error('Failed to add to favorites:', error);
        }
    };

    const removeFromFavorites = async (productId: string) => {
        if (!isAuthenticated) return;
        try {
            // Optimistic update
            setFavorites(prev => prev.filter(f => f.id !== productId));

            await favoritesService.remove(productId);
            // If it fails, we should revert, but for simplicity we assume success or handle error silently
        } catch (error) {
            console.error('Failed to remove from favorites:', error);
            // Revert state if needed
            fetchFavorites();
        }
    };

    const isFavorite = (productId: string) => {
        return favorites.some(f => f.id === productId);
    };

    return (
        <FavoritesContext.Provider value={{
            favorites,
            addToFavorites,
            removeFromFavorites,
            isFavorite,
            refreshFavorites: fetchFavorites,
            loading
        }}>
            {children}
        </FavoritesContext.Provider>
    );
}

export function useFavorites() {
    const context = useContext(FavoritesContext);
    if (context === undefined) {
        throw new Error('useFavorites must be used within a FavoritesProvider');
    }
    return context;
}
