#!/usr/bin/env ts-node
/**
 * Database Nuke Script
 * Drops all tables and re-creates the schema, then seeds with test data
 * WARNING: This is a destructive operation!
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import { query, closeDatabase, initializeDatabase } from './lib/db';
import { log, banner, section, summaryBox, fmt } from './lib/logger';

// Check for flags
const forceFlag = process.argv.includes('--force') || process.argv.includes('-f');
const entriesOnlyFlag = process.argv.includes('--entries-only') || process.argv.includes('-e');

async function confirmNuke(): Promise<boolean> {
    if (forceFlag) {
        return true;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        console.log('');
        if (entriesOnlyFlag) {
            log.warning('This will PERMANENTLY DELETE all entries in the database!');
        } else {
            log.warning('This will PERMANENTLY DELETE all data in the database!');
        }
        console.log('');
        rl.question(`  ${fmt.bold('Type "nuke" to confirm:')} `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'nuke');
        });
    });
}

async function dropAllTables(): Promise<void> {
    log.step('Dropping all tables...');

    // Drop tables in correct order (respecting foreign keys)
    const tables = ['entries', 'settings', 'diaries', 'refresh_tokens', 'users'];

    for (const table of tables) {
        try {
            await query(`DROP TABLE IF EXISTS ${table} CASCADE`);
            log.bullet(`Dropped ${fmt.dim(table)}`);
        } catch (err) {
            log.warning(`Could not drop ${table}: ${(err as Error).message}`);
        }
    }

    log.success('All tables dropped');
}

async function clearEntriesOnly(): Promise<void> {
    log.step('Clearing all entries...');

    try {
        // Get count first, then delete
        const countResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM entries');
        const count = Number.parseInt(countResult[0]?.count || '0', 10);
        await query('DELETE FROM entries');
        log.success(`Deleted ${count} entries`);
    } catch (err) {
        log.warning(`Could not clear entries: ${(err as Error).message}`);
        throw err;
    }
}

async function runMigration(): Promise<void> {
    log.step('Running migrations...');

    return new Promise((resolve, reject) => {
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const child = spawn(npmCmd, ['run', 'db:migrate'], {
            cwd: path.resolve(__dirname, '..'),
            shell: true,
            stdio: 'pipe',
        });

        let output = '';
        child.stdout.on('data', (data) => {
            output += data.toString();
        });
        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                log.success('Migrations completed');
                resolve();
            } else {
                log.error(`Migration failed with code ${code}`);
                console.log(output);
                reject(new Error('Migration failed'));
            }
        });
    });
}

async function runSeed(): Promise<void> {
    log.step('Seeding database...');

    return new Promise((resolve, reject) => {
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const child = spawn(npmCmd, ['run', 'db:seed'], {
            cwd: path.resolve(__dirname, '..'),
            shell: true,
            stdio: 'inherit', // Show seed output directly
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Seed failed with code ${code}`));
            }
        });
    });
}

async function nuke(): Promise<void> {
    if (entriesOnlyFlag) {
        banner('💣 ENTRIES NUKE', 'Delete all entries from database');
    } else {
        banner('💣 DATABASE NUKE', 'Complete database reset and reseed');
    }

    const startTime = Date.now();

    // Confirmation prompt
    const confirmed = await confirmNuke();
    if (!confirmed) {
        log.info('Operation cancelled');
        process.exit(0);
    }

    console.log('');

    try {
        if (entriesOnlyFlag) {
            // Entries-only mode: just delete entries
            section('Step 1: Clear Entries');
            await initializeDatabase();
            await clearEntriesOnly();
            await closeDatabase();

            const duration = Date.now() - startTime;

            summaryBox('🎉 ENTRIES NUKED SUCCESSFULLY', [
                ['Status', fmt.green('Complete')],
                ['Duration', `${Math.round(duration / 1000)}s`],
                ['Entries', 'Deleted'],
            ]);
        } else {
            // Full nuke mode: drop all tables, migrate, and seed
            section('Step 1: Drop Tables');
            await initializeDatabase();
            await dropAllTables();
            await closeDatabase();

            section('Step 2: Run Migrations');
            await runMigration();

            section('Step 3: Seed Test Data');
            await runSeed();

            const duration = Date.now() - startTime;

            summaryBox('🎉 DATABASE NUKED SUCCESSFULLY', [
                ['Status', fmt.green('Complete')],
                ['Duration', `${Math.round(duration / 1000)}s`],
                ['Tables', 'Recreated'],
                ['Data', 'Seeded'],
            ]);
        }

        process.exit(0);
    } catch (err) {
        log.error(`Nuke failed: ${(err as Error).message}`);
        console.error(err);
        await closeDatabase();
        process.exit(1);
    }
}

nuke();
