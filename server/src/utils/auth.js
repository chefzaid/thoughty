/**
 * Shared authentication utilities
 */

const DEFAULT_USER_ID = 1;

/**
 * Extract user ID from request
 * Priority: 1) JWT token (req.user.userId), 2) x-user-id header, 3) default
 * @param {object} req - Express request object
 * @returns {number} User ID (defaults to 1 if not provided or invalid)
 */
function getUserId(req) {
    // First check for authenticated user from JWT
    if (req.user?.userId) {
        return req.user.userId;
    }
    
    // Fallback to legacy header for backward compatibility
    const userId = req.headers['x-user-id'];
    if (userId) {
        const parsed = Number.parseInt(userId, 10);
        return Number.isNaN(parsed) ? DEFAULT_USER_ID : parsed;
    }
    return DEFAULT_USER_ID;
}

module.exports = { getUserId, DEFAULT_USER_ID };
