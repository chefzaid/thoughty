const request = require('supertest');

// Mock db
jest.mock('../src/db', () => ({
    query: jest.fn()
}));

const db = require('../src/db');
const app = require('../index');

describe('GET /api/stats', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return aggregated statistics', async () => {
        // Mock query responses in order:
        // 1. Total thoughts
        db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] })
            // 2. Thoughts per year
            .mockResolvedValueOnce({ rows: [{ year: 2024, count: '5' }, { year: 2023, count: '5' }] })
            // 3. Thoughts per month
            .mockResolvedValueOnce({ rows: [{ month: '2024-01', count: '5' }] })
            // 4. Thoughts per tag
            .mockResolvedValueOnce({ rows: [{ tag: 'work', count: '3' }] })
            // 5. Tags per year
            .mockResolvedValueOnce({ rows: [{ year: 2024, tag: 'work', count: '3' }] })
            // 6. Tags per month
            .mockResolvedValueOnce({ rows: [{ month: '2024-01', tag: 'work', count: '3' }] })
            // 7. Unique tags count
            .mockResolvedValueOnce({ rows: [{ count: '4' }] });

        const res = await request(app).get('/api/stats');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            totalThoughts: 10,
            uniqueTagsCount: 4,
            thoughtsPerYear: { '2024': 5, '2023': 5 },
            thoughtsPerMonth: { '2024-01': 5 },
            thoughtsPerTag: { 'work': 3 },
            tagsPerYear: { '2024': { 'work': 3 } },
            tagsPerMonth: { '2024-01': { 'work': 3 } }
        });
    });

    it('should handle database errors', async () => {
        db.query.mockRejectedValue(new Error('DB Error'));

        const res = await request(app).get('/api/stats');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to fetch statistics');
    });
});
