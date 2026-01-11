const express = require('express');
const router = express.Router();
const db = require('../db');
const { getUserId } = require('../utils/auth');

/**
 * @swagger
 * /api/diaries:
 *   get:
 *     summary: Get all diaries for the current user
 *     parameters:
 *       - in: header
 *         name: x-user-id
 *         schema:
 *           type: integer
 *         description: User ID (defaults to 1)
 *     responses:
 *       200:
 *         description: List of diaries
 */
router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        const result = await db.query(
            'SELECT * FROM diaries WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC',
            [userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching diaries:', err);
        res.status(500).json({ error: 'Failed to fetch diaries' });
    }
});

/**
 * @swagger
 * /api/diaries:
 *   post:
 *     summary: Create a new diary
 */
router.post('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { name, icon = '📓', visibility = 'private' } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Diary name is required' });
        }

        const result = await db.query(
            `INSERT INTO diaries (user_id, name, icon, visibility, is_default)
             VALUES ($1, $2, $3, $4, false)
             RETURNING *`,
            [userId, name.trim(), icon, visibility]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'A diary with this name already exists' });
        }
        console.error('Error creating diary:', err);
        res.status(500).json({ error: 'Failed to create diary' });
    }
});

/**
 * @swagger
 * /api/diaries/{id}:
 *   put:
 *     summary: Update a diary
 */
router.put('/:id', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { id } = req.params;
        const { name, icon, visibility } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Diary name is required' });
        }

        const result = await db.query(
            `UPDATE diaries 
             SET name = $1, icon = $2, visibility = $3
             WHERE id = $4 AND user_id = $5
             RETURNING *`,
            [name.trim(), icon, visibility, id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Diary not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'A diary with this name already exists' });
        }
        console.error('Error updating diary:', err);
        res.status(500).json({ error: 'Failed to update diary' });
    }
});

/**
 * @swagger
 * /api/diaries/{id}:
 *   delete:
 *     summary: Delete a diary (entries moved to default diary)
 */
router.delete('/:id', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { id } = req.params;

        // Check if this is the default diary
        const diaryResult = await db.query(
            'SELECT is_default FROM diaries WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (diaryResult.rows.length === 0) {
            return res.status(404).json({ error: 'Diary not found' });
        }

        if (diaryResult.rows[0].is_default) {
            return res.status(400).json({ error: 'Cannot delete the default diary' });
        }

        // Get the default diary to move entries to
        const defaultDiary = await db.query(
            'SELECT id FROM diaries WHERE user_id = $1 AND is_default = true',
            [userId]
        );

        if (defaultDiary.rows.length > 0) {
            // Move entries to default diary
            await db.query(
                'UPDATE entries SET diary_id = $1 WHERE diary_id = $2 AND user_id = $3',
                [defaultDiary.rows[0].id, id, userId]
            );
        }

        // Delete the diary
        await db.query('DELETE FROM diaries WHERE id = $1 AND user_id = $2', [id, userId]);

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting diary:', err);
        res.status(500).json({ error: 'Failed to delete diary' });
    }
});

/**
 * @swagger
 * /api/diaries/{id}/default:
 *   patch:
 *     summary: Set a diary as the default
 */
router.patch('/:id/default', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { id } = req.params;

        // First, unset current default
        await db.query(
            'UPDATE diaries SET is_default = false WHERE user_id = $1',
            [userId]
        );

        // Set new default
        const result = await db.query(
            'UPDATE diaries SET is_default = true WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Diary not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error setting default diary:', err);
        res.status(500).json({ error: 'Failed to set default diary' });
    }
});

module.exports = router;
