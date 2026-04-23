#!/usr/bin/env ts-node
/**
 * Database Migration Script
 * Creates and updates the database schema
 */

import { log, banner, section, summaryBox, fmt } from './lib/logger';
import { query, closeDatabase } from './lib/db';

const createTableQuery = `
-- Create users table first with authentication fields
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    auth_provider VARCHAR(50) DEFAULT 'local',
    provider_id VARCHAR(255),
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns to existing users table if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'password_hash') THEN
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'auth_provider') THEN
        ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50) DEFAULT 'local';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'provider_id') THEN
        ALTER TABLE users ADD COLUMN provider_id VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'avatar_url') THEN
        ALTER TABLE users ADD COLUMN avatar_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'email_verified') THEN
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'reset_token') THEN
        ALTER TABLE users ADD COLUMN reset_token VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'reset_token_expires') THEN
        ALTER TABLE users ADD COLUMN reset_token_expires TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'deleted_at') THEN
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'deletion_reason') THEN
        ALTER TABLE users ADD COLUMN deletion_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'created_at') THEN
        ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'updated_at') THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Create entries table
CREATE TABLE IF NOT EXISTS entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    diary_id INTEGER,
    date DATE NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    visibility VARCHAR(20) DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, key)
);

-- Migrate settings from old config JSONB column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'settings' AND column_name = 'config') THEN
        ALTER TABLE settings DROP COLUMN config;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'key') THEN
        ALTER TABLE settings ADD COLUMN key VARCHAR(100) NOT NULL DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'value') THEN
        ALTER TABLE settings ADD COLUMN value TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- Ensure settings upserts have the required unique index on (user_id, key)
DELETE FROM settings duplicate
USING settings survivor
WHERE duplicate.user_id = survivor.user_id
    AND duplicate.key = survivor.key
    AND duplicate.id < survivor.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_user_id_key_unique
ON settings(user_id, key);

-- Create diaries table
CREATE TABLE IF NOT EXISTS diaries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10),
    visibility VARCHAR(20) DEFAULT 'private',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add visibility column to diaries if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'diaries' AND column_name = 'visibility') THEN
        ALTER TABLE diaries ADD COLUMN visibility VARCHAR(20) DEFAULT 'private';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'diaries' AND column_name = 'color') THEN
        ALTER TABLE diaries ADD COLUMN color VARCHAR(7);
    END IF;
END $$;

-- Add diary_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'entries' AND column_name = 'diary_id') THEN
        ALTER TABLE entries ADD COLUMN diary_id INTEGER REFERENCES diaries(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'entries' AND column_name = 'index') THEN
        ALTER TABLE entries ADD COLUMN "index" INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'entries' AND column_name = 'format') THEN
        ALTER TABLE entries ADD COLUMN format VARCHAR(20) DEFAULT 'plain';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'entries' AND column_name = 'is_favorite') THEN
        ALTER TABLE entries ADD COLUMN is_favorite BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'diaries' AND column_name = 'position') THEN
        ALTER TABLE diaries ADD COLUMN position INTEGER DEFAULT 0;
    END IF;
END $$;

-- Backfill diary colors for existing rows
UPDATE diaries
SET color = CASE MOD(COALESCE(position, 0), 8)
    WHEN 0 THEN '#E76F51'
    WHEN 1 THEN '#2A9D8F'
    WHEN 2 THEN '#3A86FF'
    WHEN 3 THEN '#F4A261'
    WHEN 4 THEN '#D62828'
    WHEN 5 THEN '#6A994E'
    WHEN 6 THEN '#8C5E58'
    ELSE '#264653'
END
WHERE color IS NULL;

-- Create refresh_tokens table for JWT refresh token rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rename token_hash to token if the old column exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'refresh_tokens' AND column_name = 'token_hash') THEN
        ALTER TABLE refresh_tokens RENAME COLUMN token_hash TO token;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_visibility ON entries(visibility);
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_diary_id ON entries(diary_id);
CREATE INDEX IF NOT EXISTS idx_entries_is_favorite ON entries(is_favorite);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_diaries_user_id ON diaries(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mimetype VARCHAR(100) NOT NULL,
    size INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_entry_id ON attachments(entry_id);

-- Create entry_revisions table for modification history
CREATE TABLE IF NOT EXISTS entry_revisions (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    tags TEXT,
    date VARCHAR(10) NOT NULL,
    format VARCHAR(20) DEFAULT 'plaintext',
    visibility VARCHAR(20) DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entry_revisions_entry_id ON entry_revisions(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_revisions_user_id ON entry_revisions(user_id);
`;

async function migrate(): Promise<void> {
    const startTime = Date.now();

    banner('DATABASE MIGRATIONS', 'Applying schema changes');

    try {
        section('Running Migrations');
        log.step('Applying database schema...');

        await query(createTableQuery);

        log.success('Schema applied successfully');

        // Get table info
        const tables = await query<{ table_name: string }>(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        const duration = Date.now() - startTime;

        summaryBox('Migration Complete', [
            ['Status', fmt.green('Success')],
            ['Tables', tables.map((t) => t.table_name).join(', ')],
            ['Duration', `${duration}ms`],
        ]);

        await closeDatabase();
        process.exit(0);
    } catch (err) {
        log.error(`Migration failed: ${(err as Error).message}`);
        console.error(err);
        await closeDatabase();
        process.exit(1);
    }
}

migrate();
