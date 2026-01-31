/**
 * Auth Middleware Tests
 */

const jwt = require('jsonwebtoken');
const { authenticateToken, optionalAuth, getUserIdFromRequest, JWT_SECRET } = require('../src/middleware/authMiddleware');

describe('Auth Middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        mockReq = {
            headers: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        mockNext = jest.fn();
    });

    describe('authenticateToken', () => {
        it('should call next with valid token', () => {
            const token = jwt.sign({ userId: 1, email: 'test@example.com' }, JWT_SECRET);
            mockReq.headers['authorization'] = `Bearer ${token}`;

            authenticateToken(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user).toBeDefined();
            expect(mockReq.user.userId).toBe(1);
        });

        it('should return 401 if no token provided', () => {
            authenticateToken(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access token required' });
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 403 for invalid token', () => {
            mockReq.headers['authorization'] = 'Bearer invalid-token';

            authenticateToken(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
        });

        it('should return 401 for expired token', () => {
            const token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '-1s' });
            mockReq.headers['authorization'] = `Bearer ${token}`;

            authenticateToken(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
        });

        it('should handle authorization header without Bearer prefix', () => {
            mockReq.headers['authorization'] = 'not-a-bearer-token';

            authenticateToken(mockReq, mockRes, mockNext);

            // When split by ' ', 'not-a-bearer-token' at index 1 is undefined
            expect(mockRes.status).toHaveBeenCalledWith(401);
        });
    });

    describe('optionalAuth', () => {
        it('should set user if valid token provided', () => {
            const token = jwt.sign({ userId: 1, email: 'test@example.com' }, JWT_SECRET);
            mockReq.headers['authorization'] = `Bearer ${token}`;

            optionalAuth(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user).toBeDefined();
            expect(mockReq.user.userId).toBe(1);
        });

        it('should set user to null if no token provided', () => {
            optionalAuth(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user).toBeNull();
        });

        it('should set user to null for invalid token (not fail)', () => {
            mockReq.headers['authorization'] = 'Bearer invalid-token';

            optionalAuth(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user).toBeNull();
        });

        it('should set user to null for expired token (not fail)', () => {
            const token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '-1s' });
            mockReq.headers['authorization'] = `Bearer ${token}`;

            optionalAuth(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.user).toBeNull();
        });
    });

    describe('getUserIdFromRequest', () => {
        it('should return userId from authenticated user', () => {
            mockReq.user = { userId: 42 };

            const result = getUserIdFromRequest(mockReq);

            expect(result).toBe(42);
        });

        it('should return userId from x-user-id header (legacy)', () => {
            mockReq.headers['x-user-id'] = '5';

            const result = getUserIdFromRequest(mockReq);

            expect(result).toBe(5);
        });

        it('should return 1 as default if no user info', () => {
            const result = getUserIdFromRequest(mockReq);

            expect(result).toBe(1);
        });

        it('should prefer authenticated user over header', () => {
            mockReq.user = { userId: 10 };
            mockReq.headers['x-user-id'] = '20';

            const result = getUserIdFromRequest(mockReq);

            expect(result).toBe(10);
        });

        it('should handle invalid x-user-id header', () => {
            mockReq.headers['x-user-id'] = 'not-a-number';

            const result = getUserIdFromRequest(mockReq);

            expect(result).toBe(1);
        });

        it('should handle user object without userId', () => {
            mockReq.user = { email: 'test@example.com' };

            const result = getUserIdFromRequest(mockReq);

            expect(result).toBe(1);
        });
    });
});
