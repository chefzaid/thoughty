/**
 * Authentication Middleware
 * Verifies JWT tokens and protects routes
 */

const jwt = require('jsonwebtoken');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware to verify JWT token
 * Extracts user info and attaches to request
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(403).json({ error: 'Invalid token' });
    }
}

/**
 * Optional authentication - doesn't fail if no token
 * Useful for routes that work differently for authenticated vs anonymous users
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch {
            // Token invalid, but that's okay for optional auth
            req.user = null;
        }
    } else {
        req.user = null;
    }
    next();
}

/**
 * Extract user ID from request (authenticated or legacy header)
 * Provides backward compatibility with x-user-id header
 */
function getUserIdFromRequest(req) {
    if (req.user?.userId) {
        return req.user.userId;
    }
    // Fallback to legacy header for backward compatibility
    const userId = req.headers['x-user-id'];
    if (userId) {
        const parsed = Number.parseInt(userId, 10);
        return Number.isNaN(parsed) ? 1 : parsed;
    }
    return 1; // Default user
}

module.exports = {
    authenticateToken,
    optionalAuth,
    getUserIdFromRequest,
    JWT_SECRET
};
