import { X, Minus, Plus, Receipt, ChevronRight, Sparkles, MapPin, CreditCard, Banknote, AlertTriangle, Tag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { Address } from '../types';
import AddressModal from './AddressModal';
import OrderSuccessModal from './OrderSuccessModal';
import { useNavigate } from 'react-router-dom';
import { addressesService, CreateAddressData } from '../services/addresses';
import { checkoutService } from '../services/checkout';
import { paymentsService, RazorpayResponse } from '../services/payments';
import { couponService, Coupon } from '../services/coupons';
import StockWarningBanner, { StockWarningItemBadge } from './StockWarningBanner';
import { toast } from 'react-hot-toast';

type CheckoutStep = 'cart' | 'address' | 'payment' | 'confirm';

export default function CartDrawer() {
    const navigate = useNavigate();
    const {
        items,
        updateQuantity,
        total,
        isCartOpen,
        closeCart,
        clearCart,
        stockIssues,
        hasStockIssues,
        adjustCartToStock,
        clearStockIssues
    } = useCart();
    const { isAuthenticated } = useAuth();

    const tip = 0;
    const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('cart');
    const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE'>('ONLINE');
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [showPaymentOptions, setShowPaymentOptions] = useState(false);
    const [isAdjustingCart, setIsAdjustingCart] = useState(false);
    const [showCouponsDropdown, setShowCouponsDropdown] = useState(true);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);
    const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
    const [couponDiscount, setCouponDiscount] = useState(0);

    const deliveryFee = total >= 199 ? 0 : 10;
    const handlingFee = total >= 199 ? 0 : 10;
    const gst = total >= 199 ? 0 : Math.round(total * 0.18 * 100) / 100;
    const finalTotal = total + deliveryFee + handlingFee + gst + tip - couponDiscount;

    useEffect(() => {
        if (isCartOpen && isAuthenticated && (checkoutStep === 'address' || items.length > 0)) {
            fetchAddresses();
        }
        if (isCartOpen && items.length > 0) {
            fetchCoupons();
        }
    }, [isCartOpen, isAuthenticated, checkoutStep]);

    const fetchAddresses = async () => {
        setIsLoadingAddresses(true);
        try {
            const data = await addressesService.getAll();
            setAddresses(data);
        } catch (error) {
            console.error('Failed to fetch addresses:', error);
        } finally {
            setIsLoadingAddresses(false);
        }
    };

    const fetchCoupons = async () => {
        setIsLoadingCoupons(true);
        try {
            const response = await couponService.getAvailableCoupons();
            if (response.success) {
                setCoupons(response.coupons);
            }
        } catch (error) {
            console.error('Failed to fetch coupons:', error);
            toast.error('Could not load coupons');
        } finally {
            setIsLoadingCoupons(false);
        }
    };

    const handleApplyCoupon = async (coupon: Coupon) => {
        try {
            const discount = coupon.discount_type === 'percentage'
                ? Math.min((total * coupon.discount_value) / 100, coupon.max_discount_amount || Infinity)
                : coupon.discount_value;

            if (total < coupon.min_order_amount) {
                toast.error(`Minimum order amount is ₹${coupon.min_order_amount}`);
                return;
            }

            setSelectedCoupon(coupon);
            setCouponDiscount(discount);
            setShowCouponsDropdown(false);
            toast.success(`Coupon "${coupon.code}" applied!`);
        } catch (error) {
            console.error('Error applying coupon:', error);
            toast.error('Failed to apply coupon');
        }
    };

    const handleRemoveCoupon = () => {
        setSelectedCoupon(null);
        setCouponDiscount(0);
        toast.success('Coupon removed');
    };

    const handleClose = () => {
        setCheckoutStep('cart');
        setSelectedAddress(null);
        closeCart();
    };

    const handleSelectAddress = (address: Address) => {
        setSelectedAddress(address);
        setCheckoutStep('payment');
    };

    const handleSaveAddress = async (data: CreateAddressData) => {
        try {
            const newAddress = await addressesService.create(data);
            setAddresses(prev => [...prev, newAddress]);
            
            // Auto-select the newly created address if none is selected
            if (!selectedAddress) {
                handleSelectAddress(newAddress);
            }
            
            setShowAddressModal(false);
            toast.success('Address saved successfully');
        } catch (error) {
            console.error('Failed to create address:', error);
            toast.error('Failed to save address');
        }
    };

    const handleAdjustCart = async () => {
        setIsAdjustingCart(true);
        try {
            const adjustments = await adjustCartToStock();
            if (adjustments.length > 0) {
                const removedCount = adjustments.filter(a => a.action === 'removed').length;
                const adjustedCount = adjustments.filter(a => a.action === 'adjusted').length;

                let message = 'Cart updated: ';
                if (removedCount > 0) message += `${removedCount} item(s) removed`;
                if (removedCount > 0 && adjustedCount > 0) message += ', ';
                if (adjustedCount > 0) message += `${adjustedCount} item(s) quantity adjusted`;

                toast.success(message);
            }
        } catch (error) {
            console.error('Failed to adjust cart:', error);
            toast.error('Failed to update cart');
        } finally {
            setIsAdjustingCart(false);
        }
    };

    const handleProceedToCheckout = () => {
        if (!isAuthenticated) {
            handleClose();
            navigate('/login');
            return;
        }

        // Check for stock issues before proceeding
        if (hasStockIssues) {
            toast.error('Please resolve stock issues before checkout');
            return;
        }

        // If an address is already selected (auto-selected default), go straight to payment
        if (selectedAddress) {
            setCheckoutStep('payment');
        } else {
            setCheckoutStep('address');
            fetchAddresses();
        }
    };

    // ─────────────────────────────────────────────────────────────
    // FIX: coupon_code is now passed to the checkout API so the
    // backend can validate it, apply the discount to the order
    // total, and charge the correct amount via Razorpay.
    // ─────────────────────────────────────────────────────────────
    const handlePlaceOrder = async () => {
        if (!selectedAddress) return;

        setIsPlacingOrder(true);
        try {
            // Use checkout API which properly handles subscriptions vs one-time orders
            const result = await checkoutService.checkout({
                delivery_address_id: selectedAddress.id,
                delivery_fee: deliveryFee,
                handling_fee: handlingFee,
                payment_method: paymentMethod,
                tip: tip,
                coupon_code: selectedCoupon?.code   // ✅ FIX: send coupon to backend
            });

            // Determine the primary order for payment processing
            // Could be a regular order or the first subscription activation order
            const primaryOrder = result.order || (result.subscriptionOrders && result.subscriptionOrders[0]);

            if (paymentMethod === 'ONLINE' && primaryOrder) {
                // Initiate Razorpay payment
                await paymentsService.initiatePayment(
                    primaryOrder.id,
                    {
                        name: selectedAddress.name,
                        phone: selectedAddress.phone
                    },
                    async (response: RazorpayResponse) => {
                        // Verify payment on successful payment
                        try {
                            await paymentsService.verifyPayment({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                order_id: primaryOrder.id
                            });
                            setShowSuccessModal(true);
                            clearCart();
                        } catch (verifyError) {
                            console.error('Payment verification failed:', verifyError);
                            alert('Payment verification failed. Please contact support.');
                        } finally {
                            setIsPlacingOrder(false);
                        }
                    },
                    () => {
                        // On dismiss - order is already created, just reset loading
                        setIsPlacingOrder(false);
                        clearCart();
                        alert('Payment was cancelled. Your order has been saved. You can pay later from the orders page.');
                    }
                );
            } else {
                // COD - checkout already created orders and/or subscriptions
                setShowSuccessModal(true);
                clearCart();
                setIsPlacingOrder(false);
            }
        } catch (error) {
            console.error('Failed to place order:', error);
            alert('Failed to place order. Please try again.');
            setIsPlacingOrder(false);
        }
    };

    const handleTrackOrder = () => {
        setShowSuccessModal(false);
        handleClose();
        navigate('/orders');
    };

    const handleBackToProducts = () => {
        setShowSuccessModal(false);
        handleClose();
        navigate('/products');
    };

    if (!isCartOpen) return null;

    if (showSuccessModal) {
        return (
            <OrderSuccessModal
                isOpen={true}
                onClose={() => {
                    setShowSuccessModal(false);
                    handleClose();
                }}
                onTrackOrder={handleTrackOrder}
                onBackToProducts={handleBackToProducts}
                savedAmount={couponDiscount > 0 ? couponDiscount : 30}
            />
        );
    }

    // Select Delivery Address Screen
    if (checkoutStep === 'address') {
        return (
            <>
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div className="absolute inset-0 bg-black/30 transition-opacity" onClick={handleClose} />
                    <div className="absolute inset-y-0 right-0 w-[400px] flex flex-col bg-white shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4">
                            <h2 className="text-base font-bold text-gray-900">Select Delivery Address</h2>
                            <button onClick={handleClose} className="text-green-600 hover:text-green-700 transition-colors">
                                <X className="w-5 h-5" strokeWidth={2} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-hide px-4">
                            {/* Add New Address Button */}
                            <button
                                onClick={() => setShowAddressModal(true)}
                                className="w-full flex items-center justify-center gap-1 py-4 border border-green-600 rounded-xl text-green-600 font-medium text-sm hover:bg-green-50 transition-colors mb-4"
                            >
                                <Plus className="w-4 h-4" />
                                Add New Address
                            </button>

                            {/* Saved Addresses */}
                            <p className="text-xs text-gray-500 mb-3">Your saved addresses</p>
                            {isLoadingAddresses ? (
                                <div className="flex justify-center p-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {addresses.length === 0 ? (
                                        <p className="text-sm text-gray-400 text-center py-4">No saved addresses found.</p>
                                    ) : (
                                        addresses.map((address) => (
                                            <div
                                                key={address.id}
                                                className="p-3 bg-white rounded-xl border border-gray-200 cursor-pointer hover:border-green-600 transition-colors"
                                                onClick={() => handleSelectAddress(address)}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                                                            <MapPin className="w-5 h-5 text-green-600" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-semibold text-gray-900 text-sm">{address.name}</h4>
                                                                {address.is_default && (
                                                                    <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 text-[10px] font-bold">DEFAULT</span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-400">{address.street}</p>
                                                            <p className="text-xs text-green-600 font-medium mt-0.5">{address.phone}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4">
                            <button
                                onClick={() => addresses.length > 0 && handleSelectAddress(addresses[0])}
                                disabled={addresses.length === 0}
                                className="w-full bg-green-600 text-white font-semibold py-4 rounded-xl hover:bg-green-700 transition-all active:scale-[0.99] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Select Payment Option
                            </button>
                        </div>
                    </div>
                </div>
                <AddressModal
                    isOpen={showAddressModal}
                    onClose={() => setShowAddressModal(false)}
                    onSave={handleSaveAddress}
                />
            </>
        );
    }

    // Cart with Selected Address (Payment step)
    if (checkoutStep === 'payment' && selectedAddress) {
        return (
            <>
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div className="absolute inset-0 bg-black/30 transition-opacity" onClick={handleClose} />
                    <div className="absolute inset-y-0 right-0 w-[400px] flex flex-col bg-white shadow-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4">
                            <h2 className="text-base font-bold text-gray-900">My Cart</h2>
                            <button onClick={handleClose} className="text-green-600 hover:text-green-700 transition-colors">
                                <X className="w-5 h-5" strokeWidth={2} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto scrollbar-hide px-4">
                            {/* Your Items Label */}
                            <p className="text-xs text-gray-500 mb-3">Your Items</p>

                            {/* Items List */}
                            <div className="space-y-3 mb-4">
                                {items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
                                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
                                            <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-gray-900 text-sm">{item.product.name}</h4>
                                            <p className="text-xs text-gray-400">{item.product.volume}</p>
                                            <p className="text-sm font-bold text-green-600">₹{item.product.price}</p>
                                        </div>
                                        <div className="flex items-center bg-green-600 rounded-lg overflow-hidden flex-shrink-0">
                                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center text-white hover:bg-green-700 transition-colors">
                                                <Minus className="w-3 h-3" strokeWidth={2.5} />
                                            </button>
                                            <span className="w-5 text-center text-white font-bold text-sm">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center text-white hover:bg-green-700 transition-colors">
                                                <Plus className="w-3 h-3" strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Bill Summary */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
                                        <Receipt className="w-3.5 h-3.5 text-gray-600" />
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-sm">Bill Summary</h3>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500">Items Total</span>
                                        <span className="text-gray-900">₹{total}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500">Delivery Fee</span>
                                        <span className={deliveryFee === 0 ? "text-green-600 font-medium" : "text-gray-900"}>{deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500">Handling Fee</span>
                                        <span className={handlingFee === 0 ? "text-green-600 font-medium" : "text-gray-900"}>{handlingFee === 0 ? "Free" : `₹${handlingFee}`}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500">GST Charges (18%)</span>
                                        <span className={gst === 0 ? "text-green-600 font-medium" : "text-gray-900"}>{gst === 0 ? "Free" : `₹${gst.toFixed(2)}`}</span>
                                    </div>
                                    {tip > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Delivery Tip</span>
                                            <span className="text-gray-900">₹{tip}</span>
                                        </div>
                                    )}
                                    {/* ✅ FIX: Show coupon discount row in payment step bill summary */}
                                    {couponDiscount > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 flex items-center gap-1">
                                                <Tag className="w-3 h-3 text-green-600" />
                                                Coupon Discount
                                                {selectedCoupon && (
                                                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">
                                                        {selectedCoupon.code}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-green-600 font-medium">-₹{couponDiscount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="pt-2 mt-1 border-t border-gray-100 flex justify-between items-center">
                                        <span className="font-bold text-gray-900">Total Amount</span>
                                        <span className="font-bold text-gray-900">₹{finalTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* View Coupons */}
                            <button
                                onClick={() => {
                                    setShowCouponsDropdown(!showCouponsDropdown);
                                    if (!showCouponsDropdown && coupons.length === 0) {
                                        fetchCoupons();
                                    }
                                }}
                                className="w-full flex items-center justify-between py-3 hover:bg-gray-50 transition-colors mb-3"
                            >
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-purple-500" />
                                    <span className="text-gray-900 text-sm">View Coupons</span>
                                </div>
                                <ChevronRight className={`w-4 h-4 text-green-600 transition-transform ${showCouponsDropdown ? 'rotate-90' : ''}`} />
                            </button>

                            {/* Coupons Dropdown */}
                            {showCouponsDropdown && (
                                <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 max-h-64 overflow-y-auto">
                                    {isLoadingCoupons ? (
                                        <div className="flex justify-center p-4">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                                        </div>
                                    ) : coupons.length > 0 ? (
                                        <div className="space-y-2">
                                            {coupons.map((coupon) => (
                                                <button
                                                    key={coupon.id}
                                                    onClick={() => handleApplyCoupon(coupon)}
                                                    className={`w-full p-3 rounded-lg border transition-all text-left ${selectedCoupon?.id === coupon.id
                                                        ? 'border-green-600 bg-green-50'
                                                        : 'border-gray-200 hover:border-green-300'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <Tag className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                                                <p className="font-semibold text-gray-900 text-sm truncate">{coupon.code}</p>
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {coupon.discount_type === 'percentage'
                                                                    ? `${coupon.discount_value}% off`
                                                                    : `₹${coupon.discount_value} off`
                                                                }
                                                            </p>
                                                            <p className="text-xs text-gray-400">Min: ₹{coupon.min_order_amount}</p>
                                                        </div>
                                                        {selectedCoupon?.id === coupon.id && (
                                                            <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-center text-sm text-gray-400 py-4">No coupons available</p>
                                    )}
                                </div>
                            )}

                            {/* Applied Coupon Info */}
                            {selectedCoupon && (
                                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-xs text-green-600 font-medium">Coupon Applied</p>
                                            <p className="text-sm font-semibold text-gray-900">{selectedCoupon.code}</p>
                                            <p className="text-xs text-green-600 mt-1">-₹{couponDiscount.toFixed(2)}</p>
                                        </div>
                                        <button
                                            onClick={handleRemoveCoupon}
                                            className="text-green-600 hover:text-green-700 text-xs font-medium"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Selected Address */}
                            <div className="p-3 bg-white rounded-xl border border-gray-200 mb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                                            <MapPin className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-gray-900 text-sm">{selectedAddress.name}</h4>
                                            <p className="text-xs text-gray-400">{selectedAddress.street}</p>
                                            <p className="text-xs text-green-600 font-medium mt-0.5">{selectedAddress.phone}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setCheckoutStep('address')}
                                        className="text-green-600 text-xs font-medium hover:underline"
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>

                            {/* Payment Mode */}
                            <div className="p-3 bg-white rounded-xl border border-gray-200 mb-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-xs text-gray-400">Payment Mode</p>
                                        <p className="font-semibold text-gray-900 text-sm">
                                            {paymentMethod === 'COD' ? 'Cash On Delivery' : 'Pay Online'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowPaymentOptions(!showPaymentOptions)}
                                        className="text-green-600 text-xs font-medium hover:underline"
                                    >
                                        Change
                                    </button>
                                </div>

                                {/* Payment Options */}
                                {showPaymentOptions && (
                                    <div className="space-y-2 pt-2 border-t border-gray-100">
                                        <button
                                            onClick={() => {
                                                setPaymentMethod('COD');
                                                setShowPaymentOptions(false);
                                            }}
                                            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${paymentMethod === 'COD'
                                                ? 'border-green-600 bg-green-50'
                                                : 'border-gray-200 hover:border-green-300'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${paymentMethod === 'COD' ? 'bg-green-600' : 'bg-gray-100'
                                                }`}>
                                                <Banknote className={`w-4 h-4 ${paymentMethod === 'COD' ? 'text-white' : 'text-gray-500'}`} />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="font-semibold text-gray-900 text-sm">Cash On Delivery</p>
                                                <p className="text-xs text-gray-400">Pay when you receive your order</p>
                                            </div>
                                            {paymentMethod === 'COD' && (
                                                <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => {
                                                setPaymentMethod('ONLINE');
                                                setShowPaymentOptions(false);
                                            }}
                                            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${paymentMethod === 'ONLINE'
                                                ? 'border-green-600 bg-green-50'
                                                : 'border-gray-200 hover:border-green-300'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${paymentMethod === 'ONLINE' ? 'bg-green-600' : 'bg-gray-100'
                                                }`}>
                                                <CreditCard className={`w-4 h-4 ${paymentMethod === 'ONLINE' ? 'text-white' : 'text-gray-500'}`} />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p className="font-semibold text-gray-900 text-sm">Pay Online</p>
                                                <p className="text-xs text-gray-400">UPI, Cards, Wallets, Net Banking</p>
                                            </div>
                                            {paymentMethod === 'ONLINE' && (
                                                <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4">
                            <button
                                onClick={handlePlaceOrder}
                                disabled={isPlacingOrder}
                                className="w-full bg-green-600 text-white font-semibold py-4 rounded-xl hover:bg-green-700 transition-all active:scale-[0.99] text-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isPlacingOrder ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        {paymentMethod === 'ONLINE' && <CreditCard className="w-4 h-4" />}
                                        {paymentMethod === 'ONLINE'
                                            ? `Pay ₹${finalTotal.toFixed(2)}`
                                            : `Place Order ₹${finalTotal.toFixed(2)}`}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                <OrderSuccessModal
                    isOpen={showSuccessModal}
                    onClose={() => {
                        setShowSuccessModal(false);
                        handleClose();
                    }}
                    onTrackOrder={handleTrackOrder}
                    onBackToProducts={handleBackToProducts}
                    savedAmount={couponDiscount > 0 ? couponDiscount : 30}
                />
            </>
        );
    }

    // Default Cart View
    return (
        <>
            <div className="fixed inset-0 z-50 overflow-hidden">
                <div className="absolute inset-0 bg-black/30 transition-opacity" onClick={handleClose} />
                <div className="absolute inset-y-0 right-0 w-[400px] flex flex-col bg-white shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4">
                        <h2 className="text-base font-bold text-gray-900">My Cart</h2>
                        <button onClick={handleClose} className="text-green-600 hover:text-green-700 transition-colors">
                            <X className="w-5 h-5" strokeWidth={2} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-hide">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <Receipt className="w-8 h-8 text-gray-300" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Your cart is empty</h3>
                                <p className="text-sm text-gray-400 mb-6 max-w-[200px]">Looks like you haven't added anything to your cart yet</p>
                                <button onClick={handleClose} className="text-green-600 font-semibold hover:underline">
                                    Start Shopping
                                </button>
                            </div>
                        ) : (
                            <div className="px-4">
                                {/* Stock Warning Banner */}
                                {hasStockIssues && (
                                    <StockWarningBanner
                                        issues={stockIssues}
                                        onAdjustCart={handleAdjustCart}
                                        onDismiss={clearStockIssues}
                                        isAdjusting={isAdjustingCart}
                                    />
                                )}

                                {/* Your Items Label */}
                                <p className="text-xs text-gray-500 mb-3">Your Items</p>

                                {/* Items List */}
                                <div className="space-y-3 mb-4">
                                    {items.map((item) => {
                                        const stockIssue = stockIssues.find(issue => issue.itemId === item.id);
                                        const hasIssue = !!stockIssue;
                                        const isOutOfStock = stockIssue?.type === 'out_of_stock';

                                        return (
                                            <div
                                                key={item.id}
                                                className={`flex items-center gap-3 p-3 bg-white rounded-xl border transition-colors ${hasIssue
                                                    ? isOutOfStock
                                                        ? 'border-red-300 bg-red-50/50'
                                                        : 'border-amber-300 bg-amber-50/50'
                                                    : 'border-gray-200'
                                                    }`}
                                            >
                                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0 relative">
                                                    <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                                                    {isOutOfStock && (
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                            <span className="text-white text-[8px] font-bold">OUT</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-gray-900 text-sm">{item.product.name}</h4>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <p className="text-xs text-gray-400">{item.product.volume}</p>
                                                        {item.subscription_type && item.subscription_type !== 'one-time' && (
                                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${item.subscription_type === 'weekly'
                                                                ? 'bg-purple-100 text-purple-700'
                                                                : 'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                {item.subscription_type === 'weekly' ? '🔄 Weekly' : '📅 Monthly'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-bold text-green-600">₹{item.product.price}</p>
                                                    {/* Stock warning badge */}
                                                    {stockIssue && <StockWarningItemBadge issue={stockIssue} />}
                                                </div>
                                                <div className={`flex items-center rounded-lg overflow-hidden flex-shrink-0 ${isOutOfStock ? 'bg-gray-400' : 'bg-green-600'
                                                    }`}>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                        className={`w-7 h-7 flex items-center justify-center text-white transition-colors ${isOutOfStock ? 'hover:bg-gray-500' : 'hover:bg-green-700'
                                                            }`}
                                                        disabled={isOutOfStock}
                                                    >
                                                        <Minus className="w-3 h-3" strokeWidth={2.5} />
                                                    </button>
                                                    <span className="w-5 text-center text-white font-bold text-sm">{item.quantity}</span>
                                                    <button
                                                        onClick={async () => {
                                                            const result = await updateQuantity(item.id, item.quantity + 1);
                                                            if (!result.success && result.error) {
                                                                toast.error(result.error);
                                                            }
                                                        }}
                                                        className={`w-7 h-7 flex items-center justify-center text-white transition-colors ${isOutOfStock || item.quantity >= item.product.stock
                                                            ? 'opacity-50 cursor-not-allowed'
                                                            : 'hover:bg-green-700'
                                                            }`}
                                                        disabled={isOutOfStock || item.quantity >= item.product.stock}
                                                    >
                                                        <Plus className="w-3 h-3" strokeWidth={2.5} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Bill Summary */}
                                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
                                            <Receipt className="w-3.5 h-3.5 text-gray-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-900 text-sm">Bill Summary</h3>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Items Total</span>
                                            <span className="text-gray-900">₹{total}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Delivery Fee</span>
                                            <span className={deliveryFee === 0 ? "text-green-600 font-medium" : "text-gray-900"}>{deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Handling Fee</span>
                                            <span className={handlingFee === 0 ? "text-green-600 font-medium" : "text-gray-900"}>{handlingFee === 0 ? "Free" : `₹${handlingFee}`}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">GST Charges (18%)</span>
                                            <span className={gst === 0 ? "text-green-600 font-medium" : "text-gray-900"}>{gst === 0 ? "Free" : `₹${gst.toFixed(2)}`}</span>
                                        </div>
                                        {couponDiscount > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500">Coupon Discount</span>
                                                <span className="text-green-600 font-medium">-₹{couponDiscount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {tip > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500">Delivery Tip</span>
                                                <span className="text-gray-900">₹{tip}</span>
                                            </div>
                                        )}
                                        <div className="pt-2 mt-1 border-t border-gray-100 flex justify-between items-center">
                                            <span className="font-bold text-gray-900">Total Amount</span>
                                            <span className="font-bold text-gray-900">₹{finalTotal.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Delivery Address (Only shown if selected) */}
                                {selectedAddress && (
                                    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3 cursor-pointer hover:border-green-600 transition-colors" onClick={() => setCheckoutStep('address')}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                                                    <MapPin className="w-5 h-5 text-green-600" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-gray-900 text-sm">{selectedAddress.name}</h4>
                                                    <p className="text-xs text-gray-400 truncate max-w-[200px]">{selectedAddress.street}</p>
                                                    <p className="text-xs text-green-600 font-medium mt-0.5">{selectedAddress.phone}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCheckoutStep('address');
                                                }}
                                                className="text-green-600 text-xs font-medium hover:underline"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Payment Mode */}
                                <div className="p-3 bg-white rounded-xl border border-gray-200 mb-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="text-xs text-gray-400">Payment Mode</p>
                                            <p className="font-semibold text-gray-900 text-sm">
                                                {paymentMethod === 'COD' ? 'Cash On Delivery' : 'Pay Online'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowPaymentOptions(!showPaymentOptions)}
                                            className="text-green-600 text-xs font-medium hover:underline"
                                        >
                                            Change
                                        </button>
                                    </div>

                                    {/* Payment Options */}
                                    {showPaymentOptions && (
                                        <div className="space-y-2 pt-2 border-t border-gray-100">
                                            <button
                                                onClick={() => {
                                                    setPaymentMethod('COD');
                                                    setShowPaymentOptions(false);
                                                }}
                                                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${paymentMethod === 'COD'
                                                    ? 'border-green-600 bg-green-50'
                                                    : 'border-gray-200 hover:border-green-300'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${paymentMethod === 'COD' ? 'bg-green-600' : 'bg-gray-100'
                                                    }`}>
                                                    <Banknote className={`w-4 h-4 ${paymentMethod === 'COD' ? 'text-white' : 'text-gray-500'}`} />
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <p className="font-semibold text-gray-900 text-sm">Cash On Delivery</p>
                                                    <p className="text-xs text-gray-400">Pay when you receive your order</p>
                                                </div>
                                                {paymentMethod === 'COD' && (
                                                    <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setPaymentMethod('ONLINE');
                                                    setShowPaymentOptions(false);
                                                }}
                                                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${paymentMethod === 'ONLINE'
                                                    ? 'border-green-600 bg-green-50'
                                                    : 'border-gray-200 hover:border-green-300'
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${paymentMethod === 'ONLINE' ? 'bg-green-600' : 'bg-gray-100'
                                                    }`}>
                                                    <CreditCard className={`w-4 h-4 ${paymentMethod === 'ONLINE' ? 'text-white' : 'text-gray-500'}`} />
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <p className="font-semibold text-gray-900 text-sm">Pay Online</p>
                                                    <p className="text-xs text-gray-400">UPI, Cards, Wallets, Net Banking</p>
                                                </div>
                                                {paymentMethod === 'ONLINE' && (
                                                    <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center">
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {items.length > 0 && (
                        <div className="p-4">
                            {hasStockIssues && (
                                <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50 rounded-lg">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                    <p className="text-xs text-amber-700">
                                        Resolve stock issues to proceed
                                    </p>
                                </div>
                            )}
                            <button
                                onClick={handleProceedToCheckout}
                                disabled={hasStockIssues}
                                className={`w-full font-semibold py-4 rounded-xl transition-all active:scale-[0.99] text-sm ${hasStockIssues
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                            >
                                {hasStockIssues
                                    ? 'Fix Stock Issues to Continue'
                                    : selectedAddress
                                        ? 'Proceed to Checkout'
                                        : 'Select Delivery Address'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <AddressModal
                isOpen={showAddressModal}
                onClose={() => setShowAddressModal(false)}
                onSave={handleSaveAddress}
            />
            <OrderSuccessModal
                isOpen={showSuccessModal}
                onClose={() => {
                    setShowSuccessModal(false);
                    handleClose();
                }}
                onTrackOrder={handleTrackOrder}
                onBackToProducts={handleBackToProducts}
                savedAmount={couponDiscount > 0 ? couponDiscount : 30}
            />
        </>
    );
}
