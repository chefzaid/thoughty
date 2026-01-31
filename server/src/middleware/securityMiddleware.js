/**
 * Security Middleware
 * Implements security best practices for the API
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const xss = require('xss');

/**
 * Configure Helmet for security headers
 */
const helmetConfig = helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    } : false, // Disable CSP in development
    crossOriginEmbedderPolicy: false, // Allow embedding for Swagger UI
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests
    hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in development and test
    skip: () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV !== 'production'
});

/**
 * Strict rate limiter for authentication endpoints
 * 5 attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV !== 'production'
});

/**
 * Password reset rate limiter
 * 3 attempts per hour per IP
 */
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: { error: 'Too many password reset attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV !== 'production'
});

/**
 * Sanitize string to prevent XSS
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return xss(str, {
        whiteList: {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script']
    });
}

/**
 * Deep sanitize object recursively
 * @param {any} obj - Object to sanitize
 * @returns {any} Sanitized object
 */
function sanitizeObject(obj) {
    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }
    if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[sanitizeString(key)] = sanitizeObject(value);
        }
        return sanitized;
    }
    return obj;
}

/**
 * XSS sanitization middleware
 * Sanitizes req.body, req.query, and req.params
 */
function xssSanitizer(req, res, next) {
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    if (req.params) {
        req.params = sanitizeObject(req.params);
    }
    next();
}

/**
 * Validate Content-Type for POST/PUT/PATCH requests
 */
function validateContentType(req, res, next) {
    const methodsRequiringBody = ['POST', 'PUT', 'PATCH'];
    if (methodsRequiringBody.includes(req.method)) {
        const contentType = req.headers['content-type'];
        // Allow requests without body or with JSON content type
        if (req.body && Object.keys(req.body).length > 0) {
            if (!contentType?.includes('application/json')) {
                return res.status(415).json({ error: 'Content-Type must be application/json' });
            }
        }
    }
    next();
}

/**
 * Security headers for API responses
 */
function securityHeaders(req, res, next) {
    // Prevent caching of sensitive data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    next();
}

/**
 * Request size limiter middleware factory
 * @param {number} maxSize - Maximum request body size in bytes
 */
function requestSizeLimiter(maxSize = 1024 * 1024) { // 1MB default
    return (req, res, next) => {
        const contentLength = Number.parseInt(req.headers['content-length'] || '0', 10);
        if (contentLength > maxSize) {
            return res.status(413).json({ error: 'Request entity too large' });
        }
        next();
    };
}

module.exports = {
    helmetConfig,
    apiLimiter,
    authLimiter,
    passwordResetLimiter,
    xssSanitizer,
    validateContentType,
    securityHeaders,
    requestSizeLimiter,
    sanitizeString,
    sanitizeObject,
    hpp: hpp()
};
