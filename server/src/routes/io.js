const express = require('express');
const router = express.Router();
const db = require('../db');
const { getUserId } = require('../utils/auth');
const {
    DEFAULT_FORMAT,
    validateFormatConfig,
    generateTextFile,
    parseTextFile,
    findDuplicates
} = require('../utils/fileConverter');

/**
 * @swagger
 * /api/io/format:
 *   get:
 *     summary: Get current file format settings
 */
router.get('/format', async (req, res) => {
    try {
        const userId = getUserId(req);
        const result = await db.query(
            "SELECT key, value FROM settings WHERE user_id = $1 AND key LIKE 'io_%'",
            [userId]
        );

        const formatConfig = { ...DEFAULT_FORMAT };
        for (const row of result.rows) {
            const key = row.key.replace('io_', '');
            formatConfig[key] = row.value;
        }

        res.json(formatConfig);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch format settings' });
    }
});

/**
 * @swagger
 * /api/io/format:
 *   post:
 *     summary: Save file format settings
 */
router.post('/format', async (req, res) => {
    try {
        const userId = getUserId(req);
        const config = validateFormatConfig(req.body);

        // Upsert each setting
        for (const [key, value] of Object.entries(config)) {
            await db.query(
                `INSERT INTO settings (user_id, key, value) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (user_id, key) DO UPDATE SET value = $3`,
                [userId, `io_${key}`, value]
            );
        }

        res.json({ success: true, config });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save format settings' });
    }
});

/**
 * @swagger
 * /api/io/export:
 *   get:
 *     summary: Export entries as a text file (optionally filtered by diary)
 *     parameters:
 *       - in: query
 *         name: diaryId
 *         schema:
 *           type: integer
 *         description: Optional diary ID to filter export
 */
router.get('/export', async (req, res) => {
    try {
        const userId = getUserId(req);
        const diaryId = req.query.diaryId ? parseInt(req.query.diaryId) : null;

        // Get format settings
        const settingsResult = await db.query(
            "SELECT key, value FROM settings WHERE user_id = $1 AND key LIKE 'io_%'",
            [userId]
        );

        const formatConfig = { ...DEFAULT_FORMAT };
        for (const row of settingsResult.rows) {
            const key = row.key.replace('io_', '');
            formatConfig[key] = row.value;
        }

        // Get entries (optionally filtered by diary)
        let entriesQuery = 'SELECT * FROM entries WHERE user_id = $1';
        let params = [userId];

        if (diaryId) {
            entriesQuery += ' AND diary_id = $2';
            params.push(diaryId);
        }
        entriesQuery += ' ORDER BY date ASC, index ASC';

        const entriesResult = await db.query(entriesQuery, params);

        const textContent = generateTextFile(entriesResult.rows, formatConfig);

        // Set headers for file download
        const diaryLabel = diaryId ? `diary${diaryId}_` : '';
        const filename = `thoughty_${diaryLabel}export_${new Date().toISOString().split('T')[0]}.txt`;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(textContent);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to export entries' });
    }
});

/**
 * @swagger
 * /api/io/preview:
 *   post:
 *     summary: Preview import - parse file and check for duplicates
 */
router.post('/preview', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { content, diaryId } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'File content is required' });
        }

        // Get format settings
        const settingsResult = await db.query(
            "SELECT key, value FROM settings WHERE user_id = $1 AND key LIKE 'io_%'",
            [userId]
        );

        const formatConfig = { ...DEFAULT_FORMAT };
        for (const row of settingsResult.rows) {
            const key = row.key.replace('io_', '');
            formatConfig[key] = row.value;
        }

        // Parse the file content
        const parsedEntries = parseTextFile(content, formatConfig);

        // Get existing entries to check for duplicates (filtered by diary if specified)
        let existingQuery = 'SELECT * FROM entries WHERE user_id = $1';
        let params = [userId];

        if (diaryId) {
            existingQuery += ' AND diary_id = $2';
            params.push(diaryId);
        }

        const existingResult = await db.query(existingQuery, params);

        const duplicates = findDuplicates(parsedEntries, existingResult.rows);

        res.json({
            entries: parsedEntries,
            totalCount: parsedEntries.length,
            duplicates: duplicates.map(d => ({
                date: d.imported.date,
                content: d.imported.content.substring(0, 100) + (d.imported.content.length > 100 ? '...' : '')
            })),
            duplicateCount: duplicates.length
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to preview import' });
    }
});

/**
 * @swagger
 * /api/io/import:
 *   post:
 *     summary: Import entries from parsed content (optionally to a specific diary)
 */
router.post('/import', async (req, res) => {
    try {
        const userId = getUserId(req);
        const { content, skipDuplicates = true, diaryId } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'File content is required' });
        }

        // Get format settings
        const settingsResult = await db.query(
            "SELECT key, value FROM settings WHERE user_id = $1 AND key LIKE 'io_%'",
            [userId]
        );

        const formatConfig = { ...DEFAULT_FORMAT };
        for (const row of settingsResult.rows) {
            const key = row.key.replace('io_', '');
            formatConfig[key] = row.value;
        }

        // Parse the file content
        const parsedEntries = parseTextFile(content, formatConfig);

        // Get existing entries if we need to skip duplicates
        let duplicatesToSkip = new Set();
        if (skipDuplicates) {
            let existingQuery = 'SELECT * FROM entries WHERE user_id = $1';
            let params = [userId];

            if (diaryId) {
                existingQuery += ' AND diary_id = $2';
                params.push(diaryId);
            }

            const existingResult = await db.query(existingQuery, params);
            const duplicates = findDuplicates(parsedEntries, existingResult.rows);
            duplicatesToSkip = new Set(duplicates.map(d =>
                `${d.imported.date}|${d.imported.content.trim()}`
            ));
        }

        // Determine target diary ID (use provided or get default)
        let targetDiaryId = diaryId;
        if (!targetDiaryId) {
            const defaultDiaryResult = await db.query(
                'SELECT id FROM diaries WHERE user_id = $1 AND is_default = true',
                [userId]
            );
            if (defaultDiaryResult.rows.length > 0) {
                targetDiaryId = defaultDiaryResult.rows[0].id;
            }
        }

        let importedCount = 0;
        let skippedCount = 0;

        for (const entry of parsedEntries) {
            const key = `${entry.date}|${entry.content.trim()}`;

            if (skipDuplicates && duplicatesToSkip.has(key)) {
                skippedCount++;
                continue;
            }

            // Get next index for this date (within the target diary)
            const countResult = await db.query(
                'SELECT COUNT(*) FROM entries WHERE user_id = $1 AND date = $2 AND diary_id = $3',
                [userId, entry.date, targetDiaryId]
            );
            const nextIndex = parseInt(countResult.rows[0].count) + 1;

            // Insert the entry
            await db.query(
                `INSERT INTO entries (user_id, date, index, tags, content, visibility, diary_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [userId, entry.date, nextIndex, entry.tags || [], entry.content, 'private', targetDiaryId]
            );

            importedCount++;
        }

        res.json({
            success: true,
            importedCount,
            skippedCount,
            totalProcessed: parsedEntries.length
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to import entries' });
    }
});

module.exports = router;
