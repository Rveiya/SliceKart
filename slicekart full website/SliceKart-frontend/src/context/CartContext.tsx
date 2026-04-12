import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { CartItem, Product, CartState } from '../types';
import { useAuth } from './AuthContext';
import { cartApi, CartValidationResult, CartAdjustment, StockValidationItem } from '../services/cart';

export interface StockIssue {
    itemId: string;
    productId: string;
    productName: string;
    requestedQuantity: number;
    availableStock: number;
    type: 'out_of_stock' | 'insufficient_stock';
}

interface CartContextType extends CartState {
    addToCart: (
        product: Product,
        quantity?: number,
        subscriptionType?: 'weekly' | 'monthly' | 'one-time',
        preferredDeliveryTime?: 'morning' | 'afternoon' | 'evening'
    ) => Promise<{ success: boolean; error?: string }>;
    removeFromCart: (itemId: string) => Promise<void>;
    updateQuantity: (itemId: string, quantity: number) => Promise<{ success: boolean; error?: string }>;
    clearCart: () => Promise<void>;
    itemCount: number;
    isCartOpen: boolean;
    openCart: () => void;
    closeCart: () => void;
    // Stock validation
    stockIssues: StockIssue[];
    hasStockIssues: boolean;
    isValidatingStock: boolean;
    validateStock: () => Promise<CartValidationResult | null>;
    adjustCartToStock: () => Promise<CartAdjustment[]>;
    clearStockIssues: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'slicekart_cart';

export function CartProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth();
    const [items, setItems] = useState<CartItem[]>(() => {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    });
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
    const [isValidatingStock, setIsValidatingStock] = useState(false);

    const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const hasStockIssues = stockIssues.length > 0;

    const openCart = () => setIsCartOpen(true);
    const closeCart = () => setIsCartOpen(false);

    const clearStockIssues = useCallback(() => {
        setStockIssues([]);
    }, []);

    const processStockValidation = useCallback((result: CartValidationResult): StockIssue[] => {
        const issues: StockIssue[] = [];

        // Process out of stock items
        result.outOfStockItems.forEach((item: StockValidationItem) => {
            issues.push({
                itemId: item.id,
                productId: item.product.id,
                productName: item.product.name,
                requestedQuantity: item.quantity,
                availableStock: 0,
                type: 'out_of_stock'
            });
        });

        // Process insufficient stock items
        result.insufficientStockItems.forEach((item: StockValidationItem) => {
            issues.push({
                itemId: item.id,
                productId: item.product.id,
                productName: item.product.name,
                requestedQuantity: item.requested_quantity || item.quantity,
                availableStock: item.max_available || item.available_stock,
                type: 'insufficient_stock'
            });
        });

        return issues;
    }, []);

    const validateStock = useCallback(async (): Promise<CartValidationResult | null> => {
        if (!isAuthenticated || items.length === 0) return null;

        setIsValidatingStock(true);
        try {
            const response = await cartApi.validate();
            if (response.data) {
                const issues = processStockValidation(response.data);
                setStockIssues(issues);
                return response.data;
            }
            return null;
        } catch (error) {
            console.error('Failed to validate stock:', error);
            return null;
        } finally {
            setIsValidatingStock(false);
        }
    }, [isAuthenticated, items.length, processStockValidation]);

    const adjustCartToStock = useCallback(async (): Promise<CartAdjustment[]> => {
        if (!isAuthenticated) return [];

        try {
            const response = await cartApi.adjust();
            if (response.data) {
                setItems(response.data.items);
                setStockIssues([]); // Clear issues after adjustment
                return response.data.adjustments;
            }
            return [];
        } catch (error) {
            console.error('Failed to adjust cart:', error);
            return [];
        }
    }, [isAuthenticated]);

