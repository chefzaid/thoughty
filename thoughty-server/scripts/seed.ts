#!/usr/bin/env ts-node
/**
 * Database Seeding Script
 * Seeds the database with test data from test_data.txt
 */

import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { query, closeDatabase } from './lib/db';
import { log, banner, section, summaryBox, fmt, table } from './lib/logger';

const TEST_DATA_FILE = path.join(__dirname, '..', 'data', 'test_data.txt');

// Default credentials for seeded data
const DEFAULT_USER_ID = 1;
const DEFAULT_EMAIL = 'test@example.com';
const DEFAULT_USERNAME = 'test';
const DEFAULT_PASSWORD = 'Test1234!';

interface Entry {
    date: string;
    index: number;
    tags: string[];
    content: string;
}

/**
 * Parse the test data file
 * Format:
 *   ---YYYY-MM-DD--[tag1,tag2] for first entry of a day
 *   ---N--[tag1,tag2] for subsequent entries (N = 2, 3, 4...)
 *   Content follows on the next line
 *   Entries on same day separated by: ********************************************************************************
 *   Days separated by: --------------------------------------------------------------------------------
 */
function parseTestData(content: string): Entry[] {
    const entries: Entry[] = [];
    const lines = content.split('\n');

    let currentDate: string | null = null;
    let currentIndex = 0;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();

        // Check for date entry: ---YYYY-MM-DD--[tags]
        const dateMatch = line.match(/^---(\d{4})-(\d{2})-(\d{2})--\[([^\]]*)\]$/);
        if (dateMatch) {
            const [, year, month, day, tagsStr] = dateMatch;
            currentDate = `${year}-${month}-${day}`;
            currentIndex = 1;
            const tags = tagsStr
                .split(',')
                .map((t) => t.trim())
                .filter((t) => t);

            // Get content from following lines until separator
            i++;
            const contentLines: string[] = [];
            while (i < lines.length) {
                const nextLine = lines[i];
                if (
                    nextLine.trim().startsWith('---') ||
                    nextLine.trim().startsWith('********************************************************************************') ||
                    nextLine.trim().startsWith('--------------------------------------------------------------------------------')
                ) {
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
                    content: contentLines.join('\n'),
                });
            }
            continue;
        }

        // Check for numbered entry: ---N--[tags]
        const numMatch = line.match(/^---(\d+)--\[([^\]]*)\]$/);
        if (numMatch && currentDate) {
            const [, num, tagsStr] = numMatch;
            currentIndex = parseInt(num);
            const tags = tagsStr
                .split(',')
                .map((t) => t.trim())
                .filter((t) => t);

            // Get content from following lines until separator
            i++;
            const contentLines: string[] = [];
            while (i < lines.length) {
                const nextLine = lines[i];
                if (
                    nextLine.trim().startsWith('---') ||
                    nextLine.trim().startsWith('********************************************************************************') ||
                    nextLine.trim().startsWith('--------------------------------------------------------------------------------')
                ) {
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
                    content: contentLines.join('\n'),
                });
            }
            continue;
        }

        i++;
    }

    return entries;
}

async function ensureDefaultUser(): Promise<void> {
    log.step('Ensuring default user exists...');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, saltRounds);

    await query(
        `
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
    `,
        [DEFAULT_USER_ID, DEFAULT_USERNAME, DEFAULT_EMAIL, passwordHash],
    );

    log.success('Default user ready');
}

async function clearEntries(): Promise<void> {
    log.step('Clearing existing entries...');
    await query('DELETE FROM entries');
    log.success('Entries cleared');
}

async function seed(): Promise<void> {
    const startTime = Date.now();

    banner('DATABASE SEEDER', 'Populating database with test data');

    try {
        // Check if test data file exists
        if (!fs.existsSync(TEST_DATA_FILE)) {
            log.warning(`Test data file not found: ${TEST_DATA_FILE}`);
            log.info('Creating empty test data file...');

            // Create the directory if it doesn't exist
            const dataDir = path.dirname(TEST_DATA_FILE);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Create a sample test data file
            const sampleData = `---2024-01-15--[reflection,goals]
Starting the new year with fresh perspectives and ambitious goals.

--------------------------------------------------------------------------------

---2024-01-16--[daily,work]
Productive day at work. Made progress on the main project.

********************************************************************************

---2--[evening,thoughts]
Reflecting on the day's achievements. Feeling accomplished.

--------------------------------------------------------------------------------

---2024-01-17--[ideas,creativity]
Had a breakthrough idea today. Need to explore it further tomorrow.
`;
            fs.writeFileSync(TEST_DATA_FILE, sampleData, 'utf-8');
            log.success('Sample test data file created');
        }

        section('Reading Test Data');
        log.step('Parsing test data file...');
        const content = fs.readFileSync(TEST_DATA_FILE, 'utf-8');
        const entries = parseTestData(content);
        log.success(`Found ${fmt.bold(entries.length.toString())} entries to insert`);

        section('Database Setup');
        await ensureDefaultUser();
        await clearEntries();

        section('Inserting Entries');
        log.step(`Inserting ${entries.length} entries...`);

        for (const entry of entries) {
            await query(
                'INSERT INTO entries (user_id, date, index, tags, content) VALUES ($1, $2, $3, $4, $5)',
                [DEFAULT_USER_ID, entry.date, entry.index, entry.tags, entry.content],
            );
        }

        log.success(`Successfully seeded ${fmt.bold(entries.length.toString())} entries`);

        section('Summary');

        // Get entries per date
        const dateResult = await query<{ date: Date; count: string }>(
            'SELECT date, COUNT(*) as count FROM entries GROUP BY date ORDER BY date',
        );
        const dateData: [string, string][] = dateResult.map((row) => [
            row.date.toISOString().split('T')[0],
            `${row.count} entries`,
        ]);

        if (dateData.length > 0) {
            console.log('');
            log.info('Entries per date:');
            table(['Date', 'Count'], dateData);
        }

        // Get unique tags
        const tagsResult = await query<{ tag: string }>(
            'SELECT DISTINCT unnest(tags) as tag FROM entries ORDER BY tag',
        );
        const uniqueTags = tagsResult.map((r) => r.tag);

        console.log('');
        log.info(`Unique tags (${uniqueTags.length}): ${fmt.cyan(uniqueTags.join(', '))}`);

        const duration = Date.now() - startTime;

        summaryBox('Seed Complete', [
            ['Entries', entries.length.toString()],
            ['Dates', dateData.length.toString()],
            ['Tags', uniqueTags.length.toString()],
            ['Duration', `${duration}ms`],
            ['User', `${DEFAULT_USERNAME} (${DEFAULT_EMAIL})`],
        ]);

        await closeDatabase();
        process.exit(0);
    } catch (err) {
        log.error(`Seeding failed: ${(err as Error).message}`);
        console.error(err);
        await closeDatabase();
        process.exit(1);
    }
}

seed();
