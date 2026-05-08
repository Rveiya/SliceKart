import { useState } from 'react';
import { Check, Crown, Zap, Truck, Clock, Star, Sparkles, ChevronRight } from 'lucide-react';

interface Plan {
    id: string;
    name: string;
    duration: string;
    days: number;
    basePrice: number;
    gstPercent: number;
    gstAmount: number;
    totalPrice: number;
    perDayPrice: string;
    color: string;
    gradient: string;
    borderColor: string;
    icon: React.ReactNode;
    badge?: string;
    features: string[];
}

const plans: Plan[] = [
    {
        id: 'weekly',
        name: 'Starter',
        duration: '7 Days',
        days: 7,
        basePrice: 699,
        gstPercent: 18,
        gstAmount: Math.round(699 * 0.18),
        totalPrice: Math.round(699 * 1.18),
        perDayPrice: (Math.round(699 * 1.18) / 7).toFixed(0),
        color: 'emerald',
        gradient: 'from-emerald-500 to-teal-600',
        borderColor: 'border-emerald-200 hover:border-emerald-400',
        icon: <Zap className="w-6 h-6" />,
        features: [
            'Daily fresh fruit delivery',
            'Choose your preferred slot',
            'Pause anytime',
            'Free delivery',
        ],
    },
    {
        id: 'biweekly',
        name: 'Popular',
        duration: '15 Days',
        days: 15,
        basePrice: 1499,
        gstPercent: 18,
        gstAmount: Math.round(1499 * 0.18),
        totalPrice: Math.round(1499 * 1.18),
        perDayPrice: (Math.round(1499 * 1.18) / 15).toFixed(0),
        color: 'violet',
        gradient: 'from-violet-500 to-purple-600',
        borderColor: 'border-violet-200 hover:border-violet-400',
        icon: <Star className="w-6 h-6" />,
        badge: 'Most Popular',
        features: [
            'Daily fresh fruit delivery',
            'Choose your preferred slot',
            'Pause & resume anytime',
            'Free delivery',
            'Priority customer support',
        ],
    },
    {
        id: 'monthly',
        name: 'Premium',
        duration: '30 Days',
        days: 30,
        basePrice: 2999,
        gstPercent: 18,
        gstAmount: Math.round(2999 * 0.18),
        totalPrice: Math.round(2999 * 1.18),
        perDayPrice: (Math.round(2999 * 1.18) / 30).toFixed(0),
        color: 'amber',
        gradient: 'from-amber-500 to-orange-600',
        borderColor: 'border-amber-200 hover:border-amber-400',
        icon: <Crown className="w-6 h-6" />,
        badge: 'Best Value',
        features: [
            'Daily fresh fruit delivery',
            'Choose your preferred slot',
            'Pause & resume anytime',
            'Free delivery',
            'Priority customer support',
            'Exclusive member discounts',
        ],
    },
];

const benefits = [
    {
        icon: <Truck className="w-6 h-6 text-green-600" />,
        title: 'Free Delivery',
        description: 'Enjoy free doorstep delivery on all subscription plans',
    },
    {
        icon: <Clock className="w-6 h-6 text-blue-600" />,
        title: 'Flexible Schedule',
        description: 'Choose morning or evening delivery based on your routine',
    },
    {
        icon: <Sparkles className="w-6 h-6 text-amber-600" />,
        title: '100% Fresh',
        description: 'Handpicked, hygienically prepared fresh fruits daily',
    },
];

