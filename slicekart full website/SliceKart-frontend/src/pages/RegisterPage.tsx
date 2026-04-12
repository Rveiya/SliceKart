import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
    const navigate = useNavigate();
    const { register } = useAuth();
    const [formData, setFormData] = useState({
        fullname: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (formData.phone && !/^[0-9]{10}$/.test(formData.phone)) {
            setError('Please enter a valid 10-digit mobile number');
            return;
        }

        setIsLoading(true);

        try {
            await register(formData.fullname, formData.email, formData.password, formData.phone);
            navigate('/login');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Registration failed. Please try again.';
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
            <div className="w-full max-w-md">
                {/* Logo */}
                <Link to="/" className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-14 h-14 flex items-center justify-center">
                        <img src="/image-removebg-preview.png" alt="SliceKart" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-2xl font-bold text-gray-900">SliceKart</span>
                </Link>

                {/* Register Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Create Account</h1>
                    <p className="text-gray-500 text-center mb-8">Join SliceKart for fresh, natural Fruits</p>

                    {error && (
                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="fullname" className="block text-sm font-medium text-gray-700 mb-1">
                                Full Name
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    id="fullname"
                                    name="fullname"
                                    value={formData.fullname}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-14 pr-4 py-4 rounded-xl border border-gray-200 text-base focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
                                    placeholder="Enter your full name"
                                />
                                <div className="absolute left-4 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                                    <User className="w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email Address
                            </label>
                            <div className="relative">
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-14 pr-4 py-4 rounded-xl border border-gray-200 text-base focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
                                    placeholder="Enter your email"
                                />
                                <div className="absolute left-4 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                                    <Mail className="w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                                Mobile Number
                            </label>
                            <div className="relative">
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-14 pr-4 py-4 rounded-xl border border-gray-200 text-base focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
                                    placeholder="Enter your mobile number"
                                    pattern="[0-9]{10}"
                                    maxLength={10}
                                />
                                <div className="absolute left-4 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                                    <Phone className="w-5 h-5 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
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
                                    placeholder="Create a password"
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

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-14 pr-14 py-4 rounded-xl border border-gray-200 text-base focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
                                    placeholder="Confirm your password"
                                />
                                <div className="absolute left-4 w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center pointer-events-none" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                                    <Lock className="w-5 h-5 text-gray-400" />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 text-gray-400 hover:text-gray-600 p-1"
                                    style={{ top: '50%', transform: 'translateY(-50%)' }}
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                id="terms"
                                required
                                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-brand-green focus:ring-brand-green"
                            />
                            <label htmlFor="terms" className="text-sm text-gray-600">
                                I agree to the{' '}
                                <Link to="/terms" className="text-brand-green hover:underline">Terms & Conditions</Link>
                                {' '}and{' '}
                                <Link to="/privacy" className="text-brand-green hover:underline">Privacy Policy</Link>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-brand-green text-white py-3 rounded-lg font-semibold hover:bg-brand-green-dark transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>

                    {/* Divider */}
                    {/* <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-gray-400 text-sm">or continue with</span>
                        <div className="flex-1 h-px bg-gray-200" />
                    </div> */}

                    {/* Social Login */}
                    {/* <div>
                        <button className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-smooth">
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Continue with Google</span>
                        </button>
                    </div> */}

                    {/* Login Link */}
                    <p className="text-center text-gray-600 mt-8">
                        Already have an account?{' '}
                        <Link to="/login" className="text-brand-green font-medium hover:underline">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
