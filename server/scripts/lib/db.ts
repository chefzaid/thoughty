/**
 * Database connection utilities for scripts
 * Uses TypeORM DataSource for connecting to PostgreSQL
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from server/.env
config({ path: join(__dirname, '..', '..', '.env') });

// Create a simple DataSource for scripts (without entities for raw SQL)
export const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    database: process.env.POSTGRES_DB || 'journal',
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
export async function query<T = any>(sql: string, parameters: any[] = []): Promise<T[]> {
    const ds = await initializeDatabase();
    return ds.query(sql, parameters);
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
