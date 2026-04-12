import { useState } from 'react';
import { useCart } from '../context/CartContext';
import CouponInput from '../components/checkout/CouponInput';
import toast from 'react-hot-toast';
import './../styles/CheckoutPage.css';

export default function CheckoutPage() {
    const { items, total: subtotal, openCart } = useCart();
    const [discount, setDiscount] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const handleCouponApplied = (_code: string, discountAmount: number) => {
        setDiscount(discountAmount);
    };

    const handleCouponRemoved = () => {
        setDiscount(0);
    };

    const total = subtotal - discount;

    const handlePlaceOrder = async () => {
        if (items.length === 0) {
            toast.error('Your cart is empty.');
            return;
        }

        setIsLoading(true);
        openCart();
        toast('Complete checkout from the cart drawer.');
        setIsLoading(false);
    };

    return (
        <div className="checkout-page">
            <div className="container">
                <h1>Checkout</h1>
                <div className="checkout-layout">
                    <div className="cart-summary">
                        <h2>Your Order</h2>
                        {items.map(item => (
                            <div key={item.id} className="cart-item">
                                <img src={item.product.image_url} alt={item.product.name} />
                                <div className="item-details">
                                    <p>{item.product.name}</p>
                                    <p>Qty: {item.quantity}</p>
                                </div>
                                <p>₹{(item.product.price * item.quantity).toFixed(2)}</p>
                            </div>
                        ))}
                        <div className="summary-totals">
                            <div className="summary-row">
                                <span>Subtotal</span>
                                <span>₹{subtotal.toFixed(2)}</span>
                            </div>
                            {discount > 0 && (
                                <div className="summary-row discount">
                                    <span>Discount</span>
                                    <span>- ₹{discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="summary-row total">
                                <span>Total</span>
                                <span>₹{total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="checkout-actions">
                        <CouponInput
                            subtotal={subtotal}
                            onCouponApplied={handleCouponApplied}
                            onCouponRemoved={handleCouponRemoved}
                        />
                        <button
                            className="place-order-btn"
                            onClick={handlePlaceOrder}
                            disabled={isLoading || items.length === 0}
                        >
                            {isLoading ? 'Placing Order...' : 'Place Order'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
