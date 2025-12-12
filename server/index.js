const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');

const compression = require('compression');

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const PORT = 3001;

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Journal API',
            version: '1.0.0',
            description: 'API for Managing Journal Entries',
        },
        servers: [
            {
                url: 'http://localhost:3001',
            },
        ],
    },
    apis: ['./index.js'], // files containing annotations as above
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use(compression());
app.use(cors());
app.use(bodyParser.json());



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
 *     responses:
 *       200:
 *         description: A list of entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entries:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 allTags:
 *                   type: array
 *                   items:
 *                     type: string
 */
app.get('/api/entries', async (req, res) => {
    try {
        const { search, tags, date, page = 1, limit = 10 } = req.query;

        let query = 'SELECT * FROM entries WHERE 1=1';
        const params = [];
        let paramCount = 1;

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

        // Get all tags for the filter
        const tagsResult = await db.query('SELECT DISTINCT UNNEST(tags) as tag FROM entries');
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Entry created successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
app.post('/api/entries', async (req, res) => {
    const { text, tags, date } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }

    try {
        let dateStr;
        if (date) {
            dateStr = date;
        } else {
            const now = new Date();
            dateStr = now.toISOString().split('T')[0];
        }

        // Calculate next index for the day
        const countResult = await db.query('SELECT COUNT(*) FROM entries WHERE date = $1', [dateStr]);
        const nextIndex = parseInt(countResult.rows[0].count) + 1;

        const query = `
            INSERT INTO entries (date, index, tags, content)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const values = [dateStr, nextIndex, tags || [], text];

        await db.query(query, values);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create entry' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
