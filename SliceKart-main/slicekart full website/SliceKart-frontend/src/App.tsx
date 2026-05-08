import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import ProtectedRoute, { GuestRoute, AdminRoute } from './components/ProtectedRoute'
import ScrollToTop from './components/ScrollToTop'
import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import ProductDetailPage from './pages/ProductDetailPage'
import TrackOrderPage from './pages/TrackOrderPage'
import OrdersPage from './pages/OrdersPage'
import OffersPage from './pages/OffersPage'
import ContactPage from './pages/ContactPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import FavoritesPage from './pages/FavoritesPage'
import SubscriptionsPage from './pages/SubscriptionsPage'
import CheckoutPage from './pages/CheckoutPage'

// Admin Pages
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminLayout from './components/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminOrders from './pages/admin/AdminOrders'
import AdminProducts from './pages/admin/AdminProducts'
import AdminUsers from './pages/admin/AdminUsers'
import AdminDeliveryPartners from './pages/admin/AdminDeliveryPartners'
import AdminCoupons from './pages/admin/AdminCoupons'

function App() {
    return (
        <>
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: '#333',
                        color: '#fff',
                        borderRadius: '10px',
                        padding: '12px 16px',
                    },
                    success: {
                        iconTheme: {
                            primary: '#22c55e',
                            secondary: '#fff',
                        },
                    },
                    error: {
                        iconTheme: {
                            primary: '#ef4444',
                            secondary: '#fff',
                        },
                    },
                }}
            />
            <ScrollToTop />
            <Routes>
                {/* Customer Routes */}
                <Route path="/" element={<Layout />}>
                    {/* Public routes */}
                    <Route index element={<HomePage />} />
                    <Route path="products" element={<ProductsPage />} />
                    <Route path="products/:id" element={<ProductDetailPage />} />
                    <Route path="offers" element={<OffersPage />} />
                    <Route path="contact" element={<ContactPage />} />

                    {/* Protected routes - require authentication */}
                    <Route path="orders" element={
                        <ProtectedRoute>
                            <OrdersPage />
                        </ProtectedRoute>
                    } />
                    <Route path="track-order" element={
                        <ProtectedRoute>
                            <TrackOrderPage />
                        </ProtectedRoute>
                    } />
                    <Route path="track-order/:id" element={
                        <ProtectedRoute>
                            <TrackOrderPage />
                        </ProtectedRoute>
                    } />
                    <Route path="favorites" element={
                        <ProtectedRoute>
                            <FavoritesPage />
                        </ProtectedRoute>
                    } />
                    <Route path="subscriptions" element={
                        <ProtectedRoute>
                            <SubscriptionsPage />
                        </ProtectedRoute>
                    } />
                    <Route path="checkout" element={
                        <ProtectedRoute>
                            <CheckoutPage />
                        </ProtectedRoute>
                    } />
                </Route>

                {/* Guest routes - redirect to home if already logged in */}
                <Route path="/login" element={
                    <GuestRoute>
                        <LoginPage />
                    </GuestRoute>
                } />
                <Route path="/register" element={
                    <GuestRoute>
                        <RegisterPage />
                    </GuestRoute>
                } />

                {/* Admin Routes */}
                <Route path="/admin/login" element={<AdminLoginPage />} />

                {/* Admin Protected Routes */}
                <Route path="/admin" element={
                    <AdminRoute>
                        <AdminLayout>
                            <Navigate to="/admin/dashboard" replace />
                        </AdminLayout>
                    </AdminRoute>
                } />
                <Route path="/admin/dashboard" element={
                    <AdminRoute>
                        <AdminLayout>
                            <AdminDashboard />
                        </AdminLayout>
                    </AdminRoute>
                } />
                <Route path="/admin/orders" element={
                    <AdminRoute>
                        <AdminLayout>
                            <AdminOrders />
                        </AdminLayout>
                    </AdminRoute>
                } />
                <Route path="/admin/products" element={
                    <AdminRoute>
                        <AdminLayout>
                            <AdminProducts />
                        </AdminLayout>
                    </AdminRoute>
                } />
                <Route path="/admin/coupons" element={
                    <AdminRoute>
                        <AdminLayout>
                            <AdminCoupons />
                        </AdminLayout>
                    </AdminRoute>
                } />
                <Route path="/admin/users" element={
                    <AdminRoute>
                        <AdminLayout>
                            <AdminUsers />
                        </AdminLayout>
                    </AdminRoute>
                } />
                <Route path="/admin/delivery-partners" element={
                    <AdminRoute>
                        <AdminLayout>
                            <AdminDeliveryPartners />
                        </AdminLayout>
                    </AdminRoute>
                } />
            </Routes>
        </>
    )
}

export default App
