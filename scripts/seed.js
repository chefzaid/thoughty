const fs = require('fs');
const path = require('path');
const db = require('../server/src/db');
// Seed runs from repo root where bcryptjs isn't installed, so load it from the server's deps.
// This keeps the root package.json dependency-free.
const bcrypt = require('../server/node_modules/bcryptjs');

const TEST_DATA_FILE = path.join(__dirname, '..', 'server', 'data', 'test_data.txt');

// Default user ID for seeded data
const DEFAULT_USER_ID = 1;

// Default credentials for seeded data
const DEFAULT_EMAIL = 'test@example.com';
const DEFAULT_USERNAME = 'test';
const DEFAULT_PASSWORD = 'Test1234!';

/**
 * Parse the test data file in the same format as thoughts.txt
 * Format:
 *   ---YYYY.MM.DD--[tag1,tag2] for first entry of a day
 *   ---N--[tag1,tag2] for subsequent entries (N = 2, 3, 4...)
 *   Content follows on the next line
 *   Entries on same day separated by: ********************************************************************************
 *   Days separated by: --------------------------------------------------------------------------------
 */
function parseTestData(content) {
    const entries = [];
    const lines = content.split('\n');

    let currentDate = null;
    let currentIndex = 0;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        // Check for date entry: ---YYYY.MM.DD--[tags]
        const dateMatch = line.match(/^---(\d{4})\.(\d{2})\.(\d{2})--\[([^\]]*)\]$/);
        if (dateMatch) {
            const [, year, month, day, tagsStr] = dateMatch;
            currentDate = `${year}-${month}-${day}`;
            currentIndex = 1;
            const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);

            // Get content from following lines until separator
            i++;
            let contentLines = [];
            while (i < lines.length) {
                const nextLine = lines[i];
                if (nextLine.trim().startsWith('---') ||
                    nextLine.trim().startsWith('********************************************************************************') ||
                    nextLine.trim().startsWith('--------------------------------------------------------------------------------')) {
                    break;
                }
                if (nextLine.trim()) {
                    contentLines.push(nextLine.trim());
                }
                i++;
            }

            if (contentLines.length > 0) {
                entries.push({
                    date: currentDate,
                    index: currentIndex,
                    tags: tags,
                    content: contentLines.join('\n')
                });
            }
            continue;
        }

        // Check for numbered entry: ---N--[tags]
        const numMatch = line.match(/^---(\d+)--\[([^\]]*)\]$/);
        if (numMatch && currentDate) {
            const [, num, tagsStr] = numMatch;
            currentIndex = parseInt(num); // Keep as 1-indexed
            const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);

            // Get content from following lines until separator
            i++;
            let contentLines = [];
            while (i < lines.length) {
                const nextLine = lines[i];
                if (nextLine.trim().startsWith('---') ||
                    nextLine.trim().startsWith('********************************************************************************') ||
                    nextLine.trim().startsWith('--------------------------------------------------------------------------------')) {
                    break;
                }
                if (nextLine.trim()) {
                    contentLines.push(nextLine.trim());
                }
                i++;
            }

            if (contentLines.length > 0) {
                entries.push({
                    date: currentDate,
                    index: currentIndex,
                    tags: tags,
                    content: contentLines.join('\n')
                });
            }
            continue;
        }

        i++;
    }

    return entries;
}

async function ensureDefaultUser() {
    console.log('Ensuring default user exists...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, saltRounds);

    await db.query(`
        INSERT INTO users (id, username, email, password_hash, auth_provider, email_verified)
        VALUES ($1, $2, $3, $4, 'local', true)
        ON CONFLICT (id)
        DO UPDATE SET
            username = EXCLUDED.username,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            auth_provider = 'local',
            email_verified = true,
            updated_at = CURRENT_TIMESTAMP
    `, [DEFAULT_USER_ID, DEFAULT_USERNAME, DEFAULT_EMAIL, passwordHash]);
    console.log('Default user ready.');
}

async function clearEntries() {
    console.log('Clearing existing entries...');
    await db.query('DELETE FROM entries');
    console.log('Entries cleared.');
}

async function seed() {
    try {
        console.log('Reading test data file...');
        const content = fs.readFileSync(TEST_DATA_FILE, 'utf-8');

        console.log('Parsing test data...');
        const entries = parseTestData(content);
        console.log(`Found ${entries.length} entries to insert.`);

        // Ensure default user exists
        await ensureDefaultUser();

        // Clear existing entries first
        await clearEntries();

        console.log('Inserting entries...');
        for (const entry of entries) {
            await db.query(
                'INSERT INTO entries (user_id, date, index, tags, content) VALUES ($1, $2, $3, $4, $5)',
                [DEFAULT_USER_ID, entry.date, entry.index, entry.tags, entry.content]
            );
        }

        console.log(`Successfully seeded ${entries.length} entries!`);

        // Print summary
        const result = await db.query('SELECT date, COUNT(*) as count FROM entries GROUP BY date ORDER BY date');
        console.log('\nEntries per date:');
        for (const row of result.rows) {
            console.log(`  ${row.date.toISOString().split('T')[0]}: ${row.count} entries`);
        }

        // Print unique tags
        const tagsResult = await db.query('SELECT DISTINCT unnest(tags) as tag FROM entries ORDER BY tag');
        console.log(`\nUnique tags (${tagsResult.rows.length}):`, tagsResult.rows.map(r => r.tag).join(', '));

        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
}

seed();

