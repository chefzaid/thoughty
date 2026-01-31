const express = require('express');
const router = express.Router();
const db = require('../db');
const { getUserId } = require('../utils/auth');

// Default settings
const defaultSettings = {
    theme: 'dark',
    name: 'User',
    entriesPerPage: '10',
    defaultVisibility: 'private',
    language: 'en'
};

/**
 * @swagger
 * /api/config:
 *   get:
 *     summary: Get user configuration from database
 *     tags: [Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User configuration
 *       401:
 *         description: Unauthorized
 */
router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        const result = await db.query('SELECT key, value FROM settings WHERE user_id = $1', [userId]);

        // Build config object from settings rows
        const config = { ...defaultSettings };
        for (const row of result.rows) {
            config[row.key] = row.value;
        }

        res.json(config);
    } catch (err) {
        console.error('Error reading config:', err);
        // Return defaults if DB error
        res.json(defaultSettings);
    }
});

/**
 * @swagger
 * /api/config:
 *   post:
 *     summary: Update user configuration in database
 *     tags: [Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration updated
 *       401:
 *         description: Unauthorized
 */
router.post('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        const newConfig = req.body;

        // Upsert each setting (user-specific)
        for (const [key, value] of Object.entries(newConfig)) {
            await db.query(`
                INSERT INTO settings (user_id, key, value, updated_at)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, key) 
                DO UPDATE SET value = $3, updated_at = CURRENT_TIMESTAMP
            `, [userId, key, String(value)]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error saving config:', err);
        res.status(500).json({ error: 'Failed to save config' });
    }
});

module.exports = router;
