const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'journal',
    password: process.env.POSTGRES_PASSWORD || 'password',
    port: process.env.POSTGRES_PORT || 5432,
};
const pool = new Pool(dbConfig);

async function run() {
    try {
        // 1. Find the 2020 entry we created
        const res = await pool.query("SELECT * FROM entries WHERE date = '2020-01-01' LIMIT 1");
        if (res.rows.length === 0) {
            console.log("Entry 2020-01-01 not found");
            return;
        }
        const entry = res.rows[0];
        console.log("Found Entry:", { id: entry.id, date: entry.date, typeofDate: typeof entry.date });

        // 2. Run the count query exactly as in entries.js
        const countNewerQuery = `SELECT COUNT(*) as count FROM entries WHERE user_id = $1 AND date > $2`;
        // const countResult = await pool.query(countNewerQuery, [entry.user_id, entry.date]);
        // Note: entries.js uses entry.date directly from the object.

        // Let's test with the Date object directly
        const countResult = await pool.query(countNewerQuery, [entry.user_id, entry.date]);

        console.log("Count Newer (Using Date Object):", countResult.rows[0].count);

        // 3. Test with string cast
        const countResultString = await pool.query(countNewerQuery, [entry.user_id, entry.date.toISOString()]);
        console.log("Count Newer (Using ISO String):", countResultString.rows[0].count);

        // 4. Test with formatted string
        const d = new Date(entry.date);
        const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
        const countResultFmt = await pool.query(countNewerQuery, [entry.user_id, dateStr]);
        console.log("Count Newer (Using YYYY-MM-DD):", countResultFmt.rows[0].count);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

run();
