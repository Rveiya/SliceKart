// Custom error class to match axios-like error structure
export class ApiError extends Error {
    response?: {
        status: number;
        data: unknown;
    };
    config?: RequestConfig;

    constructor(message: string, status?: number, data?: unknown, config?: RequestConfig) {
        super(message);
        this.name = 'ApiError';
        if (status !== undefined) {
            this.response = { status, data };
        }
        this.config = config;
    }
}

interface RequestConfig {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    _retry?: boolean;
}

interface ApiResponse<T = unknown> {
    data: T;
    status: number;
    ok: boolean;
}

const BASE_URL = "https://slicekart-backend.onrender.com/api";

// Track if we're currently refreshing the token
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });
    failedQueue = [];
};

// Core fetch wrapper with interceptor logic
async function request<T = unknown>(
    endpoint: string,
    options: RequestInit & { _retry?: boolean } = {}
): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

    // Get access token from localStorage
    const accessToken = localStorage.getItem('accessToken');

    const config: RequestInit = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
            ...options.headers,
        },
    };

    try {
        const response = await fetch(url, config);

        // Parse JSON response
        let data: T;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text() as unknown as T;
        }

        // Handle non-OK responses
        if (!response.ok) {
            // Handle 401 with token refresh
            if (response.status === 401 && !options._retry) {
                // Don't retry refresh requests to avoid infinite loop
                if (endpoint.includes('/auth/login') ||
                    endpoint.includes('/auth/register')) {
                    throw new ApiError('Unauthorized', response.status, data, {
                        url: endpoint,
                        method: options.method,
                        _retry: options._retry
                    });
                }

                // If already refreshing, queue this request
                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    }).then(() => {
                        return request<T>(endpoint, { ...options, _retry: true });
                    }).catch(err => {
                        throw err;
                    });
                }

                isRefreshing = true;

                try {
                    // Attempt to refresh the token
                    const refreshToken = localStorage.getItem('refreshToken');
                    if (!refreshToken) {
                        throw new Error('No refresh token available');
                    }

                    const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${refreshToken}`
                        },
                    });

                    if (!refreshResponse.ok) {
                        throw new Error('Token refresh failed');
                    }

                    const refreshData = await refreshResponse.json();
                    if (refreshData.accessToken) {
                        localStorage.setItem('accessToken', refreshData.accessToken);
                    }

                    // Token refreshed successfully, process queued requests
                    processQueue(null);

                    // Retry the original request
                    return request<T>(endpoint, { ...options, _retry: true });
                } catch (refreshError) {
                    // Refresh failed, clear tokens and process queue with error
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    processQueue(refreshError as Error);
                    throw refreshError;
                } finally {
                    isRefreshing = false;
                }
            }

            throw new ApiError(
                (data as { message?: string })?.message || 'Request failed',
                response.status,
                data,
                { url: endpoint, method: options.method }
            );
        }

        return {
            data,
            status: response.status,
            ok: response.ok,
        };
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        // Network or other errors
        throw new ApiError(
            error instanceof Error ? error.message : 'Network error',
            undefined,
            undefined,
            { url: endpoint, method: options.method }
        );
    }
}

// API wrapper with axios-like interface
const api = {
    get: <T = unknown>(endpoint: string, options?: RequestInit) =>
        request<T>(endpoint, { ...options, method: 'GET' }),

    post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
        request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        }),

    put: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
        request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        }),

    patch: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
        request<T>(endpoint, {
            ...options,
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined,
        }),

    delete: <T = unknown>(endpoint: string, options?: RequestInit) =>
        request<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default api;

// Auth-specific API calls
export const authApi = {
    login: async (identifier: string, password: string) => {
        const response = await api.post('/auth/login', { identifier, password });
        console.log('Login response:', response);
        console.log('Response data:', response.data);

        if ((response.data as any).accessToken && (response.data as any).refreshToken) {
            const accessToken = (response.data as any).accessToken;
            const refreshToken = (response.data as any).refreshToken;

            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);

            console.log('Tokens stored successfully');
            console.log('Stored accessToken:', localStorage.getItem('accessToken'));
            console.log('Stored refreshToken:', localStorage.getItem('refreshToken'));
        } else {
            console.warn('Tokens not found in response:', response.data);
        }
        return response;
    },

    register: (fullname: string, email: string, password: string, phone?: string) =>
        api.post('/auth/register', { fullname, email, password, phone }),

    logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        return api.post('/auth/logout');
    },

    refresh: async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }
        return request('/auth/refresh', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${refreshToken}`
            }
        });
    },

    verify: () => Promise.resolve(null),
};
