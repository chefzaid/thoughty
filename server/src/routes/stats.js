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
 *       - in: query
 *         name: diaryId
 *         schema:
 *           type: integer
 *         description: Optional diary ID to filter stats
 *     responses:
 *       200:
 *         description: Statistics object with counts and breakdowns
 */
router.get('/', async (req, res) => {
    try {
        const userId = getUserId(req);
        const diaryId = req.query.diaryId ? parseInt(req.query.diaryId) : null;

        // Build WHERE clause based on filters
        const baseCondition = 'user_id = $1';
        const diaryCondition = diaryId ? ' AND diary_id = $2' : '';
        const whereClause = baseCondition + diaryCondition;
        const params = diaryId ? [userId, diaryId] : [userId];

        // Total entries count
        const totalResult = await db.query(
            `SELECT COUNT(*) as count FROM entries WHERE ${whereClause}`,
            params
        );
        const totalThoughts = parseInt(totalResult.rows[0].count);

        // Entries per year
        const perYearResult = await db.query(`
            SELECT EXTRACT(YEAR FROM date) as year, COUNT(*) as count
            FROM entries
            WHERE ${whereClause}
            GROUP BY EXTRACT(YEAR FROM date)
            ORDER BY year DESC
        `, params);
        const thoughtsPerYear = {};
        perYearResult.rows.forEach(row => {
            thoughtsPerYear[row.year] = parseInt(row.count);
        });

        // Entries per month
        const perMonthResult = await db.query(`
            SELECT TO_CHAR(date, 'YYYY-MM') as month, COUNT(*) as count
            FROM entries
            WHERE ${whereClause}
            GROUP BY TO_CHAR(date, 'YYYY-MM')
            ORDER BY month DESC
        `, params);
        const thoughtsPerMonth = {};
        perMonthResult.rows.forEach(row => {
            thoughtsPerMonth[row.month] = parseInt(row.count);
        });

        // Entries per tag
        const perTagResult = await db.query(`
            SELECT tag, COUNT(*) as count
            FROM entries, UNNEST(tags) as tag
            WHERE ${whereClause}
            GROUP BY tag
            ORDER BY count DESC
        `, params);
        const thoughtsPerTag = {};
        perTagResult.rows.forEach(row => {
            thoughtsPerTag[row.tag] = parseInt(row.count);
        });

        // Tags per year
        const tagsPerYearResult = await db.query(`
            SELECT EXTRACT(YEAR FROM date) as year, tag, COUNT(*) as count
            FROM entries, UNNEST(tags) as tag
            WHERE ${whereClause}
            GROUP BY EXTRACT(YEAR FROM date), tag
            ORDER BY year DESC, count DESC
        `, params);
        const tagsPerYear = {};
        tagsPerYearResult.rows.forEach(row => {
            const year = row.year;
            if (!tagsPerYear[year]) {
                tagsPerYear[year] = {};
            }
            tagsPerYear[year][row.tag] = parseInt(row.count);
        });

        // Tags per month
        const tagsPerMonthResult = await db.query(`
            SELECT TO_CHAR(date, 'YYYY-MM') as month, tag, COUNT(*) as count
            FROM entries, UNNEST(tags) as tag
            WHERE ${whereClause}
            GROUP BY TO_CHAR(date, 'YYYY-MM'), tag
            ORDER BY month DESC, count DESC
        `, params);
        const tagsPerMonth = {};
        tagsPerMonthResult.rows.forEach(row => {
            const month = row.month;
            if (!tagsPerMonth[month]) {
                tagsPerMonth[month] = {};
            }
            tagsPerMonth[month][row.tag] = parseInt(row.count);
        });

        // Unique tags count
        const uniqueTagsResult = await db.query(`
            SELECT COUNT(DISTINCT tag) as count
            FROM entries, UNNEST(tags) as tag
            WHERE ${whereClause}
        `, params);
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
