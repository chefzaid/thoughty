const request = require('supertest');

// Mock the database module before requiring the app
jest.mock('../src/db', () => ({
    query: jest.fn(),
    pool: { query: jest.fn() }
}));

// Mock auth middleware to bypass authentication in tests
jest.mock('../src/middleware/authMiddleware', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { userId: 1, email: 'test@example.com' };
        next();
    },
    optionalAuth: (req, res, next) => {
        req.user = { userId: 1, email: 'test@example.com' };
        next();
    },
    getUserIdFromRequest: (req) => req.user?.userId || null,
    JWT_SECRET: 'test-secret'
}));

const db = require('../src/db');
const app = require('../index');

describe('IO Endpoints (Import/Export)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/io/format', () => {
        it('should return default format settings', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).get('/api/io/format');

            expect(res.status).toBe(200);
            expect(res.body.entrySeparator).toBeDefined();
            expect(res.body.sameDaySeparator).toBeDefined();
            expect(res.body.dateFormat).toBe('YYYY-MM-DD');
        });

        it('should return custom format settings', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { key: 'io_dateFormat', value: 'DD/MM/YYYY' },
                    { key: 'io_tagSeparator', value: ';' }
                ]
            });

            const res = await request(app).get('/api/io/format');

            expect(res.status).toBe(200);
            expect(res.body.dateFormat).toBe('DD/MM/YYYY');
            expect(res.body.tagSeparator).toBe(';');
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app).get('/api/io/format');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch format settings');
        });
    });

    describe('POST /api/io/format', () => {
        it('should save format settings', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const res = await request(app)
                .post('/api/io/format')
                .send({ dateFormat: 'DD-MM-YYYY', tagSeparator: '|' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.config).toBeDefined();
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app)
                .post('/api/io/format')
                .send({ dateFormat: 'DD-MM-YYYY' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to save format settings');
        });
    });

    describe('GET /api/io/export', () => {
        it('should export entries as text file', async () => {
            // Mock: format settings
            db.query.mockResolvedValueOnce({ rows: [] });
            // Mock: entries
            db.query.mockResolvedValueOnce({
                rows: [
                    { id: 1, user_id: 1, date: '2024-01-01', content: 'Entry 1', tags: ['work'], index: 1 },
                    { id: 2, user_id: 1, date: '2024-01-01', content: 'Entry 2', tags: ['personal'], index: 2 }
                ]
            });

            const res = await request(app).get('/api/io/export');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('text/plain');
            expect(res.headers['content-disposition']).toContain('attachment');
            expect(res.text).toContain('Entry 1');
            expect(res.text).toContain('Entry 2');
        });

        it('should export entries filtered by diary', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            db.query.mockResolvedValueOnce({
                rows: [
                    { id: 1, user_id: 1, date: '2024-01-01', content: 'Diary 1 Entry', tags: ['work'], index: 1, diary_id: 1 }
                ]
            });

            const res = await request(app).get('/api/io/export?diaryId=1');

            expect(res.status).toBe(200);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('diary_id = $2'),
                expect.arrayContaining([1, 1])
            );
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app).get('/api/io/export');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to export entries');
        });
    });

    describe('POST /api/io/preview', () => {
        const sampleFileContent = `
---2024-01-01--[work,personal]
This is a test entry content.

--------------------------------------------------------------------------------

---2024-01-02--[ideas]
Another entry for a different day.

--------------------------------------------------------------------------------
`;

        it('should preview import and detect entries', async () => {
            // Mock: format settings
            db.query.mockResolvedValueOnce({ rows: [] });
            // Mock: existing entries for duplicate check
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/io/preview')
                .send({ content: sampleFileContent });

            expect(res.status).toBe(200);
            expect(res.body.entries).toBeDefined();
            expect(res.body.totalCount).toBeGreaterThan(0);
            expect(res.body.duplicateCount).toBe(0);
        });

        it('should detect duplicates', async () => {
            // Mock: format settings
            db.query.mockResolvedValueOnce({ rows: [] });
            // Mock: existing entries
            db.query.mockResolvedValueOnce({
                rows: [{ date: '2024-01-01', content: 'This is a test entry content.' }]
            });

            const res = await request(app)
                .post('/api/io/preview')
                .send({ content: sampleFileContent });

            expect(res.status).toBe(200);
            expect(res.body.duplicateCount).toBeGreaterThanOrEqual(0);
        });

        it('should return 400 if content is missing', async () => {
            const res = await request(app)
                .post('/api/io/preview')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('File content is required');
        });

        it('should filter by diary when diaryId is provided', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/io/preview')
                .send({ content: sampleFileContent, diaryId: 1 });

            expect(res.status).toBe(200);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('diary_id = $2'),
                expect.arrayContaining([1, 1])
            );
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app)
                .post('/api/io/preview')
                .send({ content: sampleFileContent });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to preview import');
        });
    });

    describe('POST /api/io/import', () => {
        const sampleFileContent = `
---2024-01-01--[work]
This is an imported entry.

--------------------------------------------------------------------------------
`;

        it('should import entries successfully', async () => {
            // Mock: format settings
            db.query.mockResolvedValueOnce({ rows: [] });
            // Mock: existing entries
            db.query.mockResolvedValueOnce({ rows: [] });
            // Mock: default diary
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
            // Mock: count for index
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
            // Mock: insert entry
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/io/import')
                .send({ content: sampleFileContent });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.importedCount).toBeGreaterThan(0);
        });

        it('should skip duplicates when skipDuplicates is true', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            db.query.mockResolvedValueOnce({
                rows: [{ date: '2024-01-01', content: 'This is an imported entry.' }]
            });
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

            const res = await request(app)
                .post('/api/io/import')
                .send({ content: sampleFileContent, skipDuplicates: true });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 400 if content is missing', async () => {
            const res = await request(app)
                .post('/api/io/import')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('File content is required');
        });

        it('should import to specific diary when diaryId provided', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            db.query.mockResolvedValueOnce({ rows: [] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/io/import')
                .send({ content: sampleFileContent, diaryId: 2 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app)
                .post('/api/io/import')
                .send({ content: sampleFileContent });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to import entries');
        });
    });
});
