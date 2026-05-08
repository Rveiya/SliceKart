import { Link } from 'react-router-dom';
import { Heart, Plus, Minus } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { toast } from 'react-hot-toast';

interface ProductCardProps {
    product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
    const { addToCart, items, updateQuantity } = useCart();
    const { isFavorite, addToFavorites, removeFromFavorites } = useFavorites();
    const isLoved = isFavorite(product.id);

    // Find if the item is already in the cart
    const cartItem = items.find(item => item.product.id === product.id);
    const quantity = cartItem ? cartItem.quantity : 0;
    const isAtMaxStock = quantity >= product.stock;
    const isLowStock = product.stock > 0 && product.stock <= 5;

    const handleAddToCart = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const result = await addToCart(product, 1);
        if (!result.success && result.error) {
            toast.error(result.error);
        }
    };

    const handleIncrement = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isAtMaxStock) {
            toast.error(`Only ${product.stock} unit(s) available`);
            return;
        }

        if (cartItem) {
            const result = await updateQuantity(cartItem.id, quantity + 1);
            if (!result.success && result.error) {
                toast.error(result.error);
            }
        } else {
            const result = await addToCart(product, 1);
            if (!result.success && result.error) {
                toast.error(result.error);
            }
        }
    };

    const handleDecrement = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (cartItem) {
            await updateQuantity(cartItem.id, quantity - 1);
        }
    };

    const handleWishlist = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLoved) {
            await removeFromFavorites(product.id);
        } else {
            await addToFavorites(product);
        }
    };

    return (
        <Link to={`/products/${product.id}`} className="group block">
            <div className={`bg-[#EBF5EB] rounded-2xl p-4 transition-all duration-300 ${product.stock > 0 ? 'hover:shadow-lg hover:shadow-green-100' : ''}`}>
                {/* Image Container */}
                <div className="relative mb-4">
                    {/* Low Stock Badge */}
                    {isLowStock && (
                        <div className="absolute top-2 left-2 z-10 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                            Only {product.stock} left
                        </div>
                    )}

                    {/* Wishlist Button */}
                    <button
                        onClick={handleWishlist}
                        className={`absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm ${isLoved ? 'bg-red-50 text-red-500' : 'bg-white text-gray-400 hover:text-red-500'
                            }`}
                    >
                        <Heart
                            className={`w-4 h-4 transition-all duration-300 ${isLoved ? 'scale-110' : ''}`}
                            fill={isLoved ? "currentColor" : "none"}
                        />
                    </button>

                    {/* Product Image */}
                    <div className="relative aspect-square flex items-center justify-center overflow-hidden rounded-xl bg-white">
                        <img
                            src={product.image_url_signed || product.image_url || '/placeholder-Fruit.png'}
                            alt={product.name}
                            className={`w-full h-full object-cover transition-transform duration-300 ${product.stock <= 0 ? 'grayscale opacity-70' : 'group-hover:scale-105'}`}
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=200&h=200&fit=crop';
                            }}
                        />
                        {product.stock <= 0 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                <span className="bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg uppercase tracking-wide">
                                    Out of Stock
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Product Info */}
                <div className="space-y-1">
                    <h3 className={`font-semibold text-base leading-tight line-clamp-1 ${product.stock <= 0 ? 'text-gray-500' : 'text-gray-900'}`}>
                        {product.name}
                    </h3>
                    <p className="text-sm text-gray-500">{product.volume || '100ml'}</p>
                </div>

                {/* Price & Add Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-3 gap-y-3 sm:gap-y-0">
                    <div className="flex justify-between items-center w-full sm:w-auto">
                        <span className={`text-lg font-bold ${product.stock <= 0 ? 'text-gray-400' : 'text-green-600'}`}>₹{product.price}</span>

                        {/* On mobile, keep the initial Add button on the same line if desired, OR drop it. But we want it consistent. Wait, actually we will show price on left, and button on bottom on Mobile. So price is above. */}
                    </div>

                    {product.stock <= 0 ? (
                        <div className="w-full sm:w-auto flex justify-center sm:block mt-1 sm:mt-0">
                            <button
                                disabled
                                className="w-full sm:w-9 h-10 sm:h-9 bg-gray-100 text-gray-400 rounded-lg flex items-center justify-center cursor-not-allowed text-sm font-semibold sm:font-normal uppercase sm:lowercase tracking-wider sm:tracking-normal"
                            >
                                <span className="sm:hidden">Out of Stock</span>
                                <Plus className="hidden sm:block w-5 h-5" />
                            </button>
                        </div>
                    ) : quantity > 0 ? (
                        <div className="w-full sm:w-auto flex justify-center sm:block mt-1 sm:mt-0">
                            <div className="flex items-center bg-green-600 rounded-lg overflow-hidden h-10 sm:h-9 shadow-md w-full sm:w-auto" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                <button
                                    onClick={handleDecrement}
                                    className="flex-1 sm:w-8 h-full flex items-center justify-center text-white hover:bg-green-700 transition-colors"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-12 sm:w-6 flex items-center justify-center text-white font-bold text-sm select-none">
                                    {quantity}
                                </span>
                                <button
                                    onClick={handleIncrement}
                                    disabled={isAtMaxStock}
                                    className={`flex-1 sm:w-8 h-full flex items-center justify-center text-white transition-colors ${isAtMaxStock ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'
                                        }`}
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full sm:w-auto flex justify-center sm:block mt-1 sm:mt-0">
                            <button
                                onClick={handleAddToCart}
                                className="w-full sm:w-9 h-10 sm:h-9 bg-green-600 text-white rounded-lg flex items-center justify-center hover:bg-green-700 transition-colors shadow-md hover:shadow-lg text-sm font-semibold sm:font-normal uppercase sm:lowercase"
                            >
                                <span className="sm:hidden">Add to Cart</span>
                                <Plus className="hidden sm:block w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}

