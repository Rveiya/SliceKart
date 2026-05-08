import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ShoppingCart, Bell, MapPin, Menu, X, ChevronDown, User, LogOut, Package, Heart, Loader2, Home, ShoppingBag, Phone, Repeat, Settings } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

interface LocationData {
    city: string;
    area: string;
    fullAddress: string;
}

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const { itemCount, openCart } = useCart();
    const { isAuthenticated, user, logout, isLoading } = useAuth();

    const [location, setLocation] = useState<LocationData>({
        city: 'Detecting...',
        area: '',
        fullAddress: ''
    });
    const [isLocationLoading, setIsLocationLoading] = useState(true);

    // Auto-detect location on component mount
    useEffect(() => {
        detectLocation();
    }, []);

    const detectLocation = async () => {
        setIsLocationLoading(true);

        if (!navigator.geolocation) {
            setLocation({ city: 'Hyderabad', area: '', fullAddress: '' });
            setIsLocationLoading(false);
            return;
        }

        // Use watchPosition for better accuracy
        let bestPosition: GeolocationPosition | null = null;
        let watchId: number;
        let isFinalized = false;

        const finalizeLocation = async () => {
            if (isFinalized) return;
            isFinalized = true;
            navigator.geolocation.clearWatch(watchId);

            if (!bestPosition) {
                setLocation({ city: 'Hyderabad', area: '', fullAddress: '' });
                setIsLocationLoading(false);
                return;
            }

            const { latitude, longitude } = bestPosition.coords;

            try {
                // Use OpenStreetMap Nominatim with highest zoom for precise address
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=19`,
                    {
                        headers: {
                            'Accept-Language': 'en'
                        }
                    }
                );

                if (!response.ok) throw new Error('Geocoding failed');

                const data = await response.json();
                const address = data.address;

                // Extract location details with road name priority
                const area = address.road ||
                    address.neighbourhood ||
                    address.suburb ||
                    address.village ||
                    address.hamlet ||
                    address.town ||
                    '';

                const city = address.city ||
                    address.town ||
                    address.municipality ||
                    address.state_district ||
                    'Unknown';

                const fullAddress = data.display_name || '';

                setLocation({
                    city: city,
                    area: area,
                    fullAddress: fullAddress
                });
            } catch (error) {
                console.error('Reverse geocoding error:', error);
                setLocation({ city: 'Hyderabad', area: '', fullAddress: '' });
            }
            setIsLocationLoading(false);
        };

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                // Keep the reading with the best accuracy
                if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
                    bestPosition = position;
                }

                // If we get a very accurate reading (< 50m), use it immediately
                if (position.coords.accuracy < 50) {
                    finalizeLocation();
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                navigator.geolocation.clearWatch(watchId);
                setLocation({ city: 'Hyderabad', area: '', fullAddress: '' });
                setIsLocationLoading(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 0
            }
        );

        // After 5 seconds, use the best position we have
        setTimeout(() => {
            finalizeLocation();
        }, 5000);
    };

    const displayLocation = location.area
        ? `${location.area}, ${location.city}`
        : location.city;

    const navLinks = [
        { path: '/', label: 'Home', icon: Home },
        { path: '/products', label: 'Products', icon: ShoppingBag },
        //{ path: '/offers', label: 'Offers', icon: Crown },
        { path: '/contact', label: 'Contact', icon: Phone },
    ];

    const handleLogout = async () => {
        await logout();
        setIsUserMenuOpen(false);
    };

    return (
        <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
            <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20">
                <div className="flex items-center justify-between h-18 py-4">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-11 h-11 flex items-center justify-center">
                            <img
                                src="/image-removebg-preview.png"
                                alt="SliceKart"
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </Link>

                    {/* Location */}
                    <div
                        className="flex items-center gap-1 sm:gap-1.5 text-gray-700 cursor-pointer hover:text-green-600 transition-colors ml-2 sm:ml-4 lg:ml-32"
                        onClick={detectLocation}
                        title={location.fullAddress || 'Click to refresh location'}
                    >
                        {isLocationLoading ? (
                            <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                        ) : (
                            <MapPin className="w-4 h-4 text-green-600" />
                        )}
                        <span className="text-xs sm:text-sm lg:text-base font-medium max-w-20 sm:max-w-32 lg:max-w-48 truncate">
                            {displayLocation}
                        </span>
                        <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 hidden sm:block" />
                    </div>

                    {/* Navigation - Desktop */}
                    <nav className="hidden lg:flex items-center gap-10 ml-auto mr-10">
                        {navLinks.map(link => (
                            <NavLink
                                key={link.path}
                                to={link.path}
                                className={({ isActive }) =>
                                    `text-base font-medium transition-colors relative py-1.5 ${isActive
                                        ? 'text-gray-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-green-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                    }`
                                }
                            >
                                {link.label}
                            </NavLink>
                        ))}
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center gap-5">
                        {/* Cart */}
                        <button
                            onClick={openCart}
                            className="relative p-2 text-gray-700 hover:text-green-600 transition-colors"
                        >
                            <ShoppingCart className="w-6 h-6" />
                            {itemCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                    {itemCount > 9 ? '9+' : itemCount}
                                </span>
                            )}
                        </button>

                        {/* Notifications */}
                        <button className="relative p-2 text-gray-700 hover:text-green-600 transition-colors hidden sm:block">
                            <Bell className="w-6 h-6" />
                        </button>

                        {/* User Menu / Sign In Button */}
                        {isLoading ? (
                            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                        ) : isAuthenticated ? (
                            <div className="relative">
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="flex items-center gap-2 p-2 text-gray-700 hover:text-green-600 transition-colors"
                                >
                                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-green-600" />
                                    </div>
                                    <span className="hidden md:block text-sm font-medium max-w-24 truncate">
                                        {user?.fullname?.split(' ')[0] || 'User'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 hidden md:block" />
                                </button>

                                {/* User Dropdown */}
                                {isUserMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsUserMenuOpen(false)}
                                        />
                                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                                            <div className="px-4 py-3 border-b border-gray-100">
                                                <p className="font-semibold text-gray-900">{user?.fullname}</p>
                                                <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                                            </div>
                                            <Link
                                                to="/orders"
                                                onClick={() => setIsUserMenuOpen(false)}
                                                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                                            >
                                                <Package className="w-5 h-5" />
                                                <span>My Orders</span>
                                            </Link>
                                            <Link
                                                to="/favorites"
                                                onClick={() => setIsUserMenuOpen(false)}
                                                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                                            >
                                                <Heart className="w-5 h-5" />
                                                <span>Favorites</span>
                                            </Link>
                                            <Link
                                                to="/subscriptions"
                                                onClick={() => setIsUserMenuOpen(false)}
                                                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                                            >
                                                <Repeat className="w-5 h-5" />
                                                <span>Subscriptions</span>
                                            </Link>
                                            {user?.role === 'ADMIN' && (
                                                <Link
                                                    to="/admin/dashboard"
                                                    onClick={() => setIsUserMenuOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-3 text-purple-700 hover:bg-purple-50 transition-colors"
                                                >
                                                    <Settings className="w-5 h-5" />
                                                    <span>Admin Dashboard</span>
                                                </Link>
                                            )}
                                            <button
                                                onClick={handleLogout}
                                                className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                                            >
                                                <LogOut className="w-5 h-5" />
                                                <span>Sign Out</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <Link
                                to="/login"
                                className="hidden sm:flex items-center bg-green-600 text-white px-7 py-3 rounded-full text-base font-semibold hover:bg-green-700 transition-all shadow-md hover:shadow-lg"
                            >
                                Sign In
                            </Link>
                        )}

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="lg:hidden p-2 text-gray-700 hover:text-green-600 transition-colors"
                        >
                            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="lg:hidden bg-white border-t border-gray-100">
                    <div className="px-4 py-5 space-y-4">
                        {navLinks.map(link => {
                            const IconComponent = link.icon;
                            return (
                                <NavLink
                                    key={link.path}
                                    to={link.path}
                                    onClick={() => setIsMenuOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 py-3 text-lg font-medium transition-colors ${isActive ? 'text-green-600' : 'text-gray-600 hover:text-green-600'
                                        }`
                                    }
                                >
                                    <IconComponent className="w-5 h-5" />
                                    {link.label}
                                </NavLink>
                            );
                        })}

                        {isAuthenticated ? (
                            <>
                                <Link
                                    to="/orders"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center gap-3 py-3 text-lg font-medium text-gray-600 hover:text-green-600 transition-colors"
                                >
                                    <Package className="w-5 h-5" />
                                    My Orders
                                </Link>
                                <Link
                                    to="/favorites"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center gap-3 py-3 text-lg font-medium text-gray-600 hover:text-green-600 transition-colors"
                                >
                                    <Heart className="w-5 h-5" />
                                    Favorites
                                </Link>
                                <Link
                                    to="/subscriptions"
                                    onClick={() => setIsMenuOpen(false)}
                                    className="flex items-center gap-3 py-3 text-lg font-medium text-gray-600 hover:text-green-600 transition-colors"
                                >
                                    <Repeat className="w-5 h-5" />
                                    Subscriptions
                                </Link>
                                {user?.role === 'ADMIN' && (
                                    <Link
                                        to="/admin/dashboard"
                                        onClick={() => setIsMenuOpen(false)}
                                        className="flex items-center gap-3 py-3 text-lg font-medium text-purple-600 hover:text-purple-700 transition-colors"
                                    >
                                        <Settings className="w-5 h-5" />
                                        Admin Dashboard
                                    </Link>
                                )}
                                {/* <button
                                    onClick={async () => {
                                        await logout();
                                        setIsMenuOpen(false);
                                    }}
                                    className="flex items-center gap-3 w-full py-3 text-lg font-medium text-red-600"
                                >
                                    <LogOut className="w-5 h-5" />
                                    Sign Out
                                </button> */}
                            </>
                        ) : (
                            <Link
                                to="/login"
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center justify-center w-full bg-green-600 text-white py-3.5 rounded-full text-base font-semibold mt-4"
                            >
                                Sign In
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
