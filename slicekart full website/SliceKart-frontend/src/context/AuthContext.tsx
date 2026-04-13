import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthState, User } from '../types';
import api, { authApi, ApiError } from '../services/api';

// Response types for API calls


interface LoginResponse {
    user: User;
    message: string;
}

interface UserResponse {
    user: User;
}

interface AuthContextType extends AuthState {
    login: (identifier: string, password: string) => Promise<void>;
    register: (fullname: string, email: string, password: string, phone?: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({
        user: null,
        isAuthenticated: false,
        isLoading: true,
    });

    // Check authentication status on mount
    const checkAuth = useCallback(async () => {
        try {
            // First try to verify current token
            const verifyResponse = await authApi.verify() as any;

if (verifyResponse && verifyResponse.data?.authenticated) {
    setState({
        user: verifyResponse.data.user,
        isAuthenticated: true,
        isLoading: false,
    });
    return;
}
        } catch {
            // Token might be expired, try to refresh
            try {
                await authApi.refresh();
                // If refresh succeeded, verify again
                const verifyResponse = await authApi.verify() as any;

if (verifyResponse && verifyResponse.data?.authenticated) {
    setState({
        user: verifyResponse.data.user,
        isAuthenticated: true,
        isLoading: false,
    });
    return;
}
            } catch {
                // Both verify and refresh failed
            }
        }

        // Not authenticated
        setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
        });
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const refreshUser = async () => {
        try {
            const response = await api.get('/users/me') as { data: UserResponse };
            setState(prev => ({
                ...prev,
                user: response.data.user,
            }));
        } catch (err) {
            console.error('Failed to refresh user:', err);
        }
    };

    const login = async (identifier: string, password: string) => {
        try {
            const response = await authApi.login(identifier, password) as { data: LoginResponse };

            setState({
                user: response.data.user,
                isAuthenticated: true,
                isLoading: false,
            });
        } catch (error) {
            // Extract error message from API response
            let errorMessage = 'Invalid email or password';

            if (error instanceof ApiError && error.response?.data) {
                const data = error.response.data as { message?: string };
                if (data.message) {
                    errorMessage = data.message;
                }
            }

            throw new Error(errorMessage);
        }
    };

    const register = async (fullname: string, email: string, password: string, phone?: string) => {
        try {
            await authApi.register(fullname, email, password, phone);
        } catch (error) {
            // Extract error message from API response
            let errorMessage = 'Registration failed. Please try again.';

            if (error instanceof ApiError && error.response?.data) {
                const data = error.response.data as { message?: string };
                if (data.message) {
                    errorMessage = data.message;
                }
            }

            throw new Error(errorMessage);
        }
    };

    const logout = async () => {
        try {
            await authApi.logout();
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            // Always clear local state regardless of API response
            setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
            });
        }
    };

    return (
        <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Type export for external use
export type { AuthContextType };
