import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, Phone, ChevronDown, ChevronUp } from 'lucide-react';

export default function Footer() {
    const location = useLocation();
    const [openSection, setOpenSection] = useState<string | null>(null);

    const toggleSection = (section: string) => {
        setOpenSection(openSection === section ? null : section);
    };
    const quickLinks = [
        { label: 'Home', path: '/' },
        { label: 'Our Fruits', path: '/products' },
        { label: 'Subscription Plans', path: '/products' },
        { label: 'About Us', path: '/about' },
        { label: 'Blog', path: '/blog' },
        { label: 'Contact Us', path: '/contact' },
    ];

    const products = [
        { label: 'Papaya', path: '/products?category=papaya' },
        { label: 'Watermelon', path: '/products?category=watermelon' },
        { label: 'Pineapple', path: '/products?category=pineapple' },
        { label: 'Muskmelon', path: '/products?category=muskmelon' },
        { label: 'Pomegranate', path: '/products?category=pomegranate' },
    ];

    const policies = [
        { label: 'Privacy Policy', path: '/privacy-policy' },
        { label: 'Terms & Conditions', path: '/terms' },
        { label: 'Refund & Cancellation', path: '/refund' },
        { label: 'Shipping Policy', path: '/shipping' },
    ];

    return (
        <footer>
            {/* App Download Banner */}
            {location.pathname === '/' && (
                <div className="bg-green-600">
                    <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20 py-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                {/* Logo Icon */}
                                {/* <div className="w-10 h-10 flex items-center justify-center">
                                    <svg viewBox="0 0 40 40" className="w-10 h-10">
                                        <path
                                            d="M10 12 L12 35 C12 37 14 38 16 38 L24 38 C26 38 28 37 28 35 L30 12 Z"
                                            fill="white"
                                        />
                                        <ellipse cx="20" cy="12" rx="10" ry="3" fill="white" />
                                        <rect x="23" y="2" width="3" height="20" fill="white" rx="1" />
                                        <rect x="23" y="2" width="8" height="3" fill="white" rx="1" />
                                        <circle cx="16" cy="22" r="2" fill="#00A651" opacity="0.4" />
                                        <circle cx="22" cy="28" r="1.5" fill="#00A651" opacity="0.4" />
                                    </svg>
                                </div> */}
                                <div className="w-10 h-10 flex items-center justify-center">
                                    <img src="/image-removebg-preview.png" alt="SliceKart" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-white text-lg font-semibold">SliceKart</span>
                            </div>
                            <div className="text-center md:text-left flex-1 md:ml-8">
                                <h3 className="text-white text-2xl sm:text-3xl font-bold">Get the SliceKart App now!</h3>
                                <p className="text-white/80 text-sm mt-1">For best offers and subscription plans Specially for you</p>
                            </div>
                            <div className="hidden md:block">
                                {/* App mockup image placeholder */}
                                <div className="w-24 h-20 bg-white/10 rounded-lg flex items-center justify-center">
                                    <svg viewBox="0 0 60 80" className="w-12 h-16">
                                        <rect x="5" y="5" width="50" height="70" rx="8" fill="white" opacity="0.2" />
                                        <rect x="10" y="15" width="40" height="50" fill="white" opacity="0.1" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Footer */}
            <div className="bg-gray-900 text-gray-300">
                <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20 py-10">
                    <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-0 sm:gap-8">
                        {/* Brand */}
                        <div className="flex flex-col items-center sm:block mb-6 sm:mb-0">
                            <Link to="/" className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                                {/* <div className="w-8 h-8 flex items-center justify-center">
                                    <svg viewBox="0 0 40 40" className="w-8 h-8">
                                        <path
                                            d="M10 12 L12 35 C12 37 14 38 16 38 L24 38 C26 38 28 37 28 35 L30 12 Z"
                                            fill="#00A651"
                                        />
                                        <ellipse cx="20" cy="12" rx="10" ry="3" fill="#00A651" />
                                        <rect x="23" y="2" width="3" height="20" fill="#00A651" rx="1" />
                                        <rect x="23" y="2" width="8" height="3" fill="#00A651" rx="1" />
                                        <circle cx="16" cy="22" r="2" fill="white" opacity="0.4" />
                                        <circle cx="22" cy="28" r="1.5" fill="white" opacity="0.4" />
                                    </svg>
                                </div> */}
                                <div className="w-8 h-8 flex items-center justify-center">
                                    <img src="/image-removebg-preview.png" alt="SliceKart" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-lg font-semibold text-white">SliceKart</span>
                            </Link>
                            <p className="hidden sm:block text-gray-400 text-sm mt-2">
                                Fresh fruits prepared with care and delivered with freshness. Eat healthy, stay energetic, and enjoy the taste of nature every day.
                            </p>
                        </div>

                        {/* Quick Links */}
                        <div className="text-left border-b border-gray-800 sm:border-none py-4 sm:py-0">
                            <button
                                className="w-full flex items-center justify-between sm:hidden text-white text-[15px] font-bold"
                                onClick={() => toggleSection('quickLinks')}
                            >
                                <span>Quick Links</span>
                                {openSection === 'quickLinks' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                            </button>
                            <h4 className="hidden sm:block text-white text-base font-semibold mb-4 pb-2 border-b border-gray-700">Quick Links</h4>
                            <ul className={`space-y-4 sm:space-y-2 mt-4 sm:mt-0 pl-2 sm:pl-0 ${openSection === 'quickLinks' ? 'block' : 'hidden'} sm:block`}>
                                {quickLinks.map(link => (
                                    <li key={link.label}>
                                        <Link to={link.path} className="text-gray-400 hover:text-white sm:hover:text-green-500 transition-colors text-sm">
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Our Products */}
                        <div className="text-left border-b border-gray-800 sm:border-none py-4 sm:py-0">
                            <button
                                className="w-full flex items-center justify-between sm:hidden text-white text-[15px] font-bold"
                                onClick={() => toggleSection('products')}
                            >
                                <span>Our Products</span>
                                {openSection === 'products' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                            </button>
                            <h4 className="hidden sm:block text-white text-base font-semibold mb-4 pb-2 border-b border-gray-700">Our Products</h4>
                            <ul className={`space-y-4 sm:space-y-2 mt-4 sm:mt-0 pl-2 sm:pl-0 ${openSection === 'products' ? 'block' : 'hidden'} sm:block`}>
                                {products.map(link => (
                                    <li key={link.label}>
                                        <Link to={link.path} className="text-gray-400 hover:text-white sm:hover:text-green-500 transition-colors text-sm">
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Legal / Policies (Mobile Only Accordion) */}
                        <div className="text-left border-b border-gray-800 sm:hidden py-4">
                            <button
                                className="w-full flex items-center justify-between text-white text-[15px] font-bold"
                                onClick={() => toggleSection('legal')}
                            >
                                <span>Legal</span>
                                {openSection === 'legal' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                            </button>
                            <ul className={`space-y-4 mt-4 pl-2 ${openSection === 'legal' ? 'block' : 'hidden'}`}>
                                {policies.map(link => (
                                    <li key={link.label}>
                                        <Link to={link.path} className="text-gray-400 hover:text-white transition-colors text-sm">
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Contact Us */}
                        <div className="text-left py-4 sm:py-0">
                            <button
                                className="w-full flex items-center justify-between sm:hidden text-white text-[15px] font-bold"
                                onClick={() => toggleSection('contact')}
                            >
                                <span>Contact Us</span>
                                {openSection === 'contact' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                            </button>
                            <h4 className="hidden sm:block text-white text-base font-semibold mb-4 pb-2 border-b border-gray-700">Contact Us</h4>
                            <ul className={`space-y-4 sm:space-y-3 mt-4 sm:mt-0 pl-2 sm:pl-0 ${openSection === 'contact' ? 'block' : 'hidden'} sm:block`}>
                                <li className="flex items-center justify-start gap-3">
                                    <Mail className="w-5 h-5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                                    <a href="mailto:support@slicekart.online" className="text-gray-400 hover:text-white sm:hover:text-green-500 transition-colors text-sm">
                                        support@slicekart.online
                                    </a>
                                </li>
                                <li className="flex items-center justify-start gap-3">
                                    <Phone className="w-5 h-5 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                                    <a href="tel:+919742608767" className="text-gray-400 hover:text-white sm:hover:text-green-500 transition-colors text-sm">
                                        +91 97426 08767
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Policies & Copyright */}
                <div className="border-t border-gray-800">
                    <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20 py-4">
                        <div className="hidden sm:flex flex-wrap items-center justify-center gap-4 sm:gap-8 mb-4">
                            {policies.map(link => (
                                <Link
                                    key={link.label}
                                    to={link.path}
                                    className="text-gray-400 hover:text-green-500 transition-colors text-sm"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                        <div className="text-center mt-2 sm:mt-0">
                            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} SliceKart. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