export default function OffersPage() {
    const [selectedPlan, setSelectedPlan] = useState<string>('biweekly');

    return (
        <div className="min-h-screen bg-warm-cream">
            <div className="max-w-screen-2xl mx-auto px-6 sm:px-14 lg:px-20 py-12 sm:py-16">
                {/* Header */}
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
                        <Sparkles className="w-4 h-4" />
                        Subscription Plans
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5">
                        Choose Your{' '}
                        <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                            Perfect Plan
                        </span>
                    </h1>
                    <p className="text-gray-500 max-w-2xl mx-auto text-lg leading-relaxed">
                        Get fresh, hygienically prepared fruits delivered to your doorstep every day.
                        Pick a plan that suits your lifestyle.
                    </p>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-20">
                    {plans.map((plan) => {
                        const isSelected = selectedPlan === plan.id;
                        return (
                            <div
                                key={plan.id}
                                onClick={() => setSelectedPlan(plan.id)}
                                className={`relative bg-white rounded-3xl border-2 p-7 cursor-pointer transition-all duration-300 ${isSelected
                                        ? `border-transparent ring-2 ring-offset-2 shadow-2xl scale-[1.02] ${plan.color === 'emerald'
                                            ? 'ring-emerald-500'
                                            : plan.color === 'violet'
                                                ? 'ring-violet-500'
                                                : 'ring-amber-500'
                                        }`
                                        : `${plan.borderColor} shadow-lg hover:shadow-xl`
                                    }`}
                            >
                                {/* Badge */}
                                {plan.badge && (
                                    <div
                                        className={`absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r ${plan.gradient} text-white text-xs font-bold px-5 py-1.5 rounded-full shadow-lg`}
                                    >
                                        {plan.badge}
                                    </div>
                                )}

                                {/* Header */}
                                <div className="mb-6 pt-2">
                                    <div
                                        className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.gradient} text-white mb-4 shadow-lg`}
                                    >
                                        {plan.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                                    <p className="text-sm text-gray-500 font-medium mt-1">{plan.duration} Plan</p>
                                </div>

                                {/* Price */}
                                <div className="mb-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-sm text-gray-500 font-medium">₹</span>
                                        <span className="text-4xl font-extrabold text-gray-900">
                                            {plan.basePrice.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        <p className="text-xs text-gray-400">
                                            + GST ({plan.gstPercent}%):{' '}
                                            <span className="font-semibold text-gray-500">
                                                ₹{plan.gstAmount.toLocaleString()}
                                            </span>
                                        </p>
                                        <p className="text-sm font-bold text-gray-700">
                                            Total: ₹{plan.totalPrice.toLocaleString()}
                                        </p>
                                        <p
                                            className={`text-xs font-semibold ${plan.color === 'emerald'
                                                    ? 'text-emerald-600'
                                                    : plan.color === 'violet'
                                                        ? 'text-violet-600'
                                                        : 'text-amber-600'
                                                }`}
                                        >
                                            ≈ ₹{plan.perDayPrice}/day
                                        </p>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-gray-100 mb-6" />

                                {/* Features */}
                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                            <div
                                                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${plan.color === 'emerald'
                                                        ? 'bg-emerald-100 text-emerald-600'
                                                        : plan.color === 'violet'
                                                            ? 'bg-violet-100 text-violet-600'
                                                            : 'bg-amber-100 text-amber-600'
                                                    }`}
                                            >
                                                <Check className="w-3 h-3" strokeWidth={3} />
                                            </div>
                                            <span className="text-sm text-gray-600">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA Button */}
                                <button
                                    className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${isSelected
                                            ? `bg-gradient-to-r ${plan.gradient} text-white shadow-lg hover:shadow-xl`
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {isSelected ? 'Subscribe Now' : 'Select Plan'}
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Benefits Section */}
                <div className="mb-16">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold text-gray-900 mb-3">Why Subscribe?</h2>
                        <p className="text-gray-500 max-w-xl mx-auto">
                            Every plan includes these amazing perks to make healthy eating effortless.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {benefits.map((benefit, idx) => (
                            <div
                                key={idx}
                                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
                                    {benefit.icon}
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1.5">{benefit.title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{benefit.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* GST Info */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200 text-center">
                    <p className="text-sm text-green-700">
                        <span className="font-semibold">Note:</span> All prices are exclusive of GST.
                        GST at 18% is applicable on all subscription plans as per government regulations.
                        The total amount inclusive of GST is shown in each plan.
                    </p>
                </div>
            </div>
        </div>
    );
}
