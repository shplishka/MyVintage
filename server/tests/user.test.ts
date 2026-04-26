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
    location:       null,
    save:           jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

// Chainable mock helpers

const mockFindChain = (result: unknown) => {
    const chain = { select: jest.fn().mockResolvedValue(result) };
    (User.findById as jest.Mock).mockReturnValue(chain);
    return chain;
};

const mockFindAllChain = (result: unknown[]) => {
    const chain = { select: jest.fn().mockResolvedValue(result) };
    (User.find as jest.Mock).mockReturnValue(chain);
    return chain;
};

const mockSearchChain = (result: unknown[]) => {
    const chain = {
        select: jest.fn().mockReturnThis(),
        limit:  jest.fn().mockResolvedValue(result),
    };
    (User.find as jest.Mock).mockReturnValue(chain);
    return chain;
};

// GET /api/users

describe('GET /api/users', () => {
    it('returns all users without passwords', async () => {
        mockFindAllChain([makeUser(), makeUser({ _id: OTHER_ID })]);

        const res = await request(app).get('/api/users');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);
        expect(User.find).toHaveBeenCalled();
    });

    it('returns an empty array when no users exist', async () => {
        mockFindAllChain([]);

        const res = await request(app).get('/api/users');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// GET /api/users/search

describe('GET /api/users/search', () => {
    it('returns matching users when query is provided', async () => {
        mockSearchChain([makeUser()]);

        const res = await request(app).get('/api/users/search?q=vintage');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(1);
        expect(User.find).toHaveBeenCalledWith(
            expect.objectContaining({ username: { $regex: 'vintage', $options: 'i' } })
        );
    });

    it('returns empty array when query is empty', async () => {
        const res = await request(app).get('/api/users/search');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
        expect(User.find).not.toHaveBeenCalled();
    });

    it('returns empty array when query is whitespace only', async () => {
        const res = await request(app).get('/api/users/search?q=   ');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// GET /api/users/:id

describe('GET /api/users/:id', () => {
    it('returns a user by ID (no password field)', async () => {
        mockFindChain(makeUser());

        const res = await request(app).get(`/api/users/${USER_ID}`);

        expect(res.status).toBe(200);
        expect(res.body._id).toBe(USER_ID);
        expect(res.body.password).toBeUndefined();
    });

    it('returns 404 when user does not exist', async () => {
        mockFindChain(null);

        const res = await request(app).get(`/api/users/${USER_ID}`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('User not found');
    });
});

// PUT /api/users/:id

describe('PUT /api/users/:id', () => {
    it('updates the authenticated user\'s profile', async () => {
        const user = makeUser();
        (User.findById as jest.Mock).mockResolvedValue(user);

        const res = await request(app)
            .put(`/api/users/${USER_ID}`)
            .send({ biography: 'Vintage lover from Tel Aviv' });

        expect(res.status).toBe(200);
        expect(user.save).toHaveBeenCalled();
    });

    it('returns 403 when trying to update another user\'s profile', async () => {
        const res = await request(app)
            .put(`/api/users/${OTHER_ID}`)
            .send({ biography: 'Trying to update someone else' });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/forbidden/i);
    });

    it('returns 404 when user does not exist', async () => {
        (User.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .put(`/api/users/${USER_ID}`)
            .send({ biography: 'New bio' });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('User not found');
    });

    it('only updates allowed fields (username, profilePicture, biography, location)', async () => {
        const user = makeUser();
        (User.findById as jest.Mock).mockResolvedValue(user);

        await request(app)
            .put(`/api/users/${USER_ID}`)
            .send({ username: 'newname', email: 'hacker@evil.com' });

        expect(user.save).toHaveBeenCalled();
        // email should NOT be updated (not in allowlist)
        expect((user as any).email).toBe('user@example.com');
    });
});

// DELETE /api/users/:id

describe('DELETE /api/users/:id', () => {
    it('deletes the authenticated user\'s account', async () => {
        (User.findByIdAndDelete as jest.Mock).mockResolvedValue(makeUser());

        const res = await request(app).delete(`/api/users/${USER_ID}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Account deleted successfully');
        expect(User.findByIdAndDelete).toHaveBeenCalledWith(USER_ID);
    });

    it('returns 403 when trying to delete another user\'s account', async () => {
        const res = await request(app).delete(`/api/users/${OTHER_ID}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/forbidden/i);
        expect(User.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('returns 404 when user does not exist', async () => {
        (User.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

        const res = await request(app).delete(`/api/users/${USER_ID}`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('User not found');
    });
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
