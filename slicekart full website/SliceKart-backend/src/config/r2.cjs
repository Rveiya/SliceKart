/**
 * Cloudflare R2 Storage Configuration
 * Uses AWS SDK v3 compatible with R2
 */
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");
const path = require("path");

// R2 Client Configuration
const r2Client = new S3Client({
    region: "auto", // R2 ignores region, but SDK requires it
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME;

// Allowed file types for security
const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Generate a secure unique filename
 * @param {string} originalName - Original file name
 * @returns {string} - Secure unique filename with timestamp
 */
const generateSecureFileName = (originalName) => {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(originalName).toLowerCase();
    return `products/${timestamp}-${randomString}${ext}`;
};

/**
 * Validate file type and size
 * @param {object} file - Multer file object
 * @returns {{ valid: boolean, error?: string }}
 */
const validateFile = (file) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return {
            valid: false,
            error: `Invalid file type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP, GIF`
        };
    }

    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size: 10MB`
        };
    }

    return { valid: true };
};

/**
 * Upload file to R2 private bucket
 * @param {Buffer} buffer - File buffer
 * @param {string} key - S3 object key (path)
 * @param {string} contentType - MIME type
 * @returns {Promise<{ success: boolean, key?: string, error?: string }>}
 */
const uploadToR2 = async (buffer, key, contentType) => {
    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            // Add cache control for better performance
            CacheControl: "max-age=31536000",
        });

        await r2Client.send(command);

        return {
            success: true,
            key: key
        };
    } catch (error) {
        console.error("R2 Upload Error:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Delete file from R2
 * @param {string} key - S3 object key (path)
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
const deleteFromR2 = async (key) => {
    try {
        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        await r2Client.send(command);

        return { success: true };
    } catch (error) {
        console.error("R2 Delete Error:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Generate a presigned URL for secure private access
 * URLs expire after specified duration for security
 * @param {string} key - S3 object key (path)
 * @param {number} expiresIn - URL expiration in seconds (default: 1 hour)
 * @returns {Promise<{ success: boolean, url?: string, error?: string }>}
 */
const getPresignedUrl = async (key, expiresIn = 3600) => {
    try {
        // Validate key to prevent path traversal
        if (!key || key.includes("..") || key.startsWith("/")) {
            return {
                success: false,
                error: "Invalid object key"
            };
        }

        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        const url = await getSignedUrl(r2Client, command, { expiresIn });

        return {
            success: true,
            url: url
        };
    } catch (error) {
        console.error("Presigned URL Error:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Upload multiple files to R2
 * @param {Array<{buffer: Buffer, originalname: string, mimetype: string, size: number}>} files
 * @returns {Promise<{ success: boolean, keys?: string[], errors?: string[] }>}
 */
const uploadMultipleToR2 = async (files) => {
    const results = {
        success: true,
        keys: [],
        errors: []
    };

    for (const file of files) {
        // Validate each file
        const validation = validateFile(file);
        if (!validation.valid) {
            results.errors.push(`${file.originalname}: ${validation.error}`);
            continue;
        }

        // Generate secure filename
        const key = generateSecureFileName(file.originalname);

        // Upload to R2
        const uploadResult = await uploadToR2(file.buffer, key, file.mimetype);

        if (uploadResult.success) {
            results.keys.push(key);
        } else {
            results.errors.push(`${file.originalname}: ${uploadResult.error}`);
        }
    }

    if (results.keys.length === 0 && results.errors.length > 0) {
        results.success = false;
    }

    return results;
};

/**
 * Delete multiple files from R2
 * @param {string[]} keys - Array of object keys to delete
 * @returns {Promise<{ success: boolean, deletedCount: number, errors: string[] }>}
 */
const deleteMultipleFromR2 = async (keys) => {
    const results = {
        success: true,
        deletedCount: 0,
        errors: []
    };

    for (const key of keys) {
        const deleteResult = await deleteFromR2(key);
        if (deleteResult.success) {
            results.deletedCount++;
        } else {
            results.errors.push(`${key}: ${deleteResult.error}`);
        }
    }

    return results;
};

/**
 * Get presigned URLs for multiple keys
 * @param {string[]} keys - Array of object keys
 * @param {number} expiresIn - URL expiration in seconds
 * @returns {Promise<Array<{ key: string, url: string | null }>>}
 */
const getMultiplePresignedUrls = async (keys, expiresIn = 3600) => {
    const results = [];

    for (const key of keys) {
        if (!key) {
            results.push({ key: key, url: null });
            continue;
        }

        const urlResult = await getPresignedUrl(key, expiresIn);
        results.push({
            key: key,
            url: urlResult.success ? urlResult.url : null
        });
    }

    return results;
};

module.exports = {
    r2Client,
    BUCKET_NAME,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE,
    generateSecureFileName,
    validateFile,
    uploadToR2,
    deleteFromR2,
    getPresignedUrl,
    uploadMultipleToR2,
    deleteMultipleFromR2,
    getMultiplePresignedUrls
};
