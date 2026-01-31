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

describe('Diaries Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/diaries', () => {
        it('should return all diaries for the current user', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { id: 1, user_id: 1, name: 'Thoughts', icon: '💭', is_default: true, visibility: 'private' },
                    { id: 2, user_id: 1, name: 'Work', icon: '💼', is_default: false, visibility: 'private' }
                ]
            });

            const res = await request(app).get('/api/diaries');

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].name).toBe('Thoughts');
        });

        it('should use user_id from JWT token (mocked)', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, user_id: 1, name: 'User 1 Diary', icon: '📔', is_default: true }]
            });

            const res = await request(app)
                .get('/api/diaries');

            expect(res.status).toBe(200);
            // Verify query uses user_id from mocked JWT token (userId: 1)
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('user_id = $1'),
                [1]
            );
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app).get('/api/diaries');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch diaries');
        });
    });

    describe('POST /api/diaries', () => {
        it('should create a new diary', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ id: 2, user_id: 1, name: 'New Diary', icon: '📓', is_default: false, visibility: 'private' }]
            });

            const res = await request(app)
                .post('/api/diaries')
                .send({ name: 'New Diary', icon: '📓', visibility: 'private' });

            expect(res.status).toBe(201);
            expect(res.body.name).toBe('New Diary');
            expect(res.body.icon).toBe('📓');
        });

        it('should use default icon if not provided', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ id: 2, user_id: 1, name: 'New Diary', icon: '📓', is_default: false, visibility: 'private' }]
            });

            const res = await request(app)
                .post('/api/diaries')
                .send({ name: 'New Diary' });

            expect(res.status).toBe(201);
        });

        it('should return 400 if name is missing', async () => {
            const res = await request(app)
                .post('/api/diaries')
                .send({ icon: '📓' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Diary name is required');
        });

        it('should return 400 if name is empty', async () => {
            const res = await request(app)
                .post('/api/diaries')
                .send({ name: '   ' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Diary name is required');
        });

        it('should return 400 for duplicate diary name', async () => {
            const error = new Error('Duplicate');
            error.code = '23505';
            db.query.mockRejectedValueOnce(error);

            const res = await request(app)
                .post('/api/diaries')
                .send({ name: 'Existing Diary' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('A diary with this name already exists');
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app)
                .post('/api/diaries')
                .send({ name: 'New Diary' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to create diary');
        });
    });

    describe('PUT /api/diaries/:id', () => {
        it('should update an existing diary', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, user_id: 1, name: 'Updated Diary', icon: '🔥', is_default: false, visibility: 'public' }]
            });

            const res = await request(app)
                .put('/api/diaries/1')
                .send({ name: 'Updated Diary', icon: '🔥', visibility: 'public' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated Diary');
        });

        it('should return 400 if name is missing', async () => {
            const res = await request(app)
                .put('/api/diaries/1')
                .send({ icon: '📓' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Diary name is required');
        });

        it('should return 404 if diary not found', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .put('/api/diaries/999')
                .send({ name: 'Updated Diary', icon: '📓', visibility: 'private' });

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Diary not found');
        });

        it('should return 400 for duplicate diary name', async () => {
            const error = new Error('Duplicate');
            error.code = '23505';
            db.query.mockRejectedValueOnce(error);

            const res = await request(app)
                .put('/api/diaries/1')
                .send({ name: 'Existing Diary', icon: '📓', visibility: 'private' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('A diary with this name already exists');
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app)
                .put('/api/diaries/1')
                .send({ name: 'Updated Diary', icon: '📓', visibility: 'private' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to update diary');
        });
    });

    describe('DELETE /api/diaries/:id', () => {
        it('should delete a diary and move entries to default', async () => {
            // Mock: check if default diary
            db.query.mockResolvedValueOnce({ rows: [{ is_default: false }] });
            // Mock: get default diary
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
            // Mock: move entries
            db.query.mockResolvedValueOnce({ rows: [] });
            // Mock: delete diary
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).delete('/api/diaries/2');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 404 if diary not found', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).delete('/api/diaries/999');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Diary not found');
        });

        it('should return 400 if trying to delete default diary', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ is_default: true }] });

            const res = await request(app).delete('/api/diaries/1');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Cannot delete the default diary');
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app).delete('/api/diaries/2');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to delete diary');
        });
    });

    describe('PATCH /api/diaries/:id/default', () => {
        it('should set a diary as default', async () => {
            // Mock: unset current default
            db.query.mockResolvedValueOnce({ rows: [] });
            // Mock: set new default
            db.query.mockResolvedValueOnce({
                rows: [{ id: 2, user_id: 1, name: 'New Default', icon: '📓', is_default: true }]
            });

            const res = await request(app).patch('/api/diaries/2/default');

            expect(res.status).toBe(200);
            expect(res.body.is_default).toBe(true);
        });

        it('should return 404 if diary not found', async () => {
            // Mock: unset current default
            db.query.mockResolvedValueOnce({ rows: [] });
            // Mock: set new default (not found)
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).patch('/api/diaries/999/default');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Diary not found');
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app).patch('/api/diaries/2/default');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to set default diary');
        });
    });
});
