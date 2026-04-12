import { useState, useRef, useCallback } from 'react';
import { uploadImages, validateFiles, deleteImage } from '../../services/upload';

interface ImageUploadProps {
    /** Current images (R2 keys) */
    images: string[];
    /** Current signed URLs for display */
    imageUrls: (string | null)[];
    /** Callback when images change */
    onChange: (images: string[], urls: (string | null)[]) => void;
    /** Maximum number of images allowed */
    maxImages?: number;
    /** Whether the component is disabled */
    disabled?: boolean;
    /** Custom class name */
    className?: string;
}

export default function ImageUpload({
    images,
    imageUrls,
    onChange,
    maxImages = 10,
    disabled = false,
    className = ''
}: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback(async (files: File[]) => {
        if (disabled || uploading) return;

        // Check if adding more images would exceed the limit
        const remainingSlots = maxImages - images.length;
        if (remainingSlots <= 0) {
            setErrors([`Maximum ${maxImages} images allowed`]);
            return;
        }

        // Limit files to remaining slots
        const filesToUpload = files.slice(0, remainingSlots);

        // Validate files
        const { validFiles, errors: validationErrors } = validateFiles(filesToUpload);

        if (validationErrors.length > 0) {
            setErrors(validationErrors);
        }

        if (validFiles.length === 0) {
            return;
        }

        setUploading(true);
        setProgress(0);
        setErrors([]);

        try {
            const response = await uploadImages(validFiles, setProgress);

            if (response.success && response.images) {
                // Add new images to the list
                const newKeys = response.images.map(img => img.key);
                const newUrls = response.images.map(img => img.url);

                onChange([...images, ...newKeys], [...imageUrls, ...newUrls]);

                if (response.errors && response.errors.length > 0) {
                    setErrors(response.errors);
                }
            } else {
                setErrors(response.errors || ['Failed to upload images']);
            }
        } catch (error) {
            console.error('Upload error:', error);
            setErrors(['Failed to upload images. Please try again.']);
        } finally {
            setUploading(false);
            setProgress(0);
        }
    }, [disabled, uploading, images, imageUrls, maxImages, onChange]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            handleFiles(Array.from(files));
        }
        // Reset input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFiles(Array.from(files));
        }
    }, [handleFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && !uploading) {
            setDragOver(true);
        }
    }, [disabled, uploading]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    }, []);

    const removeImage = async (index: number) => {
        if (disabled || uploading) return;

        const imageKey = images[index];

        // Optimistically remove from UI
        const newImages = images.filter((_, i) => i !== index);
        const newUrls = imageUrls.filter((_, i) => i !== index);
        onChange(newImages, newUrls);

        // Try to delete from R2 (don't block UI)
        try {
            await deleteImage(imageKey);
        } catch (error) {
            console.error('Failed to delete image from R2:', error);
            // Image is already removed from UI, don't add it back
        }
    };

    const setAsPrimary = (index: number) => {
        if (disabled || uploading || index === 0) return;

        // Move the image at index to the front
        const newImages = [...images];
        const newUrls = [...imageUrls];

        const [movedImage] = newImages.splice(index, 1);
        const [movedUrl] = newUrls.splice(index, 1);

        newImages.unshift(movedImage);
        newUrls.unshift(movedUrl);

        onChange(newImages, newUrls);
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Dropzone */}
            <div
                onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`
                    relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                    ${disabled || uploading
                        ? 'border-slate-700 bg-slate-800/30 cursor-not-allowed'
                        : dragOver
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-slate-600 hover:border-emerald-500/50 hover:bg-slate-800/50'
                    }
                `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={disabled || uploading}
                />

                {uploading ? (
                    <div className="space-y-3">
                        <div className="w-12 h-12 mx-auto border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                        <p className="text-slate-300">Uploading... {progress}%</p>
                        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-700/50 flex items-center justify-center">
                            <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <p className="text-slate-300 font-medium">
                            {dragOver ? 'Drop images here' : 'Click or drag images to upload'}
                        </p>
                        <p className="text-slate-500 text-sm mt-1">
                            JPEG, PNG, WebP, GIF • Max 10MB each • {images.length}/{maxImages} images
                        </p>
                    </>
                )}
            </div>

            {/* Error Messages */}
            {errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="space-y-1">
                            {errors.map((error, index) => (
                                <p key={index} className="text-red-400 text-sm">{error}</p>
                            ))}
                        </div>
                        <button
                            onClick={() => setErrors([])}
                            className="ml-auto text-red-400 hover:text-red-300"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Image Gallery */}
            {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {images.map((imageKey, index) => (
                        <div
                            key={imageKey}
                            className={`
                                relative group aspect-square rounded-xl overflow-hidden border-2 transition-all
                                ${index === 0 ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-700'}
                            `}
                        >
                            {/* Image */}
                            {imageUrls[index] ? (
                                <img
                                    src={imageUrls[index] || ''}
                                    alt={`Product image ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-slate-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}

                            {/* Primary Badge */}
                            {index === 0 && (
                                <div className="absolute top-2 left-2 px-2 py-1 bg-emerald-500 text-white text-xs font-medium rounded-lg">
                                    Primary
                                </div>
                            )}

                            {/* Overlay with actions */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                {index !== 0 && (
                                    <button
                                        onClick={() => setAsPrimary(index)}
                                        disabled={disabled || uploading}
                                        className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                                        title="Set as primary image"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                        </svg>
                                    </button>
                                )}
                                <button
                                    onClick={() => removeImage(index)}
                                    disabled={disabled || uploading}
                                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                                    title="Remove image"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Help Text */}
            <p className="text-slate-500 text-xs">
                💡 The first image will be used as the main product image. Drag and drop to reorder or click "Set as primary" to change.
            </p>
        </div>
    );
}