    const fetchCart = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const response = await cartApi.get();
            if (response.data) {
                setItems(response.data.items);
            }
        } catch (error) {
            console.error('Failed to fetch cart:', error);
        }
    }, [isAuthenticated]);

    // Sync local cart with server on login, or just fetch if no local cart
    useEffect(() => {
        const syncCart = async () => {
            if (isAuthenticated) {
                const saved = localStorage.getItem(CART_STORAGE_KEY);
                const localItems: CartItem[] = saved ? JSON.parse(saved) : [];

                if (localItems.length > 0) {
                    try {
                        const response = await cartApi.sync(localItems);
                        if (response.data) {
                            setItems(response.data.items);
                            localStorage.removeItem(CART_STORAGE_KEY);
                        }
                    } catch (error) {
                        console.error('Failed to sync cart:', error);
                        // Fallback to fetching existing server cart if sync fails
                        fetchCart();
                    }
                } else {
                    fetchCart();
                }
            }
        };

        syncCart();
    }, [isAuthenticated, fetchCart]);

    // Validate stock when cart is opened
    useEffect(() => {
        if (isCartOpen && isAuthenticated && items.length > 0) {
            validateStock();
        }
    }, [isCartOpen, isAuthenticated, items.length]);

    // Validate stock when user returns to the tab (handles stock changes while away)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isAuthenticated && items.length > 0) {
                validateStock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isAuthenticated, items.length, validateStock]);

    // Save to local storage only if not authenticated
    useEffect(() => {
        if (!isAuthenticated) {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
        }
    }, [items, isAuthenticated]);

    const addToCart = async (
        product: Product,
        quantity = 1,
        subscriptionType: 'weekly' | 'monthly' | 'one-time' = 'one-time',
        preferredDeliveryTime?: 'morning' | 'afternoon' | 'evening'
    ): Promise<{ success: boolean; error?: string }> => {
        // Check stock before adding (client-side validation)
        if (product.stock < quantity) {
            return {
                success: false,
                error: product.stock === 0
                    ? `${product.name} is out of stock`
                    : `Only ${product.stock} unit(s) of ${product.name} available`
            };
        }

        // Check if adding to existing cart item would exceed stock
        const existingItem = items.find(item => item.product.id === product.id && item.subscription_type === subscriptionType);
        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > product.stock) {
                return {
                    success: false,
                    error: `Cannot add more. Only ${product.stock} unit(s) of ${product.name} available (${existingItem.quantity} already in cart)`
                };
            }
        }

        if (isAuthenticated) {
            try {
                const response = await cartApi.addItem(product.id, quantity, subscriptionType, preferredDeliveryTime);
                if (response.data) {
                    await fetchCart();
                    // Clear any existing stock issues for this product
                    setStockIssues(prev => prev.filter(issue => issue.productId !== product.id));
                    return { success: true };
                }
                return { success: false, error: 'Failed to add item to cart' };
            } catch (error: unknown) {
                console.error('Failed to add to cart:', error);
                const errorMessage = error instanceof Error ? error.message : 'Failed to add item to cart';
                // Check if it's a stock error from the backend
                if (typeof error === 'object' && error !== null && 'response' in error) {
                    const axiosError = error as { response?: { data?: { message?: string } } };
                    if (axiosError.response?.data?.message?.includes('stock')) {
                        return { success: false, error: axiosError.response.data.message };
                    }
                }
                return { success: false, error: errorMessage };
            }
        } else {
            setItems(prev => {
                const existingItem = prev.find(item => item.product.id === product.id && item.subscription_type === subscriptionType);
                if (existingItem) {
                    return prev.map(item =>
                        item.id === existingItem.id
                            ? { ...item, quantity: item.quantity + quantity }
                            : item
                    );
                }
                return [...prev, { id: `${product.id}-${Date.now()}`, product, quantity, subscription_type: subscriptionType }];
            });
            return { success: true };
        }
    };

    const removeFromCart = async (itemId: string) => {
        if (isAuthenticated) {
            try {
                await cartApi.removeItem(itemId);
                setItems(prev => prev.filter(item => item.id !== itemId));
                // Clear any stock issues for this item
                setStockIssues(prev => prev.filter(issue => issue.itemId !== itemId));
            } catch (error) {
                console.error('Failed to remove item:', error);
            }
        } else {
            setItems(prev => prev.filter(item => item.id !== itemId));
        }
    };

    const updateQuantity = async (itemId: string, quantity: number): Promise<{ success: boolean; error?: string }> => {
        if (quantity < 1) {
            await removeFromCart(itemId);
            return { success: true };
        }

        // Find the item to check stock
        const item = items.find(i => i.id === itemId);
        if (item && quantity > item.product.stock) {
            return {
                success: false,
                error: `Only ${item.product.stock} unit(s) of ${item.product.name} available`
            };
        }

        if (isAuthenticated) {
            try {
                await cartApi.updateItem(itemId, quantity);
                setItems(prev =>
                    prev.map(item =>
                        item.id === itemId ? { ...item, quantity } : item
                    )
                );
                // Clear stock issue if quantity is now valid
                setStockIssues(prev => prev.filter(issue => issue.itemId !== itemId));
                return { success: true };
            } catch (error: unknown) {
                console.error('Failed to update quantity:', error);
                // Handle stock error from backend
                if (typeof error === 'object' && error !== null && 'response' in error) {
                    const axiosError = error as { response?: { data?: { message?: string } } };
                    if (axiosError.response?.data?.message?.includes('stock')) {
                        return { success: false, error: axiosError.response.data.message };
                    }
                }
                return { success: false, error: 'Failed to update quantity' };
            }
        } else {
            setItems(prev =>
                prev.map(item =>
                    item.id === itemId ? { ...item, quantity } : item
                )
            );
            return { success: true };
        }
    };

    const clearCart = async () => {
        if (isAuthenticated) {
            try {
                await cartApi.clear();
            } catch (error) {
                console.error('Failed to clear cart:', error);
            } finally {
                setItems([]);
                setStockIssues([]);
            }
        } else {
            setItems([]);
            setStockIssues([]);
        }
    };

    return (
        <CartContext.Provider value={{
            items,
            total,
            itemCount,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            isCartOpen,
            openCart,
            closeCart,
            stockIssues,
            hasStockIssues,
            isValidatingStock,
            validateStock,
            adjustCartToStock,
            clearStockIssues
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
