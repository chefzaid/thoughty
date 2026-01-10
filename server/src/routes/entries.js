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
        const { search, tags, date, visibility, page = 1, limit = 10 } = req.query;

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

        if (visibility && ['public', 'private'].includes(visibility)) {
            query += ` AND visibility = $${paramCount}`;
            params.push(visibility);
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
 * /api/entries/first:
 *   get:
 *     summary: Get page number containing first entry for a year/month
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 */
router.get('/first', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { year, month, limit = 10 } = req.query;

        // Always fetch available years and months for the dropdowns
        const yearsResult = await db.query(`
            SELECT DISTINCT EXTRACT(YEAR FROM date) as year 
            FROM entries WHERE user_id = $1 
            ORDER BY year DESC
        `, [userId]);
        const years = yearsResult.rows.map(r => parseInt(r.year));

        const monthsResult = await db.query(`
            SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') as month 
            FROM entries WHERE user_id = $1 
            ORDER BY month DESC
        `, [userId]);
        const months = monthsResult.rows.map(r => r.month);

        if (!year) {
            return res.json({ page: 1, found: false, years, months });
        }

        // Build date filter for target period
        let dateFilter;
        if (month) {
            const monthStr = String(month).padStart(2, '0');
            dateFilter = `${year}-${monthStr}`;
        } else {
            dateFilter = `${year}`;
        }

        // Find the first entry date in the target period
        const firstEntryQuery = month
            ? `SELECT MIN(date) as first_date FROM entries WHERE user_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2`
            : `SELECT MIN(date) as first_date FROM entries WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2`;

        const firstEntryResult = await db.query(firstEntryQuery, [userId, month ? dateFilter : parseInt(year)]);

        if (!firstEntryResult.rows[0].first_date) {
            return res.json({ page: 1, found: false, years, months });
        }

        const firstDate = firstEntryResult.rows[0].first_date;

        // Get the first entry's ID for scrolling/highlighting
        const firstEntryIdQuery = month
            ? `SELECT id FROM entries WHERE user_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2 ORDER BY date ASC, index ASC LIMIT 1`
            : `SELECT id FROM entries WHERE user_id = $1 AND EXTRACT(YEAR FROM date) = $2 ORDER BY date ASC, index ASC LIMIT 1`;
        const firstEntryIdResult = await db.query(firstEntryIdQuery, [userId, month ? dateFilter : parseInt(year)]);
        const firstEntryId = firstEntryIdResult.rows[0]?.id;

        // Count entries AFTER this date (since we sort DESC, these come before)
        const countNewerQuery = `SELECT COUNT(*) as count FROM entries WHERE user_id = $1 AND date > $2`;
        const countResult = await db.query(countNewerQuery, [userId, firstDate]);
        const entriesBefore = parseInt(countResult.rows[0].count);

        // Calculate page number
        const limitNum = parseInt(limit);
        const page = Math.floor(entriesBefore / limitNum) + 1;

        res.json({ page, found: true, entryId: firstEntryId, years, months });
    } catch (err) {
        console.error('Error finding first entry:', err);
        res.status(500).json({ error: 'Failed to find first entry' });
    }
});

/**
 * @swagger
 * /api/entries:
 *   post:
 *     summary: Create a new journal entry
 */

/**
 * @swagger
 * /api/entries/by-date:
 *   get:
 *     summary: Find an entry by date and optional index for cross-reference navigation
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *         description: Entry date (YYYY-MM-DD)
 *       - in: query
 *         name: index
 *         schema:
 *           type: integer
 *         description: Entry index for that day (defaults to 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Entries per page for page calculation
 */
router.get('/by-date', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { date, index = 1, limit = 10, id } = req.query;

        let entry;

        if (id) {
            const entryResult = await db.query(
                `SELECT *, TO_CHAR(date, 'YYYY-MM-DD') as date_str FROM entries WHERE user_id = $1 AND id = $2`,
                [userId, id]
            );
            if (entryResult.rows.length === 0) {
                return res.json({ found: false, error: 'Entry not found' });
            }
            entry = entryResult.rows[0];
        } else {
            if (!date) {
                return res.status(400).json({ error: 'Date is required', found: false });
            }
            // Existing logic to find entry by date and index
            const entryResult = await db.query(
                'SELECT *, TO_CHAR(date, \'YYYY-MM-DD\') as date_str FROM entries WHERE user_id = $1 AND date = $2 AND index = $3',
                [userId, date, parseInt(index)]
            );
            if (entryResult.rows.length === 0) {
                return res.json({ found: false, error: 'Entry not found' });
            }
            entry = entryResult.rows[0];
        }

        // Use date_str for reliable comparison
        const comparisonDate = entry.date_str;

        // Count entries after this date (since we sort DESC, these come before on the page)
        const countNewerQuery = `SELECT COUNT(*) as count FROM entries WHERE user_id = $1 AND date > $2`;
        const countResult = await db.query(countNewerQuery, [userId, comparisonDate]);
        const entriesBefore = parseInt(countResult.rows[0].count);

        // Also count entries on the same date with lower indexes
        const sameDateCountQuery = `SELECT COUNT(*) as count FROM entries WHERE user_id = $1 AND date = $2 AND index < $3`;
        const sameDateResult = await db.query(sameDateCountQuery, [userId, comparisonDate, parseInt(entry.index)]);
        const sameDateBefore = parseInt(sameDateResult.rows[0].count);

        const totalBefore = entriesBefore + sameDateBefore;

        // Calculate page number
        const limitNum = parseInt(limit);
        const page = Math.floor(totalBefore / limitNum) + 1;

        res.json({
            found: true,
            entry,
            page,
            entryId: entry.id
        });
    } catch (err) {
        console.error('Error finding entry by date:', err);
        res.status(500).json({ error: 'Failed to find entry', found: false });
    }
});

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
