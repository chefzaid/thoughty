const db = require('../src/db');

// Mock the pg module
jest.mock('pg', () => {
    const mockQuery = jest.fn();
    const mockPool = {
        query: mockQuery
    };
    return { Pool: jest.fn(() => mockPool) };
});

describe('Database Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('query', () => {
        it('should execute a query with parameters', async () => {
            const mockResult = { rows: [{ id: 1, content: 'Test' }] };
            db.pool.query.mockResolvedValue(mockResult);

            const result = await db.query('SELECT * FROM entries WHERE id = $1', [1]);

            expect(db.pool.query).toHaveBeenCalledWith('SELECT * FROM entries WHERE id = $1', [1]);
            expect(result).toEqual(mockResult);
        });

        it('should execute a query without parameters', async () => {
            const mockResult = { rows: [] };
            db.pool.query.mockResolvedValue(mockResult);

            const result = await db.query('SELECT * FROM entries');

            expect(db.pool.query).toHaveBeenCalledWith('SELECT * FROM entries', undefined);
            expect(result).toEqual(mockResult);
        });

        it('should propagate errors from the database', async () => {
            const mockError = new Error('Database connection failed');
            db.pool.query.mockRejectedValue(mockError);

            await expect(db.query('SELECT * FROM entries')).rejects.toThrow('Database connection failed');
        });
    });

    describe('pool', () => {
        it('should export the pool object', () => {
            expect(db.pool).toBeDefined();
            expect(typeof db.pool.query).toBe('function');
        });
    });
});
