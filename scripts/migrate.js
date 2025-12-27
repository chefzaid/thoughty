const db = require('../server/src/db');

const createTableQuery = `
-- Create users table first
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default user if not exists
INSERT INTO users (id, username, email)
VALUES (1, 'default', 'default@example.com')
ON CONFLICT (id) DO NOTHING;

-- Ensure the sequence is updated
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));

CREATE TABLE IF NOT EXISTS entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    index INTEGER NOT NULL,
    tags TEXT[] DEFAULT '{}',
    content TEXT NOT NULL,
    visibility VARCHAR(20) DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, key)
);

-- Add visibility column to existing entries table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'entries' AND column_name = 'visibility') THEN
        ALTER TABLE entries ADD COLUMN visibility VARCHAR(20) DEFAULT 'private';
    END IF;
END $$;

-- Add user_id column to existing entries table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'entries' AND column_name = 'user_id') THEN
        ALTER TABLE entries ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        -- Assign existing entries to default user
        UPDATE entries SET user_id = 1 WHERE user_id IS NULL;
    END IF;
END $$;

-- Add user_id column to existing settings table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'user_id') THEN
        ALTER TABLE settings ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        -- Assign existing settings to default user
        UPDATE settings SET user_id = 1 WHERE user_id IS NULL;
        -- Drop old unique constraint on key only
        ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;
        -- Add new unique constraint on user_id + key
        ALTER TABLE settings ADD CONSTRAINT settings_user_key_unique UNIQUE(user_id, key);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_tags ON entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_entries_visibility ON entries(visibility);
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
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

