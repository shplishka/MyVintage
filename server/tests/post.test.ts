import request from 'supertest';
import express, { Application } from 'express';

// Mocks

jest.mock('../src/models/Post');
jest.mock('../src/models/Offer');
jest.mock('../src/models/Like');
jest.mock('../src/models/User');
jest.mock('../src/services/ai', () => ({
    buildSearchPlan: jest.fn(),
}));

jest.mock('../src/middleware/auth.middleware', () => ({
    authenticate: jest.fn((req: any, _res: any, next: any) => {
        req.jwtUser = { userId: 'seller123', email: 'seller@example.com' };
        next();
    }),
    // optionalAuthenticate does not set jwtUser — simulates unauthenticated GET /
    optionalAuthenticate: jest.fn((_req: any, _res: any, next: any) => next()),
}));

jest.mock('../src/middleware/upload.middleware', () => ({
    uploadProfilePicture: {
        single: jest.fn(() => (_req: any, _res: any, next: any) => next()),
    },
    uploadPostImages: {
        array: jest.fn(() => (req: any, _res: any, next: any) => {
            if (req.headers['x-mock-files']) {
                const count = parseInt(req.headers['x-mock-files'], 10);
                req.files = Array.from({ length: count }, (_, i) => ({
                    filename: `img${i}.jpg`,
                    mimetype: 'image/jpeg',
                }));
            }
            next();
        }),
    },
}));

// Imports

import Post  from '../src/models/Post';
import Offer from '../src/models/Offer';
import Like  from '../src/models/Like';
import User  from '../src/models/User';
import { buildSearchPlan } from '../src/services/ai';
import postRoutes from '../src/routes/post.routes';

// Test app (no DB connection, no listen)

const app: Application = express();
app.use(express.json());
app.use('/api/posts', postRoutes);

// Shared fixtures

const SELLER_ID = 'seller123';
const OTHER_ID  = 'other456';
// POST_ID must be a valid 24-hex ObjectId because toggleLike validates it
const POST_ID   = '000000000000000000000001';

const makePostData = (overrides: Record<string, unknown> = {}) => ({
    _id:         POST_ID,
    seller:      { toString: () => SELLER_ID },
    title:       'Vintage Jacket',
    description: 'A cool vintage jacket',
    category:    'clothing',
    price:       75,
    condition:   'good',
    year:        1990,
    brand:       "Levi's",
    style:       'Casual',
    images:      [] as string[],
    status:      'active',
    likesCount:  0,
    savesCount:  0,
    ...overrides,
});

// makePost adds jest-mock lifecycle methods and toObject (called by getAllPosts)
const makePost = (overrides: Record<string, unknown> = {}) => {
    const data = makePostData(overrides);
    return {
        ...data,
        toObject:  jest.fn().mockReturnValue(data),
        save:      jest.fn().mockResolvedValue(undefined),
        deleteOne: jest.fn().mockResolvedValue(undefined),
    };
};

const validBody = {
    title:       'Vintage Jacket',
    description: 'A cool vintage jacket',
    category:    'clothing',
    price:       75,
    condition:   'good',
    year:        1990,
    brand:       "Levi's",
    style:       'Casual',
};

const mockFind = (result: unknown[]) => {
    const chain = {
        populate: jest.fn().mockReturnThis(),
        sort:     jest.fn().mockResolvedValue(result),
    };
    (Post.find as jest.Mock).mockReturnValue(chain);
    return chain;
};

const mockFindById = (result: unknown) => {
    const chain = { populate: jest.fn().mockResolvedValue(result) };
    (Post.findById as jest.Mock).mockReturnValue(chain);
    return chain;
};

beforeEach(() => {
    jest.clearAllMocks();
    // Default: no blocking offers (used by deletePost)
    (Offer.exists as jest.Mock).mockResolvedValue(null);
});

// POST /api/posts

