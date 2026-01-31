#!/usr/bin/env ts-node
/**
 * Database Check Script
 * Displays current database state for debugging
 */

import { query, closeDatabase } from './lib/db';
import { log, banner, section, table, fmt, summaryBox } from './lib/logger';

async function check(): Promise<void> {
    banner('DATABASE INSPECTOR', 'Viewing current database state');

    try {
        section('Users');
        const users = await query<{
            id: number;
            username: string;
            email: string | null;
            avatar_url: string | null;
            auth_provider: string;
            email_verified: boolean;
            created_at: Date;
        }>(
            'SELECT id, username, email, avatar_url, auth_provider, email_verified, created_at FROM users ORDER BY id',
        );

        if (users.length === 0) {
            log.warning('No users found');
        } else {
            log.info(`Found ${fmt.bold(users.length.toString())} user(s)`);
            table(
                ['ID', 'Username', 'Email', 'Provider', 'Verified'],
                users.map((u) => [
                    u.id,
                    u.username,
                    u.email || '-',
                    u.auth_provider,
                    u.email_verified ? '✓' : '✗',
                ]),
            );
        }

        section('Settings');
        try {
            const settings = await query<{ user_id: number; config_preview: string }>(
                'SELECT user_id, substring(settings::text, 1, 60) as config_preview FROM settings ORDER BY user_id',
            );

            if (settings.length === 0) {
                log.dim('No settings found');
            } else {
                log.info(`Found ${fmt.bold(settings.length.toString())} setting(s)`);
                table(
                    ['User ID', 'Config Preview'],
                    settings.map((s) => [s.user_id, s.config_preview + '...']),
                );
            }
        } catch {
            log.dim('Settings table not available or has different schema');
        }

        section('Diaries');
        const diaries = await query<{
            id: number;
            user_id: number;
            name: string;
            icon: string | null;
            is_default: boolean;
        }>('SELECT id, user_id, name, icon, is_default FROM diaries ORDER BY user_id, id');

        if (diaries.length === 0) {
            log.dim('No diaries found');
        } else {
            log.info(`Found ${fmt.bold(diaries.length.toString())} diary/diaries`);
            table(
                ['ID', 'User ID', 'Name', 'Icon', 'Default'],
                diaries.map((d) => [d.id, d.user_id, d.name, d.icon || '-', d.is_default ? '✓' : '-']),
            );
        }

        section('Entries');
        const entriesCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM entries');
        const entriesByDate = await query<{ date: Date; count: string }>(`
            SELECT date, COUNT(*) as count 
            FROM entries 
            GROUP BY date 
            ORDER BY date DESC 
            LIMIT 10
        `);

        log.info(`Total entries: ${fmt.bold(entriesCount[0].count)}`);

        if (entriesByDate.length > 0) {
            console.log('');
            log.info('Recent entry dates:');
            table(
                ['Date', 'Count'],
                entriesByDate.map((e) => [e.date.toISOString().split('T')[0], e.count]),
            );
        }

        // Tags overview
        const tagsResult = await query<{ tag: string; count: string }>(`
            SELECT unnest(tags) as tag, COUNT(*) as count 
            FROM entries 
            GROUP BY tag 
            ORDER BY count DESC 
            LIMIT 10
        `);

        if (tagsResult.length > 0) {
            console.log('');
            log.info('Top tags:');
            table(
                ['Tag', 'Count'],
                tagsResult.map((t) => [t.tag, t.count]),
            );
        }

        // Summary box
        const totalUsers = users.length;
        const totalDiaries = diaries.length;
        const totalEntries = parseInt(entriesCount[0].count);
        const totalTagsResult = await query<{ count: string }>(
            'SELECT COUNT(*) as count FROM (SELECT DISTINCT unnest(tags) as tag FROM entries) t',
        );
        const totalTags = totalTagsResult[0]?.count || '0';

        summaryBox('Database Overview', [
            ['Users', totalUsers.toString()],
            ['Diaries', totalDiaries.toString()],
            ['Entries', totalEntries.toString()],
            ['Unique Tags', totalTags],
        ]);

        await closeDatabase();
        process.exit(0);
    } catch (e) {
        log.error(`Error: ${(e as Error).message}`);
        console.error(e);
        await closeDatabase();
        process.exit(1);
    }
}

check();
