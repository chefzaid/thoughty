#!/usr/bin/env ts-node
import dataSource from '../src/database/data-source';
import { banner, fmt, log, section, summaryBox } from './lib/logger';

async function migrate(): Promise<void> {
    const startTime = Date.now();

    banner('DATABASE MIGRATIONS', 'Applying pending versioned migrations');

    try {
        section('Running Migrations');
        log.step('Checking migration history...');

        await dataSource.initialize();
        const applied = await dataSource.runMigrations({ transaction: 'all' });

        if (applied.length === 0) {
            log.success('Database schema is already current');
        } else {
            log.success(`Applied ${applied.length} migration${applied.length === 1 ? '' : 's'}`);
        }

        summaryBox('Migration Complete', [
            ['Status', fmt.green('Success')],
            ['Applied', applied.length === 0 ? 'None' : applied.map((migration) => migration.name).join(', ')],
            ['Duration', `${Date.now() - startTime}ms`],
        ]);
    } catch (error) {
        log.error(`Migration failed: ${(error as Error).message}`);
        console.error(error);
        process.exitCode = 1;
    } finally {
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    }
}

void migrate();
