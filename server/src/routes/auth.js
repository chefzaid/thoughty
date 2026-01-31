/**
 * Authentication Routes
 * Handles user registration, login, and OAuth
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const db = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware/authMiddleware');
const { authLimiter, passwordResetLimiter, sanitizeString } = require('../middleware/securityMiddleware');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const REFRESH_SECRET = process.env.REFRESH_SECRET || 'refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Password requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validate password strength
 */
function validatePassword(password) {
    if (!password || password.length < PASSWORD_MIN_LENGTH) {
        return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
    }
    if (!PASSWORD_REGEX.test(password)) {
        return { 
            valid: false, 
            error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' 
        };
    }
    return { valid: true };
}

/**
 * Generate JWT access token
 */
function generateAccessToken(user) {
    return jwt.sign(
        { userId: user.id, email: user.email, username: user.username },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
}

/**
 * Generate refresh token
 */
function generateRefreshToken(user) {
    return jwt.sign(
        { userId: user.id },
        REFRESH_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user with email and password
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               username:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already registered
 */
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { email, password, username } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Validate email format
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }

        // Sanitize and validate username if provided
        const sanitizedUsername = username ? sanitizeString(username.trim()).substring(0, 50) : null;
        if (sanitizedUsername && !/^[a-zA-Z0-9_-]+$/.test(sanitizedUsername)) {
            return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
        }

        // Check if email already exists
        const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password with higher cost factor
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Generate username from email if not provided
        const userName = sanitizedUsername || email.split('@')[0].substring(0, 50);

        // Create user
        const result = await db.query(
            `INSERT INTO users (username, email, password_hash, auth_provider, email_verified)
             VALUES ($1, $2, $3, 'local', false)
             RETURNING id, username, email, created_at`,
            [userName, email.toLowerCase(), passwordHash]
        );

        const user = result.rows[0];

        // Create default diary for new user
        await db.query(
            `INSERT INTO diaries (user_id, name, icon, is_default, visibility)
             VALUES ($1, 'Thoughts', '💭', true, 'private')
             ON CONFLICT (user_id, name) DO NOTHING`,
            [user.id]
        );

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store refresh token
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await db.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, refreshToken, expiresAt]
        );

        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                authProvider: 'local'
            },
            accessToken,
            refreshToken
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password, identifier } = req.body;
        
        // Support both 'email' and 'identifier' for backwards compatibility
        const loginIdentifier = sanitizeString((identifier || email || '').trim());

        if (!loginIdentifier || !password) {
            return res.status(400).json({ error: 'Email/username and password are required' });
        }

        // Find user by email or username
        const result = await db.query(
            'SELECT id, username, email, password_hash, auth_provider, deleted_at FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1',
            [loginIdentifier.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Check if account is deleted
        if (user.deleted_at) {
            return res.status(403).json({ error: 'This account has been deleted. Please contact support if you believe this is a mistake.' });
        }

        // Check if user registered with OAuth
        if (user.auth_provider !== 'local' && !user.password_hash) {
            return res.status(401).json({ 
                error: `This account uses ${user.auth_provider} login. Please sign in with ${user.auth_provider}.` 
            });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store refresh token
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, refreshToken, expiresAt]
        );

        res.json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                authProvider: user.auth_provider
            },
            accessToken,
            refreshToken
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * @swagger
 * /api/auth/oauth:
 *   post:
 *     summary: Authenticate with OAuth provider (Google/Facebook)
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - providerId
 *               - email
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [google, facebook]
 *               providerId:
 *                 type: string
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: OAuth authentication successful
 *       400:
 *         description: Missing required fields
 */
