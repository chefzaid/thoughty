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

describe('API Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/entries', () => {
        it('should return entries with pagination', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count query
                .mockResolvedValueOnce({
                    rows: [
                        { id: 1, user_id: 1, date: '2024-01-01', content: 'Entry 1', tags: ['work'], index: 1 },
                        { id: 2, user_id: 1, date: '2024-01-01', content: 'Entry 2', tags: ['personal'], index: 2 }
                    ]
                }) // entries query
                .mockResolvedValueOnce({ rows: [{ tag: 'work' }, { tag: 'personal' }] }); // tags query

            const res = await request(app).get('/api/entries');

            expect(res.status).toBe(200);
            expect(res.body.entries).toHaveLength(2);
            expect(res.body.total).toBe(2);
            expect(res.body.page).toBe(1);
            expect(res.body.allTags).toEqual(['personal', 'work']);
        });

        it('should use user_id from JWT token (mocked)', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({
                    rows: [
                        { id: 1, user_id: 1, date: '2024-01-01', content: 'User 1 entry', tags: ['work'], index: 1 }
                    ]
                })
                .mockResolvedValueOnce({ rows: [{ tag: 'work' }] });

            const res = await request(app)
                .get('/api/entries');

            expect(res.status).toBe(200);
            // Verify that query was called with user_id from mocked JWT token (userId: 1)
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('user_id = $1'),
                expect.arrayContaining([1])
            );
        });

        it('should filter entries by search term', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({
                    rows: [
                        { id: 1, user_id: 1, date: '2024-01-01', content: 'Test entry', tags: ['work'], index: 1 }
                    ]
                })
                .mockResolvedValueOnce({ rows: [{ tag: 'work' }] });

            const res = await request(app).get('/api/entries?search=Test');

            expect(res.status).toBe(200);
            expect(res.body.entries).toHaveLength(1);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('content ILIKE'),
                expect.arrayContaining(['%Test%'])
            );
        });

        it('should filter entries by tags', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({
                    rows: [
                        { id: 1, user_id: 1, date: '2024-01-01', content: 'Entry', tags: ['work'], index: 1 }
                    ]
                })
                .mockResolvedValueOnce({ rows: [{ tag: 'work' }] });

            const res = await request(app).get('/api/entries?tags=work');

            expect(res.status).toBe(200);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('tags @>'),
                expect.arrayContaining([['work']])
            );
        });

        it('should filter entries by date', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({
                    rows: [
                        { id: 1, user_id: 1, date: '2024-01-15', content: 'Entry', tags: ['work'], index: 1 }
                    ]
                })
                .mockResolvedValueOnce({ rows: [{ tag: 'work' }] });

            const res = await request(app).get('/api/entries?date=2024-01-15');

            expect(res.status).toBe(200);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('date ='),
                expect.arrayContaining(['2024-01-15'])
            );
        });

        it('should handle pagination parameters', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ count: '25' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            const res = await request(app).get('/api/entries?page=2&limit=5');

            expect(res.status).toBe(200);
            expect(res.body.page).toBe(2);
            expect(res.body.totalPages).toBe(5);
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app).get('/api/entries');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch entries');
        });
    });

    describe('POST /api/entries', () => {
        it('should create a new entry', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // default diary query
                .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // count for index
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // insert

            const res = await request(app)
                .post('/api/entries')
                .send({ text: 'New entry', tags: ['work'], date: '2024-01-01' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should create entry with user_id from JWT token (mocked)', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // default diary query
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [{ id: 1 }] });

            const res = await request(app)
                .post('/api/entries')
                .send({ text: 'New entry', tags: ['work'], date: '2024-01-01' });

            expect(res.status).toBe(200);
            // Verify INSERT includes user_id from mocked JWT token (userId: 1)
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO entries (user_id'),
                expect.arrayContaining([1])
            );
        });

        it('should create entry with auto-generated date if not provided', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // default diary query
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [{ id: 1 }] });

            const res = await request(app)
                .post('/api/entries')
                .send({ text: 'New entry', tags: ['work'] });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 400 if text is missing', async () => {
            const res = await request(app)
                .post('/api/entries')
                .send({ tags: ['work'] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Text is required');
        });

        it('should return 400 if tags are missing', async () => {
            const res = await request(app)
                .post('/api/entries')
                .send({ text: 'New entry' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('At least one tag is required');
        });

        it('should return 400 if tags array is empty', async () => {
            const res = await request(app)
                .post('/api/entries')
                .send({ text: 'New entry', tags: [] });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('At least one tag is required');
        });

        it('should handle database errors during creation', async () => {
            db.query.mockRejectedValue(new Error('Insert failed'));

            const res = await request(app)
                .post('/api/entries')
                .send({ text: 'New entry', tags: ['work'], date: '2024-01-01' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to create entry');
        });
    });

    describe('PUT /api/entries/:id', () => {
        it('should update an existing entry', async () => {
            // Mock: get current entry (to check date change)
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, user_id: 1, content: 'Original', tags: ['work'], date: '2024-01-02', index: 1 }]
            });
            // Mock: update entry
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, user_id: 1, content: 'Updated', tags: ['personal'], date: '2024-01-02' }]
            });

            const res = await request(app)
                .put('/api/entries/1')
                .send({ text: 'Updated', tags: ['personal'], date: '2024-01-02' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.entry.content).toBe('Updated');
        });

        it('should update entry with user_id from JWT token (mocked)', async () => {
            // Mock: get current entry
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, user_id: 1, content: 'Original', tags: ['work'], date: '2024-01-02', index: 1 }]
            });
            // Mock: update entry
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, user_id: 1, content: 'Updated', tags: ['personal'], date: '2024-01-02' }]
            });

            const res = await request(app)
                .put('/api/entries/1')
                .send({ text: 'Updated', tags: ['personal'], date: '2024-01-02' });

            expect(res.status).toBe(200);
            // Verify UPDATE includes user_id from mocked JWT token (userId: 1) in WHERE clause
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('user_id = $7'),
                expect.arrayContaining([1])
            );
        });

        it('should return 400 if text is missing', async () => {
            const res = await request(app)
                .put('/api/entries/1')
                .send({ tags: ['work'], date: '2024-01-01' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Text is required');
        });

        it('should return 400 if tags are missing', async () => {
            const res = await request(app)
                .put('/api/entries/1')
                .send({ text: 'Updated', date: '2024-01-01' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('At least one tag is required');
        });

        it('should return 404 if entry not found', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .put('/api/entries/999')
                .send({ text: 'Updated', tags: ['work'], date: '2024-01-01' });

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Entry not found');
        });

        it('should handle database errors during update', async () => {
            db.query.mockRejectedValue(new Error('Update failed'));

            const res = await request(app)
                .put('/api/entries/1')
                .send({ text: 'Updated', tags: ['work'], date: '2024-01-01' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to update entry');
        });
    });

    describe('DELETE /api/entries/:id', () => {
        it('should delete an entry and reindex', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, date: '2024-01-01', index: 1 }] }) // find entry
                .mockResolvedValueOnce({ rows: [] }) // delete
                .mockResolvedValueOnce({ rows: [{ id: 2 }, { id: 3 }] }) // remaining entries
                .mockResolvedValueOnce({ rows: [] }) // update index 1
                .mockResolvedValueOnce({ rows: [] }); // update index 2

            const res = await request(app).delete('/api/entries/1');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should delete entry with user_id from JWT token (mocked)', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 1, date: '2024-01-01', index: 1 }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .delete('/api/entries/1');

            expect(res.status).toBe(200);
            // Verify SELECT includes user_id from mocked JWT token (userId: 1)
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('user_id = $2'),
                expect.arrayContaining([1])
            );
        });

        it('should return 404 if entry not found', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).delete('/api/entries/999');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Entry not found');
        });

        it('should handle database errors during deletion', async () => {
            db.query.mockRejectedValue(new Error('Delete failed'));

            const res = await request(app).delete('/api/entries/1');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to delete entry');
        });
    });
    describe('GET /api/config', () => {
        it('should return configuration', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { key: 'name', value: 'Test User' },
                    { key: 'theme', value: 'dark' }
                ]
            });

            const res = await request(app).get('/api/config');

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Test User');
        });
    });

    describe('POST /api/config', () => {
        it('should update configuration', async () => {
            // Mock upsert for each setting
            db.query.mockResolvedValue({ rowCount: 1 });

            const res = await request(app)
                .post('/api/config')
                .send({ name: 'New Name', theme: 'light' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should handle database errors during config update', async () => {
            db.query.mockRejectedValue(new Error('Config update failed'));

            const res = await request(app)
                .post('/api/config')
                .send({ name: 'Error User' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to save config');
        });
    });

    describe('GET /api/entries/dates', () => {
        it('should return distinct dates with entries', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { date: '2024-01-15' },
                    { date: '2024-01-10' },
                    { date: '2024-01-05' }
                ]
            });

            const res = await request(app).get('/api/entries/dates');

            expect(res.status).toBe(200);
            expect(res.body.dates).toEqual(['2024-01-15', '2024-01-10', '2024-01-05']);
        });

        it('should use user_id from JWT token for dates (mocked)', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ date: '2024-01-15' }]
            });

            const res = await request(app)
                .get('/api/entries/dates');

            expect(res.status).toBe(200);
            // Verify query uses user_id from mocked JWT token (userId: 1)
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('user_id = $1'),
                [1]
            );
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app).get('/api/entries/dates');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch entry dates');
        });
    });

    describe('GET /api/entries/first', () => {
        it('should return page 1 when no year provided', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ year: 2024 }, { year: 2023 }] }) // years
                .mockResolvedValueOnce({ rows: [{ month: '2024-01' }, { month: '2023-12' }] }); // months

            const res = await request(app).get('/api/entries/first');

            expect(res.status).toBe(200);
            expect(res.body.page).toBe(1);
            expect(res.body.found).toBe(false);
            expect(res.body.years).toEqual([2024, 2023]);
        });

        it('should find page for a specific year', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ year: 2024 }] }) // years
                .mockResolvedValueOnce({ rows: [{ month: '2024-01' }] }) // months
                .mockResolvedValueOnce({ rows: [{ first_date: '2024-01-15' }] }) // first entry
                .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // first entry ID
                .mockResolvedValueOnce({ rows: [{ count: '20' }] }); // count newer entries

            const res = await request(app).get('/api/entries/first?year=2024');

            expect(res.status).toBe(200);
            expect(res.body.found).toBe(true);
            expect(res.body.page).toBeDefined();
        });

        it('should find page for a specific year and month', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ year: 2024 }] }) // years
                .mockResolvedValueOnce({ rows: [{ month: '2024-01' }] }) // months
                .mockResolvedValueOnce({ rows: [{ first_date: '2024-01-15' }] }) // first entry
                .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // first entry ID
                .mockResolvedValueOnce({ rows: [{ count: '5' }] }); // count newer entries

            const res = await request(app).get('/api/entries/first?year=2024&month=1');

            expect(res.status).toBe(200);
            expect(res.body.found).toBe(true);
        });

        it('should return found: false when no entries in period', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ year: 2024 }] }) // years
                .mockResolvedValueOnce({ rows: [{ month: '2024-01' }] }) // months
                .mockResolvedValueOnce({ rows: [{ first_date: null }] }); // no first entry

            const res = await request(app).get('/api/entries/first?year=2020');

            expect(res.status).toBe(200);
            expect(res.body.found).toBe(false);
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app).get('/api/entries/first?year=2024');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to find first entry');
        });
    });

    describe('GET /api/entries/by-date', () => {
        it('should find entry by date and index', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 1, date_str: '2024-01-15', index: 1, content: 'Test' }] }) // entry
                .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // count newer
                .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // same date before

            const res = await request(app).get('/api/entries/by-date?date=2024-01-15&index=1');

            expect(res.status).toBe(200);
            expect(res.body.found).toBe(true);
            expect(res.body.entry).toBeDefined();
            expect(res.body.page).toBeDefined();
        });

        it('should find entry by id', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 5, date_str: '2024-01-15', index: 1, content: 'Test' }] }) // entry by id
                .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // count newer
                .mockResolvedValueOnce({ rows: [{ count: '0' }] }); // same date before

            const res = await request(app).get('/api/entries/by-date?id=5');

            expect(res.status).toBe(200);
            expect(res.body.found).toBe(true);
            expect(res.body.entryId).toBe(5);
        });

        it('should return 400 if date is missing and no id', async () => {
            const res = await request(app).get('/api/entries/by-date');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Date is required');
        });

        it('should return not found for non-existent entry', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).get('/api/entries/by-date?date=2024-01-15');

            expect(res.status).toBe(200);
            expect(res.body.found).toBe(false);
        });

        it('should return not found for non-existent id', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).get('/api/entries/by-date?id=999');

            expect(res.status).toBe(200);
            expect(res.body.found).toBe(false);
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app).get('/api/entries/by-date?date=2024-01-15');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to find entry');
        });
    });

    describe('POST /api/entries with diaryId', () => {
        it('should create entry with specific diaryId', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // count for index
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // insert

            const res = await request(app)
                .post('/api/entries')
                .send({ text: 'New entry', tags: ['work'], date: '2024-01-01', diaryId: 2 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('PUT /api/entries with date change', () => {
        it('should handle date change and reindex', async () => {
            // Mock: get current entry
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, user_id: 1, content: 'Original', tags: ['work'], date: '2024-01-01', index: 1 }]
            });
            // Mock: count for new date
            db.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
            // Mock: update entry
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, user_id: 1, content: 'Updated', tags: ['personal'], date: '2024-01-02' }]
            });
            // Mock: get entries to reindex
            db.query.mockResolvedValueOnce({ rows: [{ id: 2 }, { id: 3 }] });
            // Mock: update indexes
            db.query.mockResolvedValue({ rows: [] });

            const res = await request(app)
                .put('/api/entries/1')
                .send({ text: 'Updated', tags: ['personal'], date: '2024-01-02' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('PATCH /api/entries/:id/visibility', () => {
        it('should update entry visibility to public', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, user_id: 1, visibility: 'public' }]
            });

            const res = await request(app)
                .patch('/api/entries/1/visibility')
                .send({ visibility: 'public' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.entry.visibility).toBe('public');
        });

        it('should update entry visibility to private', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, user_id: 1, visibility: 'private' }]
            });

            const res = await request(app)
                .patch('/api/entries/1/visibility')
                .send({ visibility: 'private' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 400 if visibility is missing', async () => {
            const res = await request(app)
                .patch('/api/entries/1/visibility')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Valid visibility (public/private) is required');
        });

        it('should return 400 if visibility is invalid', async () => {
            const res = await request(app)
                .patch('/api/entries/1/visibility')
                .send({ visibility: 'invalid' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Valid visibility (public/private) is required');
        });

        it('should return 404 if entry not found', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .patch('/api/entries/1/visibility')
                .send({ visibility: 'public' });

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Entry not found');
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app)
                .patch('/api/entries/1/visibility')
                .send({ visibility: 'public' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to update visibility');
        });
    });

    describe('GET /api/entries/highlights', () => {
        it('should return random entry and on-this-day entries', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{ id: 1, content: 'Random thought', tags: ['inspiration'], diary_name: 'Personal' }]
                })
                .mockResolvedValueOnce({
                    rows: [
                        { id: 2, content: 'Last year', tags: ['memory'], entry_year: 2023, diary_name: 'Personal' }
                    ]
                });

            const res = await request(app).get('/api/entries/highlights');

            expect(res.status).toBe(200);
            expect(res.body.randomEntry).toBeDefined();
            expect(res.body.onThisDay).toBeDefined();
            expect(res.body.currentDate).toBeDefined();
        });

        it('should filter highlights by diaryId', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{ id: 1, content: 'Diary entry', diary_name: 'Work' }]
                })
                .mockResolvedValueOnce({ rows: [] });

            const res = await request(app).get('/api/entries/highlights?diaryId=2');

            expect(res.status).toBe(200);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('diary_id'),
                expect.arrayContaining([2])
            );
        });

        it('should handle empty results', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            const res = await request(app).get('/api/entries/highlights');

            expect(res.status).toBe(200);
            expect(res.body.randomEntry).toBeNull();
            expect(res.body.onThisDay).toEqual({});
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app).get('/api/entries/highlights');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch highlights');
        });
    });

    describe('DELETE /api/entries/all', () => {
        it('should delete all entries for user', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 5 });

            const res = await request(app).delete('/api/entries/all');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.deletedCount).toBe(5);
        });

        it('should delete entries only from specific diary', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 3 });

            const res = await request(app).delete('/api/entries/all?diaryId=2');

            expect(res.status).toBe(200);
            expect(res.body.deletedCount).toBe(3);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('diary_id'),
                expect.arrayContaining([2])
            );
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app).delete('/api/entries/all');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to delete all entries');
        });
    });
});
