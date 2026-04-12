import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        identifier: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Get the page to redirect to after login (from ProtectedRoute)
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

    // Detect if input looks like a phone number (all digits)
    const isPhone = /^\d+$/.test(formData.identifier);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.identifier.trim()) {
            setError('Please enter your email or mobile number');
            return;
        }

        if (isPhone && formData.identifier.length !== 10) {
            setError('Please enter a valid 10-digit mobile number');
            return;
        }

        setIsLoading(true);

        try {
            await login(formData.identifier, formData.password);
            // Navigate to the page they tried to visit, or home
            navigate(from, { replace: true });
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Invalid credentials';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    return (
        <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Logo */}
                <Link to="/" className="flex items-center justify-center gap-3 mb-10">
                    <div className="w-16 h-16 flex items-center justify-center">
                        <img src="/image-removebg-preview.png" alt="SliceKart" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-3xl font-bold text-gray-900">SliceKart</span>
                </Link>

                {/* Login Card */}
                <div className="bg-white rounded-3xl shadow-2xl p-10">
                    <h1 className="text-3xl font-bold text-gray-900 text-center mb-3">Welcome Back!</h1>
                    <p className="text-gray-500 text-center mb-10 text-base">Sign in to continue to SliceKart</p>

                    {error && (
                        <div className="bg-red-50 text-red-600 px-5 py-4 rounded-xl mb-8 text-base">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="identifier" className="block text-base font-medium text-gray-700 mb-2">
                                Email or Mobile Number
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    id="identifier"
                                    name="identifier"
                                    value={formData.identifier}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-14 pr-4 py-4 rounded-xl border border-gray-200 text-base focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
                                    placeholder="Enter email or mobile number"
                                    autoComplete="username"
                                />
                                <div className="absolute left-4 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                                    {isPhone && formData.identifier.length > 0 ? (
                                        <Phone className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <Mail className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-base font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-14 pr-14 py-4 rounded-xl border border-gray-200 text-base focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
                                    placeholder="Enter your password"
                                />
                                <div className="absolute left-4 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                                    <Lock className="w-5 h-5 text-gray-400" />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 text-gray-400 hover:text-gray-600 p-1"
                                    style={{ top: '50%', transform: 'translateY(-50%)' }}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                <span className="text-gray-600 text-base">Remember me</span>
                            </label>
                            <Link to="/forgot-password" className="text-green-600 font-medium hover:underline text-base">
                                Forgot Password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-semibold hover:bg-green-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    {/* Register Link */}
                    <p className="text-center text-gray-600 mt-10 text-base">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-green-600 font-semibold hover:underline">
                            Sign Up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
