import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Minus, Plus, Heart, Leaf, Info } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../context/FavoritesContext';
import { Product } from '../types';
import api from '../services/api';

export default function ProductDetailPage() {
    const { id: productId } = useParams();
    const { addToCart, openCart } = useCart();
    const { isFavorite, addToFavorites, removeFromFavorites } = useFavorites();
    const [product, setProduct] = useState<Product | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedImage, setSelectedImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const [isOrderingNow, setIsOrderingNow] = useState(false);

    useEffect(() => {
        if (productId) {
            fetchProduct();
        }
    }, [productId]);

    // Auto-rotate images every 2 seconds
    useEffect(() => {
        if (!product) return;

        const imageCount = product.images?.length || 1;
        if (imageCount <= 1) return;

        const interval = setInterval(() => {
            setSelectedImage((prev) => (prev + 1) % imageCount);
        }, 2000);

        return () => clearInterval(interval);
    }, [product]);

    const fetchProduct = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await api.get<{ product: Product }>(`/products/${productId}`);
            setProduct(response.data.product);
        } catch (err) {
            console.error('Failed to fetch product:', err);
            setError('Failed to load product. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleFavorite = () => {
        if (!product) return;
        if (isFavorite(product.id)) {
            removeFromFavorites(product.id);
        } else {
            addToFavorites(product);
        }
    };

    const incrementQuantity = () => setQuantity(prev => prev + 1);
    const decrementQuantity = () => setQuantity(prev => Math.max(1, prev - 1));

    // Handle adding to cart with current quantity
    const handleAddToCart = async () => {
        if (!product || product.stock <= 0) return;

        setIsAddingToCart(true);
        try {
            await addToCart(product, quantity, 'one-time');
            openCart();
        } catch (err) {
            console.error('Failed to add to cart:', err);
            alert('Failed to add to cart. Please try again.');
        } finally {
            setIsAddingToCart(false);
        }
    };

    // Handle Order Now - adds to cart and opens cart sidebar
    const handleOrderNow = async () => {
        if (!product || product.stock <= 0) return;
        setIsOrderingNow(true);
        try {
            await addToCart(product, quantity, 'one-time');
            openCart();
        } catch (err) {
            console.error('Failed to add to cart:', err);
            alert('Failed to process order. Please try again.');
        } finally {
            setIsOrderingNow(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 text-xl font-medium mb-4">{error || 'Product not found'}</div>
                    <button
                        onClick={fetchProduct}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // Get display images - prefer signed URLs over raw keys
    const getDisplayImages = () => {
        if (product.images_signed && product.images_signed.length > 0) {
            return product.images_signed.filter((url): url is string => url !== null);
        }
        if (product.images && product.images.length > 0) {
            return product.images;
        }
        return [product.image_url_signed || product.image_url];
    };

    const images = getDisplayImages();

    return (
        <div className="min-h-screen bg-warm-cream">
            <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20 py-4 sm:py-6 md:py-8 lg:py-14">
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 md:p-8 lg:p-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 md:gap-10 lg:gap-16">
                        {/* Left Column - Images & Purchase Options */}
                        <div className="space-y-4 sm:space-y-6 md:space-y-8">
                            {/* Main Image */}
                            <div className="relative aspect-square sm:aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden bg-gray-50 shadow-md group">
                                <img
                                    src={images[selectedImage]}
                                    alt={product.name}
                                    className="w-full h-full object-cover transition-transform duration-500"
                                />
                                <button
                                    onClick={handleToggleFavorite}
                                    className="absolute top-4 right-4 p-3 rounded-full bg-white/80 backdrop-blur-sm shadow-md transition-all hover:bg-white hover:scale-110 z-10"
                                >
                                    <Heart
                                        className={`w-6 h-6 transition-all duration-300 ${isFavorite(product.id)
                                            ? 'text-red-500 scale-110'
                                            : 'text-gray-400 hover:text-red-500'
                                            }`}
                                        fill={isFavorite(product.id) ? "currentColor" : "none"}
                                    />
                                </button>
                                {product.stock <= 0 && (
                                    <div className="absolute inset-0 z-0 flex items-center justify-center bg-gray-900/10 backdrop-blur-[2px]">
                                        <span className="bg-red-600/90 backdrop-blur-md text-white text-lg font-bold px-8 py-3 rounded-2xl shadow-xl uppercase tracking-widest border border-white/20">
                                            Out of Stock
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Thumbnails */}
                            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 justify-center overflow-x-auto pb-2 scrollbar-hide">
                                {images.map((image, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedImage(index)}
                                        className={`relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-lg sm:rounded-xl overflow-hidden flex-shrink-0 border-2 sm:border-3 transition-all ${selectedImage === index
                                            ? 'border-green-600 ring-2 sm:ring-4 ring-green-600/20 shadow-lg'
                                            : 'border-gray-200 hover:border-green-300 hover:shadow-md'
                                            }`}
                                    >
                                        <img
                                            src={image}
                                            alt={`${product.name} ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>


                        </div>

                        {/* Right Column - Product Info */}
                        <div className="flex flex-col h-full">
                            <div className="mb-4 sm:mb-6 md:mb-8">
                                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4 leading-tight">
                                    {product.name}
                                </h1>

                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
                                    <span className="text-gray-500 font-medium text-sm sm:text-base md:text-lg">{product.volume}</span>
                                    {product.discount && (
                                        <span className="text-green-600 font-bold bg-green-100 px-2.5 sm:px-3 md:px-4 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm md:text-base">
                                            {product.discount}% Off
                                        </span>
                                    )}
                                </div>

                                {/* Health Guidance Card */}
                                {(product.health_notes || product.best_before_food || (product.health_tags && product.health_tags.length > 0)) && (
                                    <div className="mb-6 p-4 rounded-xl border-2 bg-blue-50 text-blue-700 border-blue-200">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-white/50">
                                                <Leaf className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold">Health Guidance</h4>
                                                </div>
                                                {product.health_notes && (
                                                    <p className="text-sm mt-1 font-medium">{product.health_notes}</p>
                                                )}
                                                {product.best_before_food && (
                                                    <p className="text-xs mt-2 flex items-center gap-1">
                                                        <Info className="w-3 h-3" />
                                                        Best consumed before food
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        {product.health_tags && product.health_tags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {product.health_tags.map((tag, index) => (
                                                    <span key={index} className="text-xs font-medium bg-white/60 px-2 py-1 rounded-full">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Price & Quantity Row */}
                                <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4 sm:gap-6 mb-6 sm:mb-8 md:mb-10 pb-4 sm:pb-6 md:pb-8 border-b border-gray-200 w-full">
                                    <div className="flex items-baseline justify-center sm:justify-start w-full sm:w-auto gap-2 sm:gap-3">
                                        <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-600">₹{product.price}</span>
                                        {product.original_price && (
                                            <span className="text-base sm:text-lg md:text-xl text-gray-400 line-through">₹{product.original_price}</span>
                                        )}
                                    </div>

                                    {/* Quantity Selector */}
                                    <div className="w-full sm:w-auto flex justify-center mt-2 sm:mt-0">
                                        <div className={`flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl p-1 sm:p-1.5 shadow-lg w-3/4 sm:w-auto ${product.stock <= 0 ? 'bg-gray-200' : 'bg-green-600'}`}>
                                            <button
                                                onClick={decrementQuantity}
                                                disabled={product.stock <= 0 || quantity <= 1}
                                                className="flex-1 sm:w-10 sm:h-10 h-8 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </button>
                                            <span className="w-10 sm:w-10 text-center font-bold text-base sm:text-lg text-white">
                                                {quantity}
                                            </span>
                                            <button
                                                onClick={incrementQuantity}
                                                disabled={product.stock <= 0}
                                                className="flex-1 sm:w-10 sm:h-10 h-8 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="mb-6 sm:mb-8 md:mb-10">
                                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4">Product Details</h3>
                                    <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                                        {product.description}
                                    </p>
                                </div>

                                {/* Nutrition Info */}
                                {product.nutrition && (
                                    <div className="mb-6 sm:mb-8">
                                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-5">Nutrition Information</h3>
                                        <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                                            {Object.entries(product.nutrition).map(([key, value]) => (
                                                <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg sm:rounded-xl px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-4">
                                                    <span className="text-gray-600 capitalize text-xs sm:text-sm md:text-base font-medium">{key}:</span>
                                                    <span className="font-bold text-green-600 text-sm sm:text-base md:text-lg">{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Key Benefits */}
                                {product.benefits && product.benefits.length > 0 && (
                                    <div className="mb-6 sm:mb-8">
                                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-5">Key Benefits</h3>
                                        <ul className="space-y-2">
                                            {product.benefits.map((benefit, index) => (
                                                <li key={index} className="flex items-start gap-3">
                                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                                    <span className="text-gray-600 text-sm sm:text-base leading-relaxed">{benefit}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Bottom Actions - Side by Side */}
                            <div className="mt-auto flex flex-col sm:flex-row gap-3 sm:gap-4">
                                {/* Order Later Button - White with Grey Border */}
                                <button
                                    onClick={handleAddToCart}
                                    disabled={product.stock <= 0 || isAddingToCart}
                                    className="flex-1 flex items-center justify-center gap-2 text-sm sm:text-base font-bold py-3 sm:py-4 rounded-xl sm:rounded-2xl transition-all border-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{
                                        backgroundColor: product.stock <= 0 ? '#f3f4f6' : 'white',
                                        borderColor: product.stock <= 0 ? '#d1d5db' : '#d1d5db',
                                        color: product.stock <= 0 ? '#9ca3af' : '#374151',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (product.stock > 0 && !isAddingToCart) {
                                            e.currentTarget.style.backgroundColor = '#f9fafb';
                                            e.currentTarget.style.borderColor = '#9ca3af';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (product.stock > 0) {
                                            e.currentTarget.style.backgroundColor = 'white';
                                            e.currentTarget.style.borderColor = '#d1d5db';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }
                                    }}
                                >
                                    <span>{isAddingToCart ? 'Adding...' : 'Order Later'}</span>
                                </button>

                                {/* Order Now Button - Green */}
                                <button
                                    onClick={handleOrderNow}
                                    disabled={product.stock <= 0 || isOrderingNow}
                                    className="flex-1 flex items-center justify-center text-sm sm:text-base font-bold py-3 sm:py-4 rounded-xl sm:rounded-2xl transition-all shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{
                                        backgroundColor: product.stock <= 0 ? '#9ca3af' : '#22c55e',
                                        color: 'white',
                                        boxShadow: product.stock <= 0
                                            ? 'none'
                                            : '0 8px 20px -5px rgba(22, 163, 74, 0.4)',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (product.stock > 0 && !isOrderingNow) {
                                            e.currentTarget.style.backgroundColor = '#16a34a';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 15px 30px -8px rgba(22, 163, 74, 0.5)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (product.stock > 0) {
                                            e.currentTarget.style.backgroundColor = '#22c55e';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 8px 20px -5px rgba(22, 163, 74, 0.4)';
                                        }
                                    }}
                                >
                                    {product.stock <= 0 ? 'Out of Stock' : (isOrderingNow ? 'Processing...' : 'Order Now')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
