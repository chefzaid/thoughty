/**
 * Database connection utilities for scripts
 * Uses TypeORM DataSource for connecting to PostgreSQL
 */

import { DataSource, type QueryRunner } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'node:path';
import { buildPostgresPoolOptions } from '../../src/database/postgres-pool-options';

// Load environment variables from thoughty-server/.env
config({ path: join(__dirname, '..', '..', '.env') });

// Create a simple DataSource for scripts (without entities for raw SQL)
export const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    database: process.env.POSTGRES_DB || 'journal',
    extra: buildPostgresPoolOptions(process.env),
    synchronize: false,
    logging: false,
});

/**
 * Initialize the database connection
 */
export async function initializeDatabase(): Promise<DataSource> {
    if (!dataSource.isInitialized) {
        await dataSource.initialize();
    }
    return dataSource;
}

/**
 * Execute a raw SQL query
 */
export async function query<T = unknown>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    if (activeRunner) {
        return activeRunner.query(sql, parameters);
    }
    const ds = await initializeDatabase();
    return ds.query(sql, parameters);
}

let activeRunner: QueryRunner | null = null;

/**
 * Run fn in one database transaction: every query() inside it uses the same
 * connection, and any error rolls everything back.
 */
export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    const runner = (await initializeDatabase()).createQueryRunner();
    await runner.startTransaction();
    activeRunner = runner;
    try {
        const result = await fn();
        await runner.commitTransaction();
        return result;
    } catch (error) {
        await runner.rollbackTransaction();
        throw error;
    } finally {
        activeRunner = null;
        await runner.release();
    }
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
    if (dataSource.isInitialized) {
        await dataSource.destroy();
    }
}

/**
 * Execute a function with automatic connection cleanup
 */
export async function withDatabase<T>(fn: (ds: DataSource) => Promise<T>): Promise<T> {
    try {
        await initializeDatabase();
        return await fn(dataSource);
    } finally {
        await closeDatabase();
    }
}

export default { dataSource, initializeDatabase, query, closeDatabase, withDatabase };
