import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import CartDrawer from './CartDrawer';

export default function Layout() {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <CartDrawer />
            <main className="flex-grow">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