describe('POST /api/posts', () => {
    it('creates a post and returns 201', async () => {
        const post = makePost();
        (Post.create as jest.Mock).mockResolvedValue(post);

        const res = await request(app).post('/api/posts').send(validBody);

        expect(res.status).toBe(201);
        expect(res.body.title).toBe('Vintage Jacket');
        expect(Post.create).toHaveBeenCalledWith(
            expect.objectContaining({ seller: SELLER_ID, title: 'Vintage Jacket' })
        );
    });

    it('returns 400 when required fields are missing', async () => {
        const res = await request(app).post('/api/posts').send({ title: 'Only title' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/required/i);
    });

    it('returns 400 when price is missing', async () => {
        const { price, ...withoutPrice } = validBody;
        const res = await request(app).post('/api/posts').send(withoutPrice);
        expect(res.status).toBe(400);
    });
});

// GET /api/posts

describe('GET /api/posts', () => {
    it('returns all posts', async () => {
        mockFind([makePost()]);

        const res = await request(app).get('/api/posts');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(1);
    });

    it('filters by category', async () => {
        mockFind([makePost()]);

        const res = await request(app).get('/api/posts?category=clothing');

        expect(res.status).toBe(200);
        expect(Post.find).toHaveBeenCalledWith(
            expect.objectContaining({ category: 'clothing' })
        );
    });

    it('filters by minPrice and maxPrice', async () => {
        mockFind([makePost()]);

        const res = await request(app).get('/api/posts?minPrice=10&maxPrice=100');

        expect(res.status).toBe(200);
        expect(Post.find).toHaveBeenCalledWith(
            expect.objectContaining({ price: { $gte: 10, $lte: 100 } })
        );
    });

    it('returns an empty array when no posts exist', async () => {
        mockFind([]);

        const res = await request(app).get('/api/posts');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// GET /api/posts/user/:userId

describe('GET /api/posts/user/:userId', () => {
    it('returns all posts for a given user', async () => {
        mockFind([makePost(), makePost()]);

        const res = await request(app).get(`/api/posts/user/${SELLER_ID}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(Post.find).toHaveBeenCalledWith({ seller: SELLER_ID });
    });

    it('returns an empty array when user has no posts', async () => {
        mockFind([]);

        const res = await request(app).get(`/api/posts/user/${SELLER_ID}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// GET /api/posts/:id

describe('GET /api/posts/:id', () => {
    it('returns a post by ID', async () => {
        mockFindById(makePost());

        const res = await request(app).get(`/api/posts/${POST_ID}`);

        expect(res.status).toBe(200);
        expect(res.body._id).toBe(POST_ID);
    });

    it('returns 404 when post does not exist', async () => {
        mockFindById(null);

        const res = await request(app).get(`/api/posts/${POST_ID}`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Post not found');
    });
});

// PUT /api/posts/:id

describe('PUT /api/posts/:id', () => {
    it('updates a post and returns it', async () => {
        const post = makePost();
        (Post.findById as jest.Mock).mockResolvedValue(post);

        const res = await request(app)
            .put(`/api/posts/${POST_ID}`)
            .send({ title: 'Updated Title' });

        expect(res.status).toBe(200);
        expect(post.save).toHaveBeenCalled();
    });

    it('returns 404 when post does not exist', async () => {
        (Post.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .put(`/api/posts/${POST_ID}`)
            .send({ title: 'Updated Title' });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Post not found');
    });

    it('returns 403 when the requester is not the seller', async () => {
        const post = makePost({ seller: { toString: () => OTHER_ID } });
        (Post.findById as jest.Mock).mockResolvedValue(post);

        const res = await request(app)
            .put(`/api/posts/${POST_ID}`)
            .send({ title: 'Updated Title' });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/not the seller/i);
    });
});

// DELETE /api/posts/:id

describe('DELETE /api/posts/:id', () => {
    it('deletes a post and returns a success message', async () => {
        const post = makePost();
        (Post.findById as jest.Mock).mockResolvedValue(post);

        const res = await request(app).delete(`/api/posts/${POST_ID}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Post deleted successfully');
        expect(post.deleteOne).toHaveBeenCalled();
    });

    it('returns 409 when the post has active/accepted offers', async () => {
        const post = makePost();
        (Post.findById as jest.Mock).mockResolvedValue(post);
        (Offer.exists as jest.Mock).mockResolvedValue({ _id: 'blocked' });

        const res = await request(app).delete(`/api/posts/${POST_ID}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/pending and accepted offers/i);
        expect(post.deleteOne).not.toHaveBeenCalled();
    });

    it('returns 404 when post does not exist', async () => {
        (Post.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app).delete(`/api/posts/${POST_ID}`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Post not found');
    });

    it('returns 403 when the requester is not the seller', async () => {
        const post = makePost({ seller: { toString: () => OTHER_ID } });
        (Post.findById as jest.Mock).mockResolvedValue(post);

        const res = await request(app).delete(`/api/posts/${POST_ID}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/not the seller/i);
    });
});

// POST /api/posts/:id/images

describe('POST /api/posts/:id/images', () => {
    it('uploads images and returns the updated images list', async () => {
        const post = makePost({ images: [] });
        (Post.findById as jest.Mock).mockResolvedValue(post);

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/images`)
            .set('x-mock-files', '2');

        expect(res.status).toBe(200);
        expect(res.body.images).toHaveLength(2);
        expect(res.body.images[0]).toBe(`/media/posts/${POST_ID}/img0.jpg`);
        expect(post.save).toHaveBeenCalled();
    });

    it('appends to existing images', async () => {
        const post = makePost({ images: [`/media/posts/${POST_ID}/existing.jpg`] });
        (Post.findById as jest.Mock).mockResolvedValue(post);

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/images`)
            .set('x-mock-files', '2');

        expect(res.status).toBe(200);
        expect(res.body.images).toHaveLength(3);
    });

    it('returns 400 when no files are provided', async () => {
        const post = makePost();
        (Post.findById as jest.Mock).mockResolvedValue(post);

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/images`);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('No image files provided');
    });

    it('returns 400 when upload would exceed the 10-image limit', async () => {
        const post = makePost({ images: new Array(9).fill(`/media/posts/${POST_ID}/x.jpg`) });
        (Post.findById as jest.Mock).mockResolvedValue(post);

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/images`)
            .set('x-mock-files', '2');

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/cannot exceed/i);
    });

    it('returns 403 when requester is not the seller', async () => {
        const post = makePost({ seller: { toString: () => OTHER_ID } });
        (Post.findById as jest.Mock).mockResolvedValue(post);

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/images`)
            .set('x-mock-files', '1');

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/not the seller/i);
    });

    it('returns 404 when post does not exist', async () => {
        (Post.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/images`)
            .set('x-mock-files', '1');

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Post not found');
    });
});

// POST /api/posts/:id/like — toggleLike

describe('POST /api/posts/:id/like', () => {
    it('likes a post (first like) and returns liked=true with updated count', async () => {
        (Post.exists as jest.Mock).mockResolvedValue({ _id: POST_ID });
        (Like.findOne as jest.Mock).mockResolvedValue(null);
        (Like.create as jest.Mock).mockResolvedValue({});
        (Post.findByIdAndUpdate as jest.Mock).mockResolvedValue(makePost({ likesCount: 1 }));

        const res = await request(app).post(`/api/posts/${POST_ID}/like`);

        expect(res.status).toBe(200);
        expect(res.body.liked).toBe(true);
        expect(res.body.likesCount).toBe(1);
        expect(Like.create).toHaveBeenCalled();
    });

    it('unlikes a post (second toggle) and returns liked=false', async () => {
        const existingLike = { deleteOne: jest.fn().mockResolvedValue({}) };
        (Post.exists as jest.Mock).mockResolvedValue({ _id: POST_ID });
        (Like.findOne as jest.Mock).mockResolvedValue(existingLike);
        (Post.findByIdAndUpdate as jest.Mock).mockResolvedValue(makePost({ likesCount: 0 }));

        const res = await request(app).post(`/api/posts/${POST_ID}/like`);

        expect(res.status).toBe(200);
        expect(res.body.liked).toBe(false);
        expect(res.body.likesCount).toBe(0);
        expect(existingLike.deleteOne).toHaveBeenCalled();
    });

    it('returns 404 when post does not exist', async () => {
        (Post.exists as jest.Mock).mockResolvedValue(null);

        const res = await request(app).post(`/api/posts/${POST_ID}/like`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Post not found');
    });

    it('returns 400 when postId is not a valid ObjectId', async () => {
        const res = await request(app).post('/api/posts/not-valid/like');

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Invalid post id');
    });
});

// POST /api/posts/:id/save — toggleSave

describe('POST /api/posts/:id/save', () => {
    it('saves a post that was not yet saved', async () => {
        const user = {
            savedPosts: [],
            some: (fn: any) => false,
        };
        (Post.exists as jest.Mock).mockResolvedValue({ _id: POST_ID });
        (User.findById as jest.Mock).mockResolvedValue(user);
        (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
        (Post.findByIdAndUpdate as jest.Mock).mockResolvedValue(makePost({ savesCount: 1 }));

        const res = await request(app).post(`/api/posts/${POST_ID}/save`);

        expect(res.status).toBe(200);
        expect(res.body.saved).toBe(true);
        expect(res.body.savesCount).toBe(1);
    });

    it('unsaves a previously saved post', async () => {
        const user = {
            savedPosts: [{ toString: () => POST_ID }],
            some: (fn: any) => fn({ toString: () => POST_ID }),
        };
        (Post.exists as jest.Mock).mockResolvedValue({ _id: POST_ID });
        (User.findById as jest.Mock).mockResolvedValue(user);
        (User.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
        (Post.findByIdAndUpdate as jest.Mock).mockResolvedValue(makePost({ savesCount: 0 }));

        const res = await request(app).post(`/api/posts/${POST_ID}/save`);

        expect(res.status).toBe(200);
        expect(res.body.saved).toBe(false);
        expect(res.body.savesCount).toBe(0);
    });

    it('returns 404 when post does not exist', async () => {
        (Post.exists as jest.Mock).mockResolvedValue(null);

        const res = await request(app).post(`/api/posts/${POST_ID}/save`);

        expect(res.status).toBe(404);
    });
});

// POST /api/posts/smart-search

describe('POST /api/posts/smart-search', () => {
    const mockFindChain = (result: unknown[]) => {
        const chain = {
            populate: jest.fn().mockReturnThis(),
            sort:     jest.fn().mockReturnThis(),
            limit:    jest.fn().mockResolvedValue(result),
        };
        (Post.find as jest.Mock).mockReturnValue(chain);
        return chain;
    };

    it('returns posts for a valid prompt using AI plan', async () => {
        (buildSearchPlan as jest.Mock).mockResolvedValue({
            filters:     { category: 'clothing' },
            explanation: 'Looking for clothing items',
        });
        mockFindChain([makePost()]);

        const res = await request(app)
            .post('/api/posts/smart-search')
            .send({ prompt: 'show me vintage jackets' });

        expect(res.status).toBe(200);
        expect(res.body.posts).toHaveLength(1);
        expect(res.body.explanation).toBe('Looking for clothing items');
        expect(res.body.fallback).toBe(false);
    });

    it('falls back to keyword search when AI fails', async () => {
        (buildSearchPlan as jest.Mock).mockRejectedValue(new Error('Gemini error'));
        mockFindChain([]);

        const res = await request(app)
            .post('/api/posts/smart-search')
            .send({ prompt: 'blue denim jacket' });

        expect(res.status).toBe(200);
        expect(res.body.fallback).toBe(true);
        expect(res.body.explanation).toContain('blue denim jacket');
    });

    it('returns 400 when prompt is missing', async () => {
        const res = await request(app)
            .post('/api/posts/smart-search')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/prompt is required/i);
    });

    it('returns 400 when prompt exceeds 500 characters', async () => {
        const res = await request(app)
            .post('/api/posts/smart-search')
            .send({ prompt: 'x'.repeat(501) });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/500/);
    });
});
