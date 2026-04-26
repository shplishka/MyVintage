import request from 'supertest';
import express, { Application } from 'express';
import jwt from 'jsonwebtoken';

// Mocks

jest.mock('../src/models/User');
jest.mock('../src/models/RefreshToken');

// authenticate middleware is used by GET /api/auth/me
jest.mock('../src/middleware/auth.middleware', () => ({
    authenticate: jest.fn((req: any, _res: any, next: any) => {
        req.jwtUser = { userId: '507f1f77bcf86cd799439011', email: 'test@example.com' };
        next();
    }),
}));

// Mock the token service so tests don't rely on env vars for token signing
jest.mock('../src/services/token', () => ({
    generateTokens: jest.fn(() => ({
        accessToken:  'mock_access_token',
        refreshToken: 'mock_refresh_token',
    })),
    getRefreshTokenExpiry: jest.fn(() => new Date('2099-01-01')),
}));

// Imports

import User         from '../src/models/User';
import RefreshToken from '../src/models/RefreshToken';
import authRoutes   from '../src/routes/auth.routes';

// Test app

const app: Application = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Shared fixtures

const USER_ID = '507f1f77bcf86cd799439011'; // valid 24-hex ObjectId, matches mock above

const makeUser = (overrides: Record<string, unknown> = {}) => ({
    _id:            { toString: () => USER_ID },
    id:             USER_ID,
    username:       'testuser',
    email:          'test@example.com',
    profilePicture: null,
    biography:      null,
    comparePassword: jest.fn().mockResolvedValue(true),
    save:            jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

const makeStoredToken = (overrides: Record<string, unknown> = {}) => ({
    token:    'mock_refresh_token',
    userId:   USER_ID,
    deleteOne: jest.fn().mockResolvedValue({}),
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

// POST /api/auth/register

describe('POST /api/auth/register', () => {
    it('registers a new user and returns access + refresh tokens', async () => {
        (User.findOne as jest.Mock).mockResolvedValue(null);
        (User.create  as jest.Mock).mockResolvedValue(makeUser());
        (RefreshToken.create as jest.Mock).mockResolvedValue({});

        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'testuser', email: 'test@example.com', password: 'secret123' });

        expect(res.status).toBe(201);
        expect(res.body.accessToken).toBe('mock_access_token');
        expect(res.body.refreshToken).toBe('mock_refresh_token');
        expect(User.create).toHaveBeenCalledWith(
            expect.objectContaining({ username: 'testuser', email: 'test@example.com' })
        );
        expect(RefreshToken.create).toHaveBeenCalled();
    });

    it('returns 400 when username is missing', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'test@example.com', password: 'secret123' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/required/i);
        expect(User.create).not.toHaveBeenCalled();
    });

    it('returns 400 when email is missing', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'testuser', password: 'secret123' });

        expect(res.status).toBe(400);
        expect(User.create).not.toHaveBeenCalled();
    });

    it('returns 400 when password is missing', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'testuser', email: 'test@example.com' });

        expect(res.status).toBe(400);
        expect(User.create).not.toHaveBeenCalled();
    });

    it('returns 409 when email is already in use', async () => {
        (User.findOne as jest.Mock).mockResolvedValue(makeUser());

        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'testuser', email: 'test@example.com', password: 'secret123' });

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/email already in use/i);
        expect(User.create).not.toHaveBeenCalled();
    });
});

// POST /api/auth/login

describe('POST /api/auth/login', () => {
    it('logs in and returns tokens for valid credentials', async () => {
        const user = makeUser();
        (User.findOne as jest.Mock).mockResolvedValue(user);
        (RefreshToken.create as jest.Mock).mockResolvedValue({});

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'secret123' });

        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBe('mock_access_token');
        expect(res.body.refreshToken).toBe('mock_refresh_token');
        expect(user.comparePassword).toHaveBeenCalledWith('secret123');
    });

    it('returns 400 when email is missing', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ password: 'secret123' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/required/i);
    });

    it('returns 400 when password is missing', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com' });

        expect(res.status).toBe(400);
    });

    it('returns 401 when user does not exist', async () => {
        (User.findOne as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@example.com', password: 'wrongpass' });

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/invalid credentials/i);
    });

    it('returns 401 when password is incorrect', async () => {
        const user = makeUser({ comparePassword: jest.fn().mockResolvedValue(false) });
        (User.findOne as jest.Mock).mockResolvedValue(user);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'wrongpassword' });

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/invalid credentials/i);
    });
});

// POST /api/auth/refresh

describe('POST /api/auth/refresh', () => {
    const REFRESH_SECRET = 'test_refresh_secret_for_tests';

    it('issues a new token pair when a valid refresh token is provided', async () => {
        // Sign a real token with the test secret (matches .env.test)
        const validToken = jwt.sign(
            { userId: USER_ID, email: 'test@example.com' },
            REFRESH_SECRET,
            { expiresIn: '7d' }
        );
        const stored = makeStoredToken({ token: validToken });
        (RefreshToken.findOne  as jest.Mock).mockResolvedValue(stored);
        (RefreshToken.create   as jest.Mock).mockResolvedValue({});

        const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: validToken });

        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBe('mock_access_token');
        expect(res.body.refreshToken).toBe('mock_refresh_token');
        expect(stored.deleteOne).toHaveBeenCalled();
        expect(RefreshToken.create).toHaveBeenCalled();
    });

    it('returns 400 when refreshToken is missing', async () => {
        const res = await request(app)
            .post('/api/auth/refresh')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/required/i);
    });

    it('returns 401 when the token signature is invalid', async () => {
        const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: 'totally.invalid.token' });

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/invalid or expired/i);
    });

    it('returns 401 when the token is valid but not stored (already rotated)', async () => {
        const validToken = jwt.sign(
            { userId: USER_ID, email: 'test@example.com' },
            REFRESH_SECRET
        );
        (RefreshToken.findOne as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: validToken });

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/not recognised/i);
    });
});

// POST /api/auth/logout

describe('POST /api/auth/logout', () => {
    it('logs out and invalidates the refresh token', async () => {
        (RefreshToken.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });

        const res = await request(app)
            .post('/api/auth/logout')
            .send({ refreshToken: 'some_refresh_token' });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/logged out/i);
        expect(RefreshToken.deleteOne).toHaveBeenCalledWith({ token: 'some_refresh_token' });
    });

    it('returns 400 when refreshToken is missing', async () => {
        const res = await request(app)
            .post('/api/auth/logout')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/required/i);
    });
});

// GET /api/auth/me

describe('GET /api/auth/me', () => {
    it('returns the authenticated user without the password field', async () => {
        const user = makeUser();
        // me controller uses User.findById(userId).select('-password')
        const chain = { select: jest.fn().mockResolvedValue(user) };
        (User.findById as jest.Mock).mockReturnValue(chain);

        const res = await request(app).get('/api/auth/me');

        expect(res.status).toBe(200);
        expect(res.body.email).toBe('test@example.com');
        expect(res.body.password).toBeUndefined();
    });

    it('returns 404 when the authenticated user no longer exists in the DB', async () => {
        const chain = { select: jest.fn().mockResolvedValue(null) };
        (User.findById as jest.Mock).mockReturnValue(chain);

        const res = await request(app).get('/api/auth/me');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('User not found');
    });
});