router.post('/oauth', async (req, res) => {
    try {
        const { provider, providerId, email, name, avatarUrl } = req.body;

        if (!provider || !providerId || !email) {
            return res.status(400).json({ error: 'Provider, providerId, and email are required' });
        }

        // Check if user exists with this provider
        let result = await db.query(
            'SELECT id, username, email, deleted_at FROM users WHERE auth_provider = $1 AND provider_id = $2',
            [provider, providerId]
        );

        let user;
        let isNewUser = false;

        if (result.rows.length > 0) {
            // Existing OAuth user
            user = result.rows[0];
            
            // Check if account is deleted
            if (user.deleted_at) {
                return res.status(403).json({ error: 'This account has been deleted. Please contact support if you believe this is a mistake.' });
            }
        } else {
            // Check if email exists with different auth method
            result = await db.query('SELECT id, auth_provider, deleted_at FROM users WHERE email = $1', [email.toLowerCase()]);
            
            if (result.rows.length > 0) {
                const existingUser = result.rows[0];
                
                // Check if account is deleted
                if (existingUser.deleted_at) {
                    return res.status(403).json({ error: 'This account has been deleted. Please contact support if you believe this is a mistake.' });
                }
                
                // Link OAuth to existing account
                await db.query(
                    `UPDATE users SET auth_provider = $1, provider_id = $2, avatar_url = $3, email_verified = true, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $4`,
                    [provider, providerId, avatarUrl, existingUser.id]
                );
                result = await db.query('SELECT id, username, email FROM users WHERE id = $1', [existingUser.id]);
                user = result.rows[0];
            } else {
                // Create new user
                isNewUser = true;
                const username = name || email.split('@')[0];
                result = await db.query(
                    `INSERT INTO users (username, email, auth_provider, provider_id, avatar_url, email_verified)
                     VALUES ($1, $2, $3, $4, $5, true)
                     RETURNING id, username, email`,
                    [username, email.toLowerCase(), provider, providerId, avatarUrl]
                );
                user = result.rows[0];

                // Create default diary for new user
                await db.query(
                    `INSERT INTO diaries (user_id, name, icon, is_default, visibility)
                     VALUES ($1, 'Thoughts', '💭', true, 'private')
                     ON CONFLICT (user_id, name) DO NOTHING`,
                    [user.id]
                );
            }
        }

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Store refresh token
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await db.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, refreshToken, expiresAt]
        );

        res.json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                authProvider: provider,
                isNewUser
            },
            accessToken,
            refreshToken
        });
    } catch (err) {
        console.error('OAuth error:', err);
        res.status(500).json({ error: 'OAuth authentication failed' });
    }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: New access token
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        // Verify refresh token
        try {
            jwt.verify(refreshToken, REFRESH_SECRET);
        } catch {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        // Check if refresh token exists in database
        const result = await db.query(
            'SELECT rt.*, u.email, u.username, u.deleted_at FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token = $1 AND rt.expires_at > NOW()',
            [refreshToken]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Refresh token expired or revoked' });
        }

        const tokenData = result.rows[0];
        
        // Check if account is deleted
        if (tokenData.deleted_at) {
            // Clean up the token
            await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
            return res.status(403).json({ error: 'This account has been deleted.' });
        }
        
        const user = {
            id: tokenData.user_id,
            email: tokenData.email,
            username: tokenData.username
        };

        // Generate new access token
        const accessToken = generateAccessToken(user);

        res.json({ accessToken });
    } catch (err) {
        console.error('Token refresh error:', err);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and invalidate refresh token
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            // Remove refresh token from database
            await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user info
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, username, email, avatar_url, auth_provider, created_at FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            avatarUrl: user.avatar_url,
            authProvider: user.auth_provider,
            createdAt: user.created_at
        });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Unauthorized or incorrect current password
 */
router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        // Validate new password strength
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }

        // Get current user
        const result = await db.query(
            'SELECT password_hash, auth_provider FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Check if user has a password (OAuth users might not)
        if (!user.password_hash) {
            return res.status(400).json({ error: 'Cannot change password for OAuth accounts without existing password' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const saltRounds = 10;
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newPasswordHash, req.user.userId]
        );

        // Invalidate all refresh tokens for security
        await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.userId]);

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset email
 */
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Validate email format
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Find user
        const result = await db.query(
            'SELECT id, email, auth_provider FROM users WHERE LOWER(email) = $1',
            [email.toLowerCase()]
        );

        // Always return success to prevent email enumeration
        if (result.rows.length === 0) {
            return res.json({ success: true, message: 'If an account exists with this email, a reset link will be sent.' });
        }

        const user = result.rows[0];

        // Check if user uses OAuth
        if (user.auth_provider !== 'local') {
            return res.json({ success: true, message: 'If an account exists with this email, a reset link will be sent.' });
        }

        // Generate reset token (valid for 1 hour)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Store reset token (we'll use a simple approach - store in a column on user table)
        // In production, you'd want a separate password_resets table
        await db.query(
            `UPDATE users SET 
                reset_token = $1, 
                reset_token_expires = $2, 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = $3`,
            [resetTokenHash, expiresAt, user.id]
        );

        // Send email with reset link
        const { sendPasswordResetEmail } = require('../utils/emailService');
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
        
        try {
            await sendPasswordResetEmail(user.email, resetUrl);
        } catch (emailError) {
            console.log('Password reset email not sent (email service not configured):', emailError.message);
            console.log(`Reset URL: ${resetUrl}`);
        }

        res.json({ success: true, message: 'If an account exists with this email, a reset link will be sent.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

/**
 * @route POST /api/auth/delete-account
 * @desc Flag account for deletion (soft delete)
 */
router.post('/delete-account', authenticateToken, async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user.userId;

        // Get user
        const userResult = await db.query(
            'SELECT id, email, password_hash, auth_provider FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        // For local accounts, verify password
        if (user.auth_provider === 'local') {
            if (!password) {
                return res.status(400).json({ error: 'Password is required to delete account' });
            }

            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid password' });
            }
        }

        // Flag account for deletion
        await db.query(
            `UPDATE users SET 
                deleted_at = CURRENT_TIMESTAMP, 
                deletion_reason = 'User requested deletion',
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1`,
            [userId]
        );

        // Invalidate all refresh tokens
        await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);

        // Send deletion notification email (if email service is configured)
        const { sendAccountDeletionEmail } = require('../utils/emailService');
        try {
            await sendAccountDeletionEmail(user.email);
        } catch (emailError) {
            console.log('Email notification not sent (email service not configured):', emailError.message);
        }

        res.json({ success: true, message: 'Account has been deleted' });
    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password with token
 */
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        // Validate new password strength
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }

        // Hash the provided token to compare with stored hash
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid reset token
        const result = await db.query(
            `SELECT id FROM users 
            WHERE reset_token = $1 AND reset_token_expires > CURRENT_TIMESTAMP`,
            [tokenHash]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const user = result.rows[0];

        // Hash new password with higher cost factor
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);

        // Update password and clear reset token
        await db.query(
            `UPDATE users SET 
                password_hash = $1, 
                reset_token = NULL, 
                reset_token_expires = NULL,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2`,
            [passwordHash, user.id]
        );

        // Invalidate all refresh tokens for security
        await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;
