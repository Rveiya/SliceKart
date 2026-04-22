import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';
import './../styles/CheckoutPage.css';

// NOTE: Coupon selection has been moved entirely into the CartDrawer,
// which is where the actual checkout and payment happens. The old
// CouponInput on this page was disconnected — it had its own local
// state that was never passed to the backend when placing the order.

export default function CheckoutPage() {
    const { items, total: subtotal, openCart } = useCart();

    const deliveryFee = subtotal >= 199 ? 0 : 10;
    const handlingFee = subtotal >= 199 ? 0 : 10;
    const gst = subtotal >= 199 ? 0 : Math.round(subtotal * 0.18 * 100) / 100;
    const estimatedTotal = subtotal + deliveryFee + handlingFee + gst;

    const handleProceedToCart = () => {
        if (items.length === 0) {
            toast.error('Your cart is empty.');
            return;
        }
        openCart();
    };

    return (
        <div className="checkout-page">
            <div className="container">
                <h1>Checkout</h1>
                <div className="checkout-layout">
                    <div className="cart-summary">
                        <h2>Your Order</h2>
                        {items.length === 0 ? (
                            <p className="empty-cart-msg">Your cart is empty.</p>
                        ) : (
                            items.map(item => (
                                <div key={item.id} className="cart-item">
                                    <img src={item.product.image_url} alt={item.product.name} />
                                    <div className="item-details">
                                        <p>{item.product.name}</p>
                                        <p>Qty: {item.quantity}</p>
                                    </div>
                                    <p>₹{(item.product.price * item.quantity).toFixed(2)}</p>
                                </div>
                            ))
                        )}

                        <div className="summary-totals">
                            <div className="summary-row">
                                <span>Subtotal</span>
                                <span>₹{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="summary-row">
                                <span>Delivery Fee</span>
                                <span>{deliveryFee === 0 ? 'Free' : `₹${deliveryFee}`}</span>
                            </div>
                            <div className="summary-row">
                                <span>Handling Fee</span>
                                <span>{handlingFee === 0 ? 'Free' : `₹${handlingFee}`}</span>
                            </div>
                            <div className="summary-row">
                                <span>GST (18%)</span>
                                <span>{gst === 0 ? 'Free' : `₹${gst.toFixed(2)}`}</span>
                            </div>
                            <div className="summary-row total">
                                <span>Estimated Total</span>
                                <span>₹{estimatedTotal.toFixed(2)}</span>
                            </div>
                            <p className="coupon-hint">
                                🎟️ Have a coupon? Apply it in the next step after opening the cart.
                            </p>
                        </div>
                    </div>

                    <div className="checkout-actions">
                        <button
                            className="place-order-btn"
                            onClick={handleProceedToCart}
                            disabled={items.length === 0}
                        >
                            Proceed to Payment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
