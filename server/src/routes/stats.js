const express = require('express');
const router = express.Router();
const db = require('../db');
const { getUserId } = require('../utils/auth');

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Retrieve aggregated statistics about journal entries
 *     parameters:
 *       - in: header
 *         name: x-user-id
 *         schema:
 *           type: integer
 *         description: User ID (defaults to 1)
 *     responses:
 *       200:
 *         description: Statistics object with counts and breakdowns
 */
router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req);

        // Total thoughts count (user-specific)
        const totalResult = await db.query(
            'SELECT COUNT(*) as count FROM entries WHERE user_id = $1',
            [userId]
        );
        const totalThoughts = parseInt(totalResult.rows[0].count);

        // Thoughts per year (user-specific)
        const perYearResult = await db.query(`
            SELECT EXTRACT(YEAR FROM date) as year, COUNT(*) as count
            FROM entries
            WHERE user_id = $1
            GROUP BY EXTRACT(YEAR FROM date)
            ORDER BY year DESC
        `, [userId]);
        const thoughtsPerYear = {};
        perYearResult.rows.forEach(row => {
            thoughtsPerYear[row.year] = parseInt(row.count);
        });

        // Thoughts per month (user-specific)
        const perMonthResult = await db.query(`
            SELECT TO_CHAR(date, 'YYYY-MM') as month, COUNT(*) as count
            FROM entries
            WHERE user_id = $1
            GROUP BY TO_CHAR(date, 'YYYY-MM')
            ORDER BY month DESC
        `, [userId]);
        const thoughtsPerMonth = {};
        perMonthResult.rows.forEach(row => {
            thoughtsPerMonth[row.month] = parseInt(row.count);
        });

        // Thoughts per tag (user-specific)
        const perTagResult = await db.query(`
            SELECT tag, COUNT(*) as count
            FROM entries, UNNEST(tags) as tag
            WHERE user_id = $1
            GROUP BY tag
            ORDER BY count DESC
        `, [userId]);
        const thoughtsPerTag = {};
        perTagResult.rows.forEach(row => {
            thoughtsPerTag[row.tag] = parseInt(row.count);
        });

        // Tags per year (user-specific)
        const tagsPerYearResult = await db.query(`
            SELECT EXTRACT(YEAR FROM date) as year, tag, COUNT(*) as count
            FROM entries, UNNEST(tags) as tag
            WHERE user_id = $1
            GROUP BY EXTRACT(YEAR FROM date), tag
            ORDER BY year DESC, count DESC
        `, [userId]);
        const tagsPerYear = {};
        tagsPerYearResult.rows.forEach(row => {
            const year = row.year;
            if (!tagsPerYear[year]) {
                tagsPerYear[year] = {};
            }
            tagsPerYear[year][row.tag] = parseInt(row.count);
        });

        // Tags per month (user-specific)
        const tagsPerMonthResult = await db.query(`
            SELECT TO_CHAR(date, 'YYYY-MM') as month, tag, COUNT(*) as count
            FROM entries, UNNEST(tags) as tag
            WHERE user_id = $1
            GROUP BY TO_CHAR(date, 'YYYY-MM'), tag
            ORDER BY month DESC, count DESC
        `, [userId]);
        const tagsPerMonth = {};
        tagsPerMonthResult.rows.forEach(row => {
            const month = row.month;
            if (!tagsPerMonth[month]) {
                tagsPerMonth[month] = {};
            }
            tagsPerMonth[month][row.tag] = parseInt(row.count);
        });

        // Unique tags count (user-specific)
        const uniqueTagsResult = await db.query(`
            SELECT COUNT(DISTINCT tag) as count
            FROM entries, UNNEST(tags) as tag
            WHERE user_id = $1
        `, [userId]);
        const uniqueTagsCount = parseInt(uniqueTagsResult.rows[0].count);

        res.json({
            totalThoughts,
            uniqueTagsCount,
            thoughtsPerYear,
            thoughtsPerMonth,
            thoughtsPerTag,
            tagsPerYear,
            tagsPerMonth
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;
