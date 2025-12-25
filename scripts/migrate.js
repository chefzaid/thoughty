const db = require('../server/src/db');

const createTableQuery = `
CREATE TABLE IF NOT EXISTS entries (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    index INTEGER NOT NULL,
    tags TEXT[] DEFAULT '{}',
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_tags ON entries USING GIN(tags);
`;

async function migrate() {
    try {
        console.log('Running migrations...');
        await db.query(createTableQuery);
        console.log('Migrations completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();

