import request from 'supertest';
import express, { Application } from 'express';

// Mocks

jest.mock('../src/models/User');

jest.mock('../src/middleware/auth.middleware', () => ({
    authenticate: jest.fn((req: any, _res: any, next: any) => {
        req.jwtUser = { userId: 'user123', email: 'user@example.com' };
        next();
    }),
}));

// Multer mock: injects req.file when a file field is present, otherwise leaves it undefined
jest.mock('../src/middleware/upload.middleware', () => ({
    uploadProfilePicture: {
        single: jest.fn(() => (req: any, _res: any, next: any) => {
            if (req.headers['x-mock-file'] === 'true') {
                req.file = { filename: 'user123.jpg', mimetype: 'image/jpeg' };
            }
            next();
        }),
    },
    uploadPostImages: {
        array: jest.fn(() => (_req: any, _res: any, next: any) => next()),
    },
}));

// Imports

import User from '../src/models/User';
import userRoutes from '../src/routes/user.routes';

// Test app

const app: Application = express();
app.use(express.json());
app.use('/api/users', userRoutes);

// Shared fixtures

const USER_ID  = 'user123';
const OTHER_ID = 'other456';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
    _id:            USER_ID,
    username:       'vintageuser',
    email:          'user@example.com',
    profilePicture: null,
    biography:      null,
    save:           jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

// POST /api/users/:id/profile-picture

describe('POST /api/users/:id/profile-picture', () => {
    it('uploads a profile picture and returns the URL', async () => {
        const user = makeUser();
        (User.findById as jest.Mock).mockResolvedValue(user);

        const res = await request(app)
            .post(`/api/users/${USER_ID}/profile-picture`)
            .set('x-mock-file', 'true');

        expect(res.status).toBe(200);
        expect(res.body.profilePicture).toBe('/media/profile-pictures/user123.jpg');
        expect(user.save).toHaveBeenCalled();
    });

    it('returns 403 when updating another user\'s picture', async () => {
        const res = await request(app)
            .post(`/api/users/${OTHER_ID}/profile-picture`)
            .set('x-mock-file', 'true');

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/forbidden/i);
    });

    it('returns 400 when no file is provided', async () => {
        const res = await request(app)
            .post(`/api/users/${USER_ID}/profile-picture`);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('No image file provided');
    });

    it('returns 404 when user does not exist', async () => {
        (User.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .post(`/api/users/${USER_ID}/profile-picture`)
            .set('x-mock-file', 'true');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('User not found');
    });
});
