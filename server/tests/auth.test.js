const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

jest.mock('../src/utils/emailService', () => ({
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    sendAccountDeletionEmail: jest.fn().mockResolvedValue(undefined)
}));

// Mock the database module before requiring the app
jest.mock('../src/db', () => ({
    query: jest.fn(),
    pool: { query: jest.fn() }
}));

const db = require('../src/db');
const { sendPasswordResetEmail, sendAccountDeletionEmail } = require('../src/utils/emailService');
const app = require('../index');

describe('Auth Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            // Mock: check existing user (none found)
            db.query.mockResolvedValueOnce({ rows: [] });
            // Mock: insert user
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, username: 'testuser', email: 'test@example.com', created_at: new Date() }]
            });
            // Mock: create default diary
            db.query.mockResolvedValueOnce({ rows: [] });
            // Mock: store refresh token
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ email: 'test@example.com', password: 'Password123!', username: 'testuser' });

            expect(res.status).toBe(201);
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe('test@example.com');
            expect(res.body.accessToken).toBeDefined();
            expect(res.body.refreshToken).toBeDefined();
        });

        it('should return 400 if email is missing', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ password: 'password123' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Email and password are required');
        });

        it('should return 400 if password is missing', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ email: 'test@example.com' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Email and password are required');
        });

        it('should return 400 if password is too short', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ email: 'test@example.com', password: 'Ab1!' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Password must be at least 8 characters');
        });

        it('should return 409 if email already exists', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ email: 'existing@example.com', password: 'Password123!' });

            expect(res.status).toBe(409);
            expect(res.body.error).toBe('Email already registered');
        });

        it('should generate username from email if not provided', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, username: 'testuser', email: 'testuser@example.com', created_at: new Date() }]
            });
            db.query.mockResolvedValueOnce({ rows: [] });
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/register')
                .send({ email: 'testuser@example.com', password: 'Password123!' });

            expect(res.status).toBe(201);
            expect(res.body.user.username).toBe('testuser');
        });

        it('should handle database errors during registration', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app)
                .post('/api/auth/register')
                .send({ email: 'test@example.com', password: 'Password123!' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Registration failed');
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login successfully with valid credentials', async () => {
            const hashedPassword = await bcrypt.hash('password123', 10);
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, email: 'test@example.com', username: 'testuser', password_hash: hashedPassword, auth_provider: 'local' }]
            });
            // Mock: store refresh token
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(res.status).toBe(200);
            expect(res.body.user).toBeDefined();
            expect(res.body.accessToken).toBeDefined();
            expect(res.body.refreshToken).toBeDefined();
        });

        it('should return 400 if email is missing', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ password: 'password123' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Email/username and password are required');
        });

        it('should return 400 if password is missing', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Email/username and password are required');
        });

        it('should return 401 if user not found', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'nonexistent@example.com', password: 'password123' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid email or password');
        });

        it('should return 401 if password is incorrect', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 10);
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, email: 'test@example.com', username: 'testuser', password_hash: hashedPassword, auth_provider: 'local' }]
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrongpassword' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid email or password');
        });

        it('should handle database errors during login', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Login failed');
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('should refresh tokens with valid refresh token', async () => {
            const refreshToken = jwt.sign({ userId: 1 }, process.env.REFRESH_SECRET || 'refresh-secret-change-in-production', { expiresIn: '7d' });
            
            // Mock: validate refresh token in DB with user join
            db.query.mockResolvedValueOnce({
                rows: [{ user_id: 1, token: refreshToken, expires_at: new Date(Date.now() + 86400000), email: 'test@example.com', username: 'testuser', deleted_at: null }]
            });

            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken });

            expect(res.status).toBe(200);
            expect(res.body.accessToken).toBeDefined();
        });

        it('should return 400 if refresh token is missing', async () => {
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Refresh token required');
        });

        it('should return 401 if refresh token is invalid', async () => {
            const invalidToken = 'invalid-token';

            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: invalidToken });

            expect(res.status).toBe(401);
        });

        it('should return 401 if refresh token not found in database', async () => {
            const refreshToken = jwt.sign({ userId: 1 }, process.env.REFRESH_SECRET || 'refresh-secret-change-in-production', { expiresIn: '7d' });
            
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Refresh token expired or revoked');
        });

        it('should return 403 if account is deleted', async () => {
            const refreshToken = jwt.sign({ userId: 1 }, process.env.REFRESH_SECRET || 'refresh-secret-change-in-production', { expiresIn: '7d' });
            
            db.query.mockResolvedValueOnce({
                rows: [{ user_id: 1, token: refreshToken, expires_at: new Date(Date.now() + 86400000), email: 'test@example.com', username: 'testuser', deleted_at: new Date() }]
            });
            db.query.mockResolvedValueOnce({ rows: [] }); // delete token

            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken });

            expect(res.status).toBe(403);
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should logout successfully', async () => {
            const refreshToken = jwt.sign({ userId: 1 }, process.env.REFRESH_SECRET || 'refresh-secret-change-in-production', { expiresIn: '7d' });
            
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/logout')
                .send({ refreshToken });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 200 even without refresh token', async () => {
            const res = await request(app)
                .post('/api/auth/logout')
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should handle database errors during logout', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app)
                .post('/api/auth/logout')
                .send({ refreshToken: 'some-token' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Logout failed');
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return user info with valid token', async () => {
            const token = jwt.sign({ userId: 1, email: 'test@example.com' }, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
            
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, username: 'testuser', email: 'test@example.com', avatar_url: null, auth_provider: 'local', created_at: new Date() }]
            });

            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.email).toBe('test@example.com');
            expect(res.body.username).toBe('testuser');
        });

        it('should return 401 without token', async () => {
            const res = await request(app).get('/api/auth/me');

            expect(res.status).toBe(401);
        });

        it('should return 404 if user not found', async () => {
            const token = jwt.sign({ userId: 999, email: 'test@example.com' }, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
            
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(404);
        });

        it('should handle database errors', async () => {
            const token = jwt.sign({ userId: 1, email: 'test@example.com' }, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
            
            db.query.mockRejectedValue(new Error('Database error'));

            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(500);
        });
    });

    describe('POST /api/auth/change-password', () => {
        it('should change password successfully', async () => {
            const token = jwt.sign({ userId: 1, email: 'test@example.com' }, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
            const hashedPassword = await bcrypt.hash('OldPassword123!', 10);
            
            db.query.mockResolvedValueOnce({
                rows: [{ password_hash: hashedPassword, auth_provider: 'local' }]
            });
            db.query.mockResolvedValueOnce({ rows: [] }); // update password
            db.query.mockResolvedValueOnce({ rows: [] }); // invalidate tokens

            const res = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({ currentPassword: 'OldPassword123!', newPassword: 'NewPassword456!' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 400 if current password is missing', async () => {
            const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

            const res = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({ newPassword: 'NewPassword456!' });

            expect(res.status).toBe(400);
        });

        it('should return 400 if new password is too short', async () => {
            const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

            const res = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({ currentPassword: 'OldPassword123!', newPassword: 'Ab1!' });

            expect(res.status).toBe(400);
        });

        it('should return 401 if current password is wrong', async () => {
            const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
            const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
            
            db.query.mockResolvedValueOnce({
                rows: [{ password_hash: hashedPassword, auth_provider: 'local' }]
            });

            const res = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({ currentPassword: 'WrongPassword123!', newPassword: 'NewPassword456!' });

            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/auth/oauth', () => {
        it('should return 400 if required fields are missing', async () => {
            const res = await request(app)
                .post('/api/auth/oauth')
                .send({ provider: 'google' });

            expect(res.status).toBe(400);
        });

        it('should authenticate existing OAuth user', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, username: 'oauthuser', email: 'oauth@example.com', deleted_at: null }]
            });
            db.query.mockResolvedValueOnce({ rows: [] }); // store refresh token

            const res = await request(app)
                .post('/api/auth/oauth')
                .send({
                    provider: 'google',
                    providerId: 'google-123',
                    email: 'oauth@example.com',
                    name: 'OAuth User',
                    avatarUrl: 'https://example.com/a.png'
                });

            expect(res.status).toBe(200);
            expect(res.body.accessToken).toBeDefined();
            expect(res.body.refreshToken).toBeDefined();
            expect(res.body.user).toMatchObject({
                id: 1,
                email: 'oauth@example.com',
                username: 'oauthuser',
                authProvider: 'google',
                isNewUser: false
            });
        });

        it('should return 403 for deleted OAuth account', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ id: 1, username: 'oauthuser', email: 'oauth@example.com', deleted_at: new Date() }]
            });

            const res = await request(app)
                .post('/api/auth/oauth')
                .send({ provider: 'google', providerId: 'google-123', email: 'oauth@example.com' });

            expect(res.status).toBe(403);
        });

        it('should link OAuth to existing email account', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // no existing provider user
            db.query.mockResolvedValueOnce({ rows: [{ id: 2, auth_provider: 'local', deleted_at: null }] });
            db.query.mockResolvedValueOnce({ rows: [] }); // update user
            db.query.mockResolvedValueOnce({ rows: [{ id: 2, username: 'existing', email: 'existing@example.com' }] });
            db.query.mockResolvedValueOnce({ rows: [] }); // store refresh token

            const res = await request(app)
                .post('/api/auth/oauth')
                .send({ provider: 'google', providerId: 'google-456', email: 'existing@example.com' });

            expect(res.status).toBe(200);
            expect(res.body.user).toMatchObject({
                id: 2,
                email: 'existing@example.com',
                username: 'existing',
                authProvider: 'google',
                isNewUser: false
            });
        });

        it('should create a new OAuth user when none exists', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // no existing provider user
            db.query.mockResolvedValueOnce({ rows: [] }); // no existing email
            db.query.mockResolvedValueOnce({ rows: [{ id: 3, username: 'newuser', email: 'new@example.com' }] }); // insert user
            db.query.mockResolvedValueOnce({ rows: [] }); // create default diary
            db.query.mockResolvedValueOnce({ rows: [] }); // store refresh token

            const res = await request(app)
                .post('/api/auth/oauth')
                .send({
                    provider: 'google',
                    providerId: 'google-789',
                    email: 'new@example.com',
                    name: 'New User',
                    avatarUrl: null
                });

            expect(res.status).toBe(200);
            expect(res.body.user).toMatchObject({
                id: 3,
                email: 'new@example.com',
                username: 'newuser',
                authProvider: 'google',
                isNewUser: true
            });
        });
    });

    describe('POST /api/auth/forgot-password', () => {
        it('should return 400 if email is missing', async () => {
            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 400 for invalid email format', async () => {
            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'not-an-email' });

            expect(res.status).toBe(400);
        });

        it('should always return success when user not found', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'missing@example.com' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should always return success for OAuth accounts', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 10, email: 'oauth@example.com', auth_provider: 'google' }] });

            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'oauth@example.com' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should store reset token and attempt to send email for local account', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 11, email: 'local@example.com', auth_provider: 'local' }] });
            db.query.mockResolvedValueOnce({ rows: [] }); // update user with reset token

            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'local@example.com' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
        });
    });

    describe('POST /api/auth/reset-password', () => {
        it('should return 400 if token or newPassword missing', async () => {
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 't' });

            expect(res.status).toBe(400);
        });

        it('should return 400 if new password is too short', async () => {
            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 't', newPassword: 'Ab1!' });

            expect(res.status).toBe(400);
        });

        it('should return 400 for invalid or expired reset token', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'invalid', newPassword: 'NewPassword456!' });

            expect(res.status).toBe(400);
        });

        it('should reset password with valid token', async () => {
            const token = 'valid-reset-token';
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

            db.query.mockResolvedValueOnce({ rows: [{ id: 12 }] }); // find user by token hash
            db.query.mockResolvedValueOnce({ rows: [] }); // update user password and clear token
            db.query.mockResolvedValueOnce({ rows: [] }); // delete refresh tokens

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token, newPassword: 'NewPassword456!' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE reset_token = $1'),
                [tokenHash]
            );
        });
    });

    describe('POST /api/auth/delete-account', () => {
        it('should return 404 if user not found', async () => {
            const token = jwt.sign({ userId: 123 }, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/delete-account')
                .set('Authorization', `Bearer ${token}`)
                .send({ password: 'Anything123!' });

            expect(res.status).toBe(404);
        });

        it('should require password for local accounts', async () => {
            const token = jwt.sign({ userId: 13 }, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
            db.query.mockResolvedValueOnce({ rows: [{ id: 13, email: 'local@example.com', password_hash: 'hash', auth_provider: 'local' }] });

            const res = await request(app)
                .post('/api/auth/delete-account')
                .set('Authorization', `Bearer ${token}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 401 for invalid password', async () => {
            const token = jwt.sign({ userId: 14 }, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
            const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);

            db.query.mockResolvedValueOnce({
                rows: [{ id: 14, email: 'local@example.com', password_hash: hashedPassword, auth_provider: 'local' }]
            });

            const res = await request(app)
                .post('/api/auth/delete-account')
                .set('Authorization', `Bearer ${token}`)
                .send({ password: 'WrongPassword123!' });

            expect(res.status).toBe(401);
        });

        it('should delete local account when password is valid', async () => {
            const token = jwt.sign({ userId: 15 }, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
            const hashedPassword = await bcrypt.hash('Password123!', 10);

            db.query.mockResolvedValueOnce({
                rows: [{ id: 15, email: 'local@example.com', password_hash: hashedPassword, auth_provider: 'local' }]
            });
            db.query.mockResolvedValueOnce({ rows: [] }); // update users
            db.query.mockResolvedValueOnce({ rows: [] }); // delete refresh tokens

            const res = await request(app)
                .post('/api/auth/delete-account')
                .set('Authorization', `Bearer ${token}`)
                .send({ password: 'Password123!' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(sendAccountDeletionEmail).toHaveBeenCalledTimes(1);
        });

        it('should delete OAuth account without requiring password', async () => {
            const token = jwt.sign({ userId: 16 }, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

            db.query.mockResolvedValueOnce({
                rows: [{ id: 16, email: 'oauth@example.com', password_hash: null, auth_provider: 'google' }]
            });
            db.query.mockResolvedValueOnce({ rows: [] }); // update users
            db.query.mockResolvedValueOnce({ rows: [] }); // delete refresh tokens

            const res = await request(app)
                .post('/api/auth/delete-account')
                .set('Authorization', `Bearer ${token}`)
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
