import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: 'ADMIN' | 'CUSTOMER';
}

/**
 * ProtectedRoute component that guards routes requiring authentication
 * Redirects to login if not authenticated
 * Optionally checks for specific role
 */
export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        // Save the attempted URL for redirecting after login
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check for required role if specified
    if (requiredRole && user?.role !== requiredRole) {
        // User doesn't have required role
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="text-6xl mb-4">🚫</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                    <p className="text-gray-500 mb-6">
                        You don't have permission to access this page.
                    </p>
                    <Navigate to="/" replace />
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

/**
 * AdminRoute component - protects admin routes
 * Redirects to admin login if not authenticated or not an admin
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading...</p>
                </div>
            </div>
        );
    }

    // Redirect to admin login if not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }

    // Check if user is admin
    if (user?.role !== 'ADMIN') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center max-w-md mx-auto p-8">
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                    <p className="text-slate-400 mb-6">
                        You need administrator privileges to access this area.
                    </p>
                    <a
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Go to Store
                    </a>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

/**
 * GuestRoute component - redirects to home if already authenticated
 * Useful for login/register pages
 */
export function GuestRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        );
    }

    if (isAuthenticated) {
        // If admin, redirect to admin dashboard
        if (user?.role === 'ADMIN') {
            return <Navigate to="/admin/dashboard" replace />;
        }
        // Redirect to the page they came from, or home
        const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
        return <Navigate to={from} replace />;
    }

    return <>{children}</>;
}
