import { Mail, Phone, MessageCircle } from 'lucide-react';

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-warm-cream">
            <div className="max-w-screen-2xl mx-auto px-10 sm:px-14 lg:px-20 py-12 sm:py-16">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5">
                        Get in Touch
                    </h1>
                    <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                        Have questions about our Fruits or need help with your order? We're here to help!
                    </p>
                </div>

                <div className="grid lg:grid-cols-1 gap-10 lg:gap-16">
                    {/* Contact Form */}
                    {/* <div className="bg-white rounded-3xl shadow-lg p-8 sm:p-10">
                        <h2 className="text-2xl font-bold text-gray-900 mb-8">Send us a Message</h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="name" className="block text-base font-medium text-gray-700 mb-2">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 text-base focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
                                    placeholder="Enter your name"
                                />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-base font-medium text-gray-700 mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 text-base focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
                                    placeholder="Enter your email"
                                />
                            </div>
                            <div>
                                <label htmlFor="phone" className="block text-base font-medium text-gray-700 mb-2">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 text-base focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all"
                                    placeholder="Enter your phone number"
                                />
                            </div>
                            <div>
                                <label htmlFor="message" className="block text-base font-medium text-gray-700 mb-2">
                                    Message
                                </label>
                                <textarea
                                    id="message"
                                    name="message"
                                    value={formData.message}
                                    onChange={handleChange}
                                    required
                                    rows={5}
                                    className="w-full px-5 py-4 rounded-xl border-2 border-gray-200 text-base focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none transition-all resize-none"
                                    placeholder="How can we help you?"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-semibold flex items-center justify-center gap-3 hover:bg-green-700 transition-all shadow-lg hover:shadow-xl"
                            >
                                <Send className="w-5 h-5" />
                                Send Message
                            </button>
                        </form>
                    </div> */}

                    {/* Contact Info */}
                    <div className="space-y-6">
                        {/* Contact Cards */}
                        <div className="grid gap-5">
                            <div className="bg-white rounded-2xl p-6 shadow-md">
                                <div className="flex items-start gap-5">
                                    <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Mail className="w-7 h-7 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg mb-2">Email Us</h3>
                                        <a href="mailto:support@slicekart.online" className="text-green-600 text-base font-medium hover:underline">
                                            support@slicekart.online
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl p-6 shadow-md">
                                <div className="flex items-start gap-5">
                                    <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Phone className="w-7 h-7 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg mb-2">Call Us</h3>
                                        <a href="tel:+919742608767" className="text-green-600 text-base font-medium hover:underline">
                                            +91 97426 08767
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* FAQ Banner */}
                        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-8 text-white shadow-xl">
                            <div className="flex items-start gap-5">
                                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <MessageCircle className="w-7 h-7" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-3">Need Quick Answers?</h3>
                                    <p className="text-white/90 text-base mb-5 leading-relaxed">
                                        Check out our FAQ section for instant answers to common questions.
                                    </p>
                                    <button className="bg-white text-green-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-all shadow-md">
                                        View FAQ
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
