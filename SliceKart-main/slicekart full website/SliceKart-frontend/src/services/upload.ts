/**
 * Upload Service - Handles file uploads to Cloudflare R2
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface UploadedImage {
    key: string;
    url: string | null;
}

export interface UploadResponse {
    success: boolean;
    message: string;
    images?: UploadedImage[];
    image?: UploadedImage;
    errors?: string[];
}

export interface PresignedUrlResponse {
    success: boolean;
    url?: string;
    expiresIn?: number;
}

export interface MultiplePresignedUrlsResponse {
    success: boolean;
    images: { key: string; url: string | null }[];
    expiresIn: number;
}

/**
 * Upload multiple images to R2
 * @param files - Array of files to upload
 * @returns Upload response with image keys and URLs
 */
export const uploadImages = async (
    files: File[],
    onProgress?: (progress: number) => void
): Promise<UploadResponse> => {
    const formData = new FormData();

    files.forEach(file => {
        formData.append('images', file);
    });

    // Get access token from localStorage
    const accessToken = localStorage.getItem('accessToken');

    // For progress tracking, we use XMLHttpRequest
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
                const progress = Math.round((event.loaded * 100) / event.total);
                onProgress(progress);
            }
        });

        xhr.addEventListener('load', () => {
            try {
                const response: UploadResponse = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(response);
                } else {
                    reject(new Error(response.message || 'Upload failed'));
                }
            } catch {
                reject(new Error('Failed to parse response'));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload aborted'));
        });

        xhr.open('POST', `${BASE_URL}/upload/images`);
        if (accessToken) {
            xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        }
        xhr.send(formData);
    });
};

/**
 * Upload a single image to R2
 * @param file - File to upload
 * @param onProgress - Optional progress callback
 * @returns Upload response with image key and URL
 */
export const uploadImage = async (
    file: File,
    onProgress?: (progress: number) => void
): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('image', file);

    // Get access token from localStorage
    const accessToken = localStorage.getItem('accessToken');

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && onProgress) {
                const progress = Math.round((event.loaded * 100) / event.total);
                onProgress(progress);
            }
        });

        xhr.addEventListener('load', () => {
            try {
                const response: UploadResponse = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(response);
                } else {
                    reject(new Error(response.message || 'Upload failed'));
                }
            } catch {
                reject(new Error('Failed to parse response'));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload aborted'));
        });

        xhr.open('POST', `${BASE_URL}/upload/image`);
        if (accessToken) {
            xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        }
        xhr.send(formData);
    });
};

/**
 * Delete an image from R2
 * @param key - R2 object key
 * @returns Success/failure response
 */
export const deleteImage = async (key: string): Promise<{ success: boolean; message: string }> => {
    const accessToken = localStorage.getItem('accessToken');

    const response = await fetch(`${BASE_URL}/upload/delete-image`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
        },
        body: JSON.stringify({ key })
    });
    return response.json();
};

/**
 * Get a presigned URL for viewing an image
 * @param key - R2 object key
 * @returns Presigned URL response
 */
export const getPresignedUrl = async (key: string): Promise<PresignedUrlResponse> => {
    const accessToken = localStorage.getItem('accessToken');

    const response = await fetch(`${BASE_URL}/upload/presigned-url`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
        },
        body: JSON.stringify({ key })
    });
    return response.json();
};

/**
 * Get presigned URLs for multiple images
 * @param keys - Array of R2 object keys
 * @returns Multiple presigned URLs response
 */
export const getMultiplePresignedUrls = async (keys: string[]): Promise<MultiplePresignedUrlsResponse> => {
    const accessToken = localStorage.getItem('accessToken');

    const response = await fetch(`${BASE_URL}/upload/presigned-urls`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
        },
        body: JSON.stringify({ keys })
    });
    return response.json();
};

/**
 * Validate file before upload
 * @param file - File to validate
 * @returns Validation result
 */
export const validateFile = (file: File): { valid: boolean; error?: string } => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF`
        };
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum: 10MB`
        };
    }

    return { valid: true };
};

/**
 * Validate multiple files before upload
 * @param files - Files to validate
 * @returns Validation result with valid files and errors
 */
export const validateFiles = (files: File[]): {
    validFiles: File[];
    errors: string[]
} => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach(file => {
        const result = validateFile(file);
        if (result.valid) {
            validFiles.push(file);
        } else {
            errors.push(`${file.name}: ${result.error}`);
        }
    });

    return { validFiles, errors };
};

export default {
    uploadImages,
    uploadImage,
    deleteImage,
    getPresignedUrl,
    getMultiplePresignedUrls,
    validateFile,
    validateFiles
};
