import request from 'supertest';
import express, { Application } from 'express';

// Mocks

jest.mock('../src/models/Post');

jest.mock('../src/middleware/auth.middleware', () => ({
    authenticate: jest.fn((req: any, _res: any, next: any) => {
        req.jwtUser = { userId: 'seller123', email: 'seller@example.com' };
        next();
    }),
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

import Post from '../src/models/Post';
import postRoutes from '../src/routes/post.routes';

//Test app (no DB connection, no listen)

const app: Application = express();
app.use(express.json());
app.use('/api/posts', postRoutes);

//Shared fixtures

const SELLER_ID = 'seller123';
const OTHER_ID  = 'other456';
const POST_ID   = 'post789';

const makePost = (overrides: Record<string, unknown> = {}) => ({
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
    images:      [],
    status:      'active',
    save:        jest.fn().mockResolvedValue(undefined),
    deleteOne:   jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

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

// helper: make Post.find() return a chainable mock
const mockFind = (result: unknown[]) => {
    const chain = {
        populate: jest.fn().mockReturnThis(),
        sort:     jest.fn().mockResolvedValue(result),
    };
    (Post.find as jest.Mock).mockReturnValue(chain);
    return chain;
};

// helper: make Post.findById() return a chainable mock
const mockFindById = (result: unknown) => {
    const chain = { populate: jest.fn().mockResolvedValue(result) };
    (Post.findById as jest.Mock).mockReturnValue(chain);
    return chain;
};

//POST /api/posts

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

//GET /api/posts

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
        const post = makePost({ images: ['/media/posts/post789/existing.jpg'] });
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
        const post = makePost({ images: new Array(9).fill('/media/posts/post789/x.jpg') });
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
