/**
 * Shared authentication utilities
 */

const DEFAULT_USER_ID = 1;

/**
 * Extract user ID from request headers
 * @param {object} req - Express request object
 * @returns {number} User ID (defaults to 1 if not provided or invalid)
 */
function getUserId(req) {
    const userId = req.headers['x-user-id'];
    if (userId) {
        const parsed = parseInt(userId, 10);
        return isNaN(parsed) ? DEFAULT_USER_ID : parsed;
    }
    return DEFAULT_USER_ID;
}

module.exports = { getUserId, DEFAULT_USER_ID };
