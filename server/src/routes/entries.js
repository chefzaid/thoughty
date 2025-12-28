const express = require('express');
const router = express.Router();
const db = require('../db');
const { getUserId } = require('../utils/auth');

/**
 * @swagger
 * /api/entries:
 *   get:
 *     summary: Retrieve a list of journal entries
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for content or tags
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated list of tags to filter by
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *         description: Filter by date (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: header
 *         name: x-user-id
 *         schema:
 *           type: integer
 *         description: User ID (defaults to 1)
 *     responses:
 *       200:
 *         description: A list of entries
 */
router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { search, tags, date, page = 1, limit = 10 } = req.query;

        let query = 'SELECT * FROM entries WHERE user_id = $1';
        const params = [userId];
        let paramCount = 2;

        if (search) {
            query += ` AND (content ILIKE $${paramCount} OR $${paramCount} = ANY(tags))`;
            params.push(`%${search}%`);
            paramCount++;
        }

        if (tags) {
            const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
            if (tagList.length > 0) {
                query += ` AND tags @> $${paramCount}`;
                params.push(tagList);
                paramCount++;
            }
        }

        if (date) {
            query += ` AND date = $${paramCount}`;
            params.push(date);
            paramCount++;
        }

        // Count total for pagination
        const countResult = await db.query(`SELECT COUNT(*) FROM (${query}) AS count_query`, params);
        const total = parseInt(countResult.rows[0].count);

        // Add sorting and pagination
        query += ` ORDER BY date DESC, index ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        const limitNum = parseInt(limit);
        const offset = (parseInt(page) - 1) * limitNum;
        params.push(limitNum, offset);

        const result = await db.query(query, params);

        // Get all tags for the filter (user-specific)
        const tagsResult = await db.query('SELECT DISTINCT UNNEST(tags) as tag FROM entries WHERE user_id = $1', [userId]);
        const allTags = tagsResult.rows.map(r => r.tag).sort();

        res.json({
            entries: result.rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limitNum),
            allTags
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch entries' });
    }
});

/**
 * @swagger
 * /api/entries:
 *   post:
 *     summary: Create a new journal entry
 */
router.post('/', async (req, res) => {
    const userId = getUserId(req);
    const { text, tags, date, visibility = 'private' } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({ error: 'At least one tag is required' });
    }

    try {
        let dateStr;
        if (date) {
            dateStr = date;
        } else {
            const now = new Date();
            dateStr = now.toISOString().split('T')[0];
        }

        // Calculate next index for the day (user-specific)
        const countResult = await db.query('SELECT COUNT(*) FROM entries WHERE user_id = $1 AND date = $2', [userId, dateStr]);
        const nextIndex = parseInt(countResult.rows[0].count) + 1;

        const query = `
            INSERT INTO entries (user_id, date, index, tags, content, visibility)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const values = [userId, dateStr, nextIndex, tags || [], text, visibility];

        await db.query(query, values);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create entry' });
    }
});

/**
 * @swagger
 * /api/entries/{id}:
 *   put:
 *     summary: Update an existing journal entry
 */
router.put('/:id', async (req, res) => {
    const userId = getUserId(req);
    const { id } = req.params;
    const { text, tags, date, visibility = 'private' } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
        return res.status(400).json({ error: 'At least one tag is required' });
    }

    try {
        // Get current entry to check if date is changing
        const currentEntry = await db.query('SELECT * FROM entries WHERE id = $1 AND user_id = $2', [id, userId]);

        if (currentEntry.rows.length === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        const oldDate = currentEntry.rows[0].date;
        let newIndex = currentEntry.rows[0].index;

        // If date is changing, recalculate the index for the new date
        if (oldDate !== date) {
            // Get the next index for the new date
            const countResult = await db.query('SELECT COUNT(*) FROM entries WHERE user_id = $1 AND date = $2', [userId, date]);
            newIndex = parseInt(countResult.rows[0].count) + 1;
        }

        const query = `
            UPDATE entries 
            SET content = $1, tags = $2, date = $3, visibility = $4, index = $5
            WHERE id = $6 AND user_id = $7
            RETURNING *
        `;
        const result = await db.query(query, [text, tags, date, visibility, newIndex, id, userId]);

        // If date changed, reindex the old date's entries
        if (oldDate !== date) {
            const remainingEntries = await db.query(
                'SELECT id FROM entries WHERE user_id = $1 AND date = $2 ORDER BY index ASC',
                [userId, oldDate]
            );
            for (let i = 0; i < remainingEntries.rows.length; i++) {
                await db.query('UPDATE entries SET index = $1 WHERE id = $2', [i + 1, remainingEntries.rows[i].id]);
            }
        }

        res.json({ success: true, entry: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update entry' });
    }
});

/**
 * @swagger
 * /api/entries/{id}/visibility:
 *   patch:
 *     summary: Toggle visibility of a journal entry
 */
router.patch('/:id/visibility', async (req, res) => {
    const userId = getUserId(req);
    const { id } = req.params;
    const { visibility } = req.body;

    if (!visibility || !['public', 'private'].includes(visibility)) {
        return res.status(400).json({ error: 'Valid visibility (public/private) is required' });
    }

    try {
        const query = `
            UPDATE entries 
            SET visibility = $1
            WHERE id = $2 AND user_id = $3
            RETURNING *
        `;
        const result = await db.query(query, [visibility, id, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        res.json({ success: true, entry: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update visibility' });
    }
});

/**
 * @swagger
 * /api/entries/all:
 *   delete:
 *     summary: Delete all journal entries for the user
 */
router.delete('/all', async (req, res) => {
    const userId = getUserId(req);

    try {
        const result = await db.query('DELETE FROM entries WHERE user_id = $1', [userId]);
        res.json({ success: true, deletedCount: result.rowCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete all entries' });
    }
});

/**
 * @swagger
 * /api/entries/{id}:
 *   delete:
 *     summary: Delete a journal entry
 */
router.delete('/:id', async (req, res) => {
    const userId = getUserId(req);
    const { id } = req.params;

    try {
        // Get the entry first to know its date (check user ownership)
        const entryResult = await db.query('SELECT * FROM entries WHERE id = $1 AND user_id = $2', [id, userId]);

        if (entryResult.rows.length === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        const deletedEntry = entryResult.rows[0];
        const entryDate = deletedEntry.date;

        // Delete the entry
        await db.query('DELETE FROM entries WHERE id = $1 AND user_id = $2', [id, userId]);

        // Reindex remaining entries for that date (user-specific)
        const remainingEntries = await db.query(
            'SELECT id FROM entries WHERE user_id = $1 AND date = $2 ORDER BY index ASC',
            [userId, entryDate]
        );

        // Update indexes to be consecutive starting from 1
        for (let i = 0; i < remainingEntries.rows.length; i++) {
            await db.query(
                'UPDATE entries SET index = $1 WHERE id = $2',
                [i + 1, remainingEntries.rows[i].id]
            );
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete entry' });
    }
});

module.exports = router;
