import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { Product } from '../types';
import api from '../services/api';

const stats = [
    { value: '500+', label: 'Products Ordered' },
    { value: '100+', label: 'Subscriptions' },
    { value: '2M+', label: 'Customers Registered' },
];

const amlaFruitBenefits = [
    'Strengthens Immunity',
    'Improves Digestion',
    'Enhances Skin & Hair Health',
    'Detoxifies the Body',
    'Boosts Metabolism & Energy',
    'Supports Heart Health',
];

const beetrootBenefits = [
    'Boosts Natural Energy & Stamina',
    'Strengthens Immunity System',
    'Improves Digestion & Gut Health',
    'Enhances Blood Circulation',
    'Supports Liver Detoxification',
    'Promotes Clear & Glowing Skin',
];

const detoxBenefits = [
    'Improves Digestion',
    'Reduces Bloating & Water Retention',
    'Boosts Metabolism',
    'Supports Detoxification',
    'Regulates Blood Sugar Levels',
    'Strengthens Immunity',
];

// Fallback products in case API fails
const fallbackProducts: Product[] = Array.from({ length: 6 }, (_, i) => ({
    id: `${i + 1}`,
    name: 'Amla Fruit',
    description: 'Fresh Amla Fruit packed with Vitamin C',
    price: 89,
    category: 'amla',
    image_url: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=300&h=300&fit=crop',
    volume: '100ml',
    stock: 100,
}));

export default function HomePage() {
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>(fallbackProducts);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await api.get<{ products: Product[] }>('/products?sort=rating');
            const fetchedProducts = response.data.products || [];
            // Filter out out-of-stock items and take first 6
            const availableProducts = fetchedProducts.filter(p => p.stock > 0);
            setProducts(availableProducts.slice(0, 6));
        } catch (err) {
            console.error('Failed to fetch products:', err);
            // Use fallback products on error
            setProducts(fallbackProducts);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white">
            {/* Hero Section */}
            <section className="py-16 lg:py-20 bg-warm-cream">
                <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20">
                    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                        {/* Left Content */}
                        <div className="space-y-8 text-left relative z-20">
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-black leading-tight">
                                Fresh Fruits<br className="hidden sm:block" /> <span className="text-[#00A651]">Delivered to Your Doorstep</span>
                            </h1>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 mb-3">
                                    Fresh. Natural. Delivered to You.
                                </h2>
                                <p className="text-gray-500 text-base leading-relaxed">
                                    Enjoy hygienically cut, fresh, and ready-to-eat fruits delivered directly to your home, office, gym, or events. Healthy eating made simple and convenient.
                                </p>
                            </div>
                            <div className="flex justify-center sm:justify-start">
                                <Link
                                    to="/products"
                                    className="inline-flex items-center gap-2 bg-green-700 text-white px-8 py-3 rounded-full text-base font-bold hover:bg-green-700 transition-all shadow-lg hover:shadow-green-500/30"
                                >
                                    Explore Now
                                    {/* <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                                        <ArrowRight className="w-4 h-4" />
                                    </div> */}
                                </Link>
                            </div>
                            {/* Stats */}
                            <div className="flex flex-nowrap justify-between sm:justify-start gap-2 sm:gap-16 mt-16 pt-10 border-t border-gray-100 overflow-x-auto">
                                {stats.map((stat, index) => (
                                    <div key={index} className="text-center sm:text-left min-w-0 flex-1">
                                        <div className="text-4xl sm:text-4xl lg:text-5xl font-bold text-black-600 leading-none">{stat.value}</div>
                                        <div className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2 font-medium break-words leading-tight">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Image - Hero Fruit glasses */}
                        <div className="hidden lg:flex justify-center lg:justify-end relative z-10">
                            <img
                                src="/home-first-img.png"
                                alt="Colorful fresh juices"
                                className="w-full h-[250px] sm:h-[350px] lg:h-[550px] object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-700"
                            />
                        </div>
                    </div>


                </div>
            </section>

            {/* Benefits Section 1 - Amla Fruit (Boost Your Immunity) */}
            <section className="py-20 bg-green-50">
                <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                        <div className="space-y-8">
                            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                                Gentle Detox for a Healthier Digestive System
                            </h2>
                            <p className="text-gray-500 text-base leading-relaxed">
                                Fresh Fruit Infusions and Cold-Pressed Fruits designed to cleanse your system, improve digestion, and revitalize your body naturally.
                            </p>
                            <ul className="space-y-4">
                                {detoxBenefits.map((benefit, index) => (
                                    <li key={index} className="flex items-center gap-4">
                                        <span className="w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center flex-shrink-0">
                                            <Check className="w-3.5 h-3.5 text-green-600" />
                                        </span>
                                        <span className="text-gray-700 text-base">{benefit}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="flex justify-center lg:justify-end">
                            <img
                                src="/home-second-img.png"
                                alt="Amla juice with fresh fruits"
                                className="w-full h-[300px] sm:h-[400px] lg:h-[550px] object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-700"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits Section 2 - Beetroot (Boost Energy & Strength) */}
            <section className="py-20 bg-warm-cream">
                <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                        <div className="order-2 lg:order-1 flex justify-center lg:justify-start">
                            <img
                                src="/home-third-img.jpg"
                                alt="Beetroot juice"
                                className="w-full h-[300px] sm:h-[400px] lg:h-[550px] object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-700"
                            />
                        </div>
                        <div className="order-1 lg:order-2 space-y-8">
                            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                                Naturally Nourish Your Body with Power & Vitality
                            </h2>
                            <p className="text-gray-500 text-base leading-relaxed">
                                Fresh Papaya is packed with essential nutrients, antioxidants, and digestive 
enzymes that help energize your body, improve immunity, and support overall 
wellness every day.
                            </p>
                            <ul className="space-y-4">
                                {beetrootBenefits.map((benefit, index) => (
                                    <li key={index} className="flex items-center gap-4">
                                        <span className="w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center flex-shrink-0">
                                            <Check className="w-3.5 h-3.5 text-green-600" />
                                        </span>
                                        <span className="text-gray-700 text-base">{benefit}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits Section 3 - Detox */}
            <section className="py-20 bg-green-50">
                <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                        <div className="space-y-8">
                            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                                Boost Your Immunity the Natural Way
                            </h2>
                            <p className="text-gray-500 text-base leading-relaxed">
                                A refreshing blend of Kiwi, Strawberry, Orange, and Blueberry provides 
essential vitamins and antioxidants to support your body’s natural defenses 
and keep you energized. 
                            </p>
                            <ul className="space-y-4">
                                {amlaFruitBenefits.map((benefit, index) => (
                                    <li key={index} className="flex items-center gap-4">
                                        <span className="w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center flex-shrink-0">
                                            <Check className="w-3.5 h-3.5 text-green-600" />
                                        </span>
                                        <span className="text-gray-700 text-base">{benefit}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="flex justify-center lg:justify-end">
                            <img
                                src="/home-fourth-img.png"
                                alt="Detox juice"
                                className="w-full h-[300px] sm:h-[400px] lg:h-[550px] object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-700"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Products Section */}
            <section className="py-20 bg-white">
                <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20">
                    <div className="flex items-center justify-between mb-10">
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Shop Our Favorites</h2>
                        <button
                            onClick={() => navigate('/products')}
                            className="text-green-600 text-base font-semibold hover:text-green-700 transition-colors flex items-center gap-2"
                        >
                            <span className="sm:hidden">View All</span>
                            <span className="hidden sm:inline">View All</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                    {isLoading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div key={index} className="bg-gray-100 rounded-2xl h-64 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {products.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
