const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Retrieve aggregated statistics about journal entries
 *     responses:
 *       200:
 *         description: Statistics object with counts and breakdowns
 */
router.get('/', async (req, res) => {
    try {
        // Total thoughts count
        const totalResult = await db.query('SELECT COUNT(*) as count FROM entries');
        const totalThoughts = parseInt(totalResult.rows[0].count);

        // Thoughts per year
        const perYearResult = await db.query(`
            SELECT EXTRACT(YEAR FROM date) as year, COUNT(*) as count
            FROM entries
            GROUP BY EXTRACT(YEAR FROM date)
            ORDER BY year DESC
        `);
        const thoughtsPerYear = {};
        perYearResult.rows.forEach(row => {
            thoughtsPerYear[row.year] = parseInt(row.count);
        });

        // Thoughts per month (year-month format)
        const perMonthResult = await db.query(`
            SELECT TO_CHAR(date, 'YYYY-MM') as month, COUNT(*) as count
            FROM entries
            GROUP BY TO_CHAR(date, 'YYYY-MM')
            ORDER BY month DESC
        `);
        const thoughtsPerMonth = {};
        perMonthResult.rows.forEach(row => {
            thoughtsPerMonth[row.month] = parseInt(row.count);
        });

        // Thoughts per tag
        const perTagResult = await db.query(`
            SELECT tag, COUNT(*) as count
            FROM entries, UNNEST(tags) as tag
            GROUP BY tag
            ORDER BY count DESC
        `);
        const thoughtsPerTag = {};
        perTagResult.rows.forEach(row => {
            thoughtsPerTag[row.tag] = parseInt(row.count);
        });

        // Tags per year (breakdown of tag usage by year)
        const tagsPerYearResult = await db.query(`
            SELECT EXTRACT(YEAR FROM date) as year, tag, COUNT(*) as count
            FROM entries, UNNEST(tags) as tag
            GROUP BY EXTRACT(YEAR FROM date), tag
            ORDER BY year DESC, count DESC
        `);
        const tagsPerYear = {};
        tagsPerYearResult.rows.forEach(row => {
            const year = row.year;
            if (!tagsPerYear[year]) {
                tagsPerYear[year] = {};
            }
            tagsPerYear[year][row.tag] = parseInt(row.count);
        });

        // Tags per month (breakdown of tag usage by month)
        const tagsPerMonthResult = await db.query(`
            SELECT TO_CHAR(date, 'YYYY-MM') as month, tag, COUNT(*) as count
            FROM entries, UNNEST(tags) as tag
            GROUP BY TO_CHAR(date, 'YYYY-MM'), tag
            ORDER BY month DESC, count DESC
        `);
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
        `);
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
