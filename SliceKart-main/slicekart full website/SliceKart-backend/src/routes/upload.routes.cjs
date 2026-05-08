/**
 * Upload Routes - Secure file upload handling for product images
 * Uses Cloudflare R2 private bucket storage
 */
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { authenticateToken, requireRole } = require("../middlewares/auth.middleware.cjs");
const {
    uploadMultipleToR2,
    deleteFromR2,
    getPresignedUrl,
    getMultiplePresignedUrls,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE
} = require("../config/r2.cjs");

// Configure multer for memory storage (files stored in buffer)
const storage = multer.memoryStorage();

// File filter for security
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WebP, and GIF are allowed.`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE, // 10MB per file
        files: 10 // Maximum 10 files per request
    }
});

// Error handler for multer errors
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files. Maximum 10 files per upload.'
            });
        }
        return res.status(400).json({
            success: false,
            message: `Upload error: ${err.message}`
        });
    }
    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    next();
};

/**
 * POST /api/upload/images
 * Upload multiple product images to R2
 * Requires admin authentication
 */
router.post(
    "/images",
    authenticateToken,
    requireRole(['ADMIN']),
    upload.array("images", 10),
    handleMulterError,
    async (req, res, next) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "No files uploaded"
                });
            }

            console.log(`📤 Uploading ${req.files.length} images to R2...`);

            // Upload files to R2
            const uploadResult = await uploadMultipleToR2(req.files);

            if (!uploadResult.success) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to upload images",
                    errors: uploadResult.errors
                });
            }

            // Generate presigned URLs for immediate use
            const presignedUrls = await getMultiplePresignedUrls(uploadResult.keys, 3600);

            console.log(`✅ Successfully uploaded ${uploadResult.keys.length} images`);

            res.json({
                success: true,
                message: `Successfully uploaded ${uploadResult.keys.length} images`,
                images: uploadResult.keys.map((key, index) => ({
                    key: key,
                    url: presignedUrls[index]?.url || null
                })),
                errors: uploadResult.errors.length > 0 ? uploadResult.errors : undefined
            });
        } catch (err) {
            console.error("Upload error:", err);
            next(err);
        }
    }
);

/**
 * POST /api/upload/image
 * Upload a single product image to R2
 * Requires admin authentication
 */
router.post(
    "/image",
    authenticateToken,
    requireRole(['ADMIN']),
    upload.single("image"),
    handleMulterError,
    async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No file uploaded"
                });
            }

            console.log(`📤 Uploading single image to R2...`);

            // Upload file to R2
            const uploadResult = await uploadMultipleToR2([req.file]);

            if (!uploadResult.success || uploadResult.keys.length === 0) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to upload image",
                    errors: uploadResult.errors
                });
            }

            const key = uploadResult.keys[0];

            // Generate presigned URL
            const urlResult = await getPresignedUrl(key, 3600);

            console.log(`✅ Successfully uploaded image: ${key}`);

            res.json({
                success: true,
                message: "Image uploaded successfully",
                image: {
                    key: key,
                    url: urlResult.success ? urlResult.url : null
                }
            });
        } catch (err) {
            console.error("Upload error:", err);
            next(err);
        }
    }
);

/**
 * POST /api/upload/delete-image
 * Delete an image from R2
 * Requires admin authentication
 * Key is passed in request body
 */
router.post(
    "/delete-image",
    authenticateToken,
    requireRole(['ADMIN']),
    async (req, res, next) => {
        try {
            const { key } = req.body;

            if (!key) {
                return res.status(400).json({
                    success: false,
                    message: "Image key is required"
                });
            }

            // Security: Validate key format
            if (key.includes("..") || !key.startsWith("products/")) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid image key"
                });
            }

            console.log(`🗑️ Deleting image from R2: ${key}`);

            const deleteResult = await deleteFromR2(key);

            if (!deleteResult.success) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to delete image",
                    error: deleteResult.error
                });
            }

            console.log(`✅ Successfully deleted image: ${key}`);

            res.json({
                success: true,
                message: "Image deleted successfully"
            });
        } catch (err) {
            console.error("Delete error:", err);
            next(err);
        }
    }
);

/**
 * POST /api/upload/presigned-url
 * Get a presigned URL for viewing a private image
 * Can be accessed by authenticated users (for viewing products)
 * Key is passed in request body
 */
router.post(
    "/presigned-url",
    authenticateToken,
    async (req, res, next) => {
        try {
            const { key } = req.body;

            if (!key) {
                return res.status(400).json({
                    success: false,
                    message: "Image key is required"
                });
            }

            // Security: Validate key format
            if (key.includes("..")) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid image key"
                });
            }

            // Generate presigned URL (valid for 1 hour)
            const urlResult = await getPresignedUrl(key, 3600);

            if (!urlResult.success) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to generate URL",
                    error: urlResult.error
                });
            }

            res.json({
                success: true,
                url: urlResult.url,
                expiresIn: 3600
            });
        } catch (err) {
            console.error("Presigned URL error:", err);
            next(err);
        }
    }
);

/**
 * POST /api/upload/presigned-urls
 * Get presigned URLs for multiple images
 * Used for displaying product galleries
 */
router.post(
    "/presigned-urls",
    async (req, res, next) => {
        try {
            const { keys } = req.body;

            if (!keys || !Array.isArray(keys) || keys.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Array of image keys is required"
                });
            }

            // Limit to 50 keys per request
            if (keys.length > 50) {
                return res.status(400).json({
                    success: false,
                    message: "Maximum 50 images per request"
                });
            }

            // Validate all keys
            const validKeys = keys.filter(key => key && !key.includes(".."));

            // Generate presigned URLs (valid for 1 hour)
            const presignedUrls = await getMultiplePresignedUrls(validKeys, 3600);

            res.json({
                success: true,
                images: presignedUrls,
                expiresIn: 3600
            });
        } catch (err) {
            console.error("Presigned URLs error:", err);
            next(err);
        }
    }
);

module.exports = router;
