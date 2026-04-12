import { X, MapPin, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Address } from '../types';
import { CreateAddressData } from '../services/addresses';

interface AddressModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: CreateAddressData) => Promise<void>;
    editAddress?: Address | null;
}

export default function AddressModal({ isOpen, onClose, onSave, editAddress }: AddressModalProps) {
    const [addressType, setAddressType] = useState<'Home' | 'Work' | 'Other'>('Home');
    const [flatNo, setFlatNo] = useState('');
    const [buildingName, setBuildingName] = useState('');
    const [area, setArea] = useState('');
    const [pinCode, setPinCode] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [locationError, setLocationError] = useState('');
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Reset form when modal opens/closes or editAddress changes
    useEffect(() => {
        if (isOpen) {
            // If editing, populate with existing data
            if (editAddress) {
                setAddressType(editAddress.address_type || 'Home');
                setFlatNo(editAddress.flat_no || '');
                setBuildingName(editAddress.building_name || '');
                setArea(editAddress.area || '');
                setPinCode(editAddress.pincode || '');
                setCity(editAddress.city || '');
                setState(editAddress.state || '');
                setName(editAddress.name || '');
                setPhone(editAddress.phone || '');
            } else {
                // Reset all fields for new address
                resetForm();
            }
        }
    }, [isOpen, editAddress]);

    const resetForm = () => {
        setAddressType('Home');
        setFlatNo('');
        setBuildingName('');
        setArea('');
        setPinCode('');
        setCity('');
        setState('');
        setName('');
        setPhone('');
        setLocationError('');
        setValidationErrors({});
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!isOpen) return null;


    const validateForm = () => {
        const errors: Record<string, string> = {};

        if (!flatNo.trim()) errors.flatNo = 'Flat No/House No is required';
        if (!buildingName.trim()) errors.buildingName = 'Building Name is required';
        if (!area.trim()) errors.area = 'Area/Street is required';
        if (!pinCode.trim()) errors.pinCode = 'Pin Code is required';
        if (!city.trim()) errors.city = 'City is required';
        if (!state.trim()) errors.state = 'State is required';
        if (!name.trim()) errors.name = 'Name is required';
        if (!phone.trim()) errors.phone = 'Mobile Number is required';

        // Validate phone number format (international support: 7-15 digits, optional +)
        if (phone.trim() && !/^\+?[\d\s-]{7,15}$/.test(phone.trim())) {
            errors.phone = 'Enter a valid mobile number';
        }

        // Validate pincode format (international support: 4-10 alphanumeric)
        if (pinCode.trim() && !/^[a-zA-Z0-9\s-]{4,10}$/.test(pinCode.trim())) {
            errors.pinCode = 'Enter a valid pin/zip code';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Clear error when user starts typing in a field
    const clearFieldError = (field: string) => {
        if (validationErrors[field]) {
            setValidationErrors(prev => {
                const updated = { ...prev };
                delete updated[field];
                return updated;
            });
        }
    };

    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        try {
            const addressData: CreateAddressData = {
                name: name.trim(),
                flat_no: flatNo.trim(),
                building_name: buildingName.trim(),
                area: area.trim(),
                street: `${flatNo.trim()}, ${buildingName.trim()}, ${area.trim()}`,
                city: city.trim(),
                state: state.trim(),
                pincode: pinCode.trim(),
                phone: phone.trim(),
                address_type: addressType,
                is_default: false
            };
            await onSave(addressData);
            onClose();
        } catch (error) {
            console.error('Failed to save address:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUseCurrentLocation = async () => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser');
            return;
        }

        setIsLocating(true);
        setLocationError('');

        // Use watchPosition to get the most accurate reading
        let bestPosition: GeolocationPosition | null = null;
        let watchId: number;
        let hasFinalized = false;

        const processPosition = (position: GeolocationPosition) => {
            // Keep the reading with the best accuracy (lower is better)
            if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
                bestPosition = position;
            }
        };

        const finalizeLocation = async () => {
            if (hasFinalized) return;
            hasFinalized = true;
            navigator.geolocation.clearWatch(watchId);

            if (!bestPosition) {
                setLocationError('Could not get your location. Please enter address manually.');
                setIsLocating(false);
                return;
            }

            const { latitude, longitude, accuracy } = bestPosition.coords;

            // If accuracy is too poor (> 1km), don't use it
            if (accuracy > 1000) {
                setLocationError(
                    `Location accuracy is too low (~${Math.round(accuracy / 1000)}km). ` +
                    'Desktop browsers have limited GPS. For better accuracy, try using a mobile device or enter your address manually.'
                );
                setIsLocating(false);
                return;
            }

            try {
                // Use OpenStreetMap Nominatim with highest zoom for precise address
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=19`,
                    {
                        headers: {
                            'Accept-Language': 'en'
                        }
                    }
                );

                if (!response.ok) throw new Error('Failed to get address');

                const data = await response.json();
                const address = data.address;

                // Extract and fill address fields with more options
                const detectedArea = address.road ||
                    address.neighbourhood ||
                    address.suburb ||
                    address.village ||
                    address.hamlet ||
                    '';

                const detectedBuildingName = address.building ||
                    address.amenity ||
                    address.house_name ||
                    address.shop ||
                    '';

                const detectedHouseNo = address.house_number || '';

                const detectedCity = address.city ||
                    address.town ||
                    address.municipality ||
                    address.state_district ||
                    '';

                const detectedState = address.state || '';

                const detectedPinCode = address.postcode || '';

                // Fill all the fields
                if (detectedHouseNo) setFlatNo(detectedHouseNo);
                if (detectedBuildingName) setBuildingName(detectedBuildingName);
                if (detectedArea) setArea(detectedArea);
                if (detectedPinCode) setPinCode(detectedPinCode);
                if (detectedCity) setCity(detectedCity);
                if (detectedState) setState(detectedState);

                // Clear any previous validation errors for filled fields
                setValidationErrors(prev => {
                    const updated = { ...prev };
                    if (detectedHouseNo) delete updated.flatNo;
                    if (detectedBuildingName) delete updated.buildingName;
                    if (detectedArea) delete updated.area;
                    if (detectedPinCode) delete updated.pinCode;
                    if (detectedCity) delete updated.city;
                    if (detectedState) delete updated.state;
                    return updated;
                });

                // Show accuracy info
                if (accuracy > 100) {
                    setLocationError(`Location detected (accuracy: ~${Math.round(accuracy)}m). Please verify the address.`);
                } else if (accuracy > 50) {
                    setLocationError(`Location detected (accuracy: ~${Math.round(accuracy)}m). Address may need minor adjustments.`);
                } else {
                    setLocationError('');
                }
            } catch (error) {
                console.error('Reverse geocoding error:', error);
                setLocationError('Failed to get address details. Please enter manually.');
            }
            setIsLocating(false);
        };

        // Start watching position
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                processPosition(position);

                // If we get a very accurate reading (< 30m), use it immediately
                if (position.coords.accuracy < 30) {
                    finalizeLocation();
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                if (!hasFinalized) {
                    hasFinalized = true;
                    navigator.geolocation.clearWatch(watchId);

                    let errorMessage = 'Failed to get your location. ';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += 'Please allow location access in your browser settings.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += 'Location unavailable. Desktop browsers have limited GPS - try a mobile device.';
                            break;
                        case error.TIMEOUT:
                            errorMessage += 'Location request timed out. Please try again or enter manually.';
                            break;
                        default:
                            errorMessage += 'Please enter your address manually.';
                    }
                    setLocationError(errorMessage);
                    setIsLocating(false);
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 0
            }
        );

        // After 8 seconds, use the best position we have (or show error)
        setTimeout(() => {
            if (!hasFinalized) {
                finalizeLocation();
            }
        }, 8000);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">Enter Complete Address</h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Use Current Location Button */}
                    <div>
                        <button
                            onClick={handleUseCurrentLocation}
                            disabled={isLocating}
                            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-medium py-3.5 rounded-xl hover:bg-green-700 transition-colors text-base disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLocating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Detecting location...
                                </>
                            ) : (
                                <>
                                    <MapPin className="w-5 h-5" />
                                    Use my current location
                                </>
                            )}
                        </button>
                        {locationError && (
                            <p className="mt-2 text-sm text-red-500">{locationError}</p>
                        )}
                    </div>

                    {/* Save Address As */}
                    <div>
                        <p className="text-sm text-gray-500 mb-3">Save Address as</p>
                        <div className="flex gap-3">
                            {(['Home', 'Work', 'Other'] as const).map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setAddressType(type)}
                                    className={`px-5 py-2.5 rounded-lg border text-sm font-medium transition-all ${addressType === type
                                        ? 'border-green-600 text-green-600 bg-green-50'
                                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Address Fields - Full Width Layout */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Flat No/House No <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Enter Flat No/House No"
                                value={flatNo}
                                onChange={(e) => { setFlatNo(e.target.value); clearFieldError('flatNo'); }}
                                className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 transition-all ${validationErrors.flatNo
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                    : 'border-gray-300 focus:border-green-600 focus:ring-green-100'
                                    }`}
                            />
                            {validationErrors.flatNo && (
                                <p className="mt-1 text-sm text-red-500">{validationErrors.flatNo}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Building Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Enter Building Name"
                                value={buildingName}
                                onChange={(e) => { setBuildingName(e.target.value); clearFieldError('buildingName'); }}
                                className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 transition-all ${validationErrors.buildingName
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                    : 'border-gray-300 focus:border-green-600 focus:ring-green-100'
                                    }`}
                            />
                            {validationErrors.buildingName && (
                                <p className="mt-1 text-sm text-red-500">{validationErrors.buildingName}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Area/Street <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Enter Area/Street Name"
                                value={area}
                                onChange={(e) => { setArea(e.target.value); clearFieldError('area'); }}
                                className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 transition-all ${validationErrors.area
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                    : 'border-gray-300 focus:border-green-600 focus:ring-green-100'
                                    }`}
                            />
                            {validationErrors.area && (
                                <p className="mt-1 text-sm text-red-500">{validationErrors.area}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Pin Code <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Enter Pin Code"
                                value={pinCode}
                                onChange={(e) => { setPinCode(e.target.value); clearFieldError('pinCode'); }}
                                maxLength={10}
                                className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 transition-all ${validationErrors.pinCode
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                    : 'border-gray-300 focus:border-green-600 focus:ring-green-100'
                                    }`}
                            />
                            {validationErrors.pinCode && (
                                <p className="mt-1 text-sm text-red-500">{validationErrors.pinCode}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                City <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Enter City"
                                value={city}
                                onChange={(e) => { setCity(e.target.value); clearFieldError('city'); }}
                                className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 transition-all ${validationErrors.city
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                    : 'border-gray-300 focus:border-green-600 focus:ring-green-100'
                                    }`}
                            />
                            {validationErrors.city && (
                                <p className="mt-1 text-sm text-red-500">{validationErrors.city}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                State <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Enter State"
                                value={state}
                                onChange={(e) => { setState(e.target.value); clearFieldError('state'); }}
                                className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 transition-all ${validationErrors.state
                                    ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                    : 'border-gray-300 focus:border-green-600 focus:ring-green-100'
                                    }`}
                            />
                            {validationErrors.state && (
                                <p className="mt-1 text-sm text-red-500">{validationErrors.state}</p>
                            )}
                        </div>
                    </div>

                    {/* Personal Information */}
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg mb-4">Personal Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter Name"
                                    value={name}
                                    onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
                                    className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 transition-all ${validationErrors.name
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                        : 'border-gray-300 focus:border-green-600 focus:ring-green-100'
                                        }`}
                                />
                                {validationErrors.name && (
                                    <p className="mt-1 text-sm text-red-500">{validationErrors.name}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Mobile Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    placeholder="Enter Mobile Number"
                                    value={phone}
                                    onChange={(e) => { setPhone(e.target.value); clearFieldError('phone'); }}
                                    maxLength={20}
                                    className={`w-full px-4 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 transition-all ${validationErrors.phone
                                        ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
                                        : 'border-gray-300 focus:border-green-600 focus:ring-green-100'
                                        }`}
                                />
                                {validationErrors.phone && (
                                    <p className="mt-1 text-sm text-red-500">{validationErrors.phone}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition-all active:scale-[0.99] text-lg shadow-lg shadow-green-600/30 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Saving...' : 'Save Address'}
                    </button>
                </div>
            </div>
        </div>
    );
}
