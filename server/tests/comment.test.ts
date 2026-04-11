import request from 'supertest';
import express, { Application } from 'express';

//  Mocks (must be before imports) 

jest.mock('../src/models/Comment');
jest.mock('../src/models/Post');

jest.mock('../src/middleware/auth.middleware', () => ({
    authenticate: jest.fn((req: any, _res: any, next: any) => {
        req.jwtUser = { userId: 'author123', email: 'author@example.com' };
        next();
    }),
}));

//  Imports

import Comment      from '../src/models/Comment';
import Post         from '../src/models/Post';
import commentRoutes from '../src/routes/comment.routes';

//  Test app (no DB, no listen) 

const app: Application = express();
app.use(express.json());
app.use('/api/posts/:postId/comments', commentRoutes);
app.use('/api/comments', commentRoutes);

//  Shared fixtures 

const AUTHOR_ID  = 'author123'; // matches jwtUser.userId injected by mock
const OTHER_ID   = 'other456';
const SELLER_ID  = 'seller789';
const POST_ID    = 'post111';
const COMMENT_ID = 'comment222';

const makeComment = (overrides: Record<string, unknown> = {}) => ({
    _id:       COMMENT_ID,
    post:      POST_ID,
    author:    { toString: () => AUTHOR_ID },
    content:   'Love this jacket!',
    save:      jest.fn().mockResolvedValue(undefined),
    populate:  jest.fn().mockResolvedValue(undefined),
    deleteOne: jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

const makePost = (overrides: Record<string, unknown> = {}) => ({
    _id:    POST_ID,
    seller: { toString: () => SELLER_ID },
    ...overrides,
});

// helper: mock Comment.find chain — .populate().sort()
const mockCommentFind = (result: unknown[]) => {
    const chain = {
        populate: jest.fn().mockReturnThis(),
        sort:     jest.fn().mockResolvedValue(result),
    };
    (Comment.find as jest.Mock).mockReturnValue(chain);
    return chain;
};

//  POST /api/posts/:postId/comments 

describe('POST /api/posts/:postId/comments', () => {
    it('creates a comment and returns 201', async () => {
        const comment = makeComment();
        (Post.findById as jest.Mock).mockResolvedValue(makePost());
        (Comment.create as jest.Mock).mockResolvedValue(comment);
        (Post.findByIdAndUpdate as jest.Mock).mockResolvedValue(undefined);

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/comments`)
            .send({ content: 'Love this jacket!' });

        expect(res.status).toBe(201);
        expect(Comment.create).toHaveBeenCalledWith(
            expect.objectContaining({ post: POST_ID, author: AUTHOR_ID, content: 'Love this jacket!' })
        );
        expect(Post.findByIdAndUpdate).toHaveBeenCalledWith(
            POST_ID, { $inc: { commentsCount: 1 } }
        );
    });

    it('returns 400 when content is missing', async () => {
        const res = await request(app)
            .post(`/api/posts/${POST_ID}/comments`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/content is required/i);
    });

    it('returns 404 when post does not exist', async () => {
        (Post.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/comments`)
            .send({ content: 'Love this jacket!' });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Post not found');
    });
});

//  GET /api/posts/:postId/comments 

describe('GET /api/posts/:postId/comments', () => {
    it('returns a list of comments for a post', async () => {
        (Post.findById as jest.Mock).mockResolvedValue(makePost());
        mockCommentFind([makeComment(), makeComment()]);

        const res = await request(app).get(`/api/posts/${POST_ID}/comments`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);
    });

    it('returns an empty array when post has no comments', async () => {
        (Post.findById as jest.Mock).mockResolvedValue(makePost());
        mockCommentFind([]);

        const res = await request(app).get(`/api/posts/${POST_ID}/comments`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns 404 when post does not exist', async () => {
        (Post.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app).get(`/api/posts/${POST_ID}/comments`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Post not found');
    });
});

//  PUT /api/comments/:id 

describe('PUT /api/comments/:id', () => {
    it('updates a comment and returns 200', async () => {
        const comment = makeComment();
        (Comment.findById as jest.Mock).mockResolvedValue(comment);

        const res = await request(app)
            .put(`/api/comments/${COMMENT_ID}`)
            .send({ content: 'Updated content' });

        expect(res.status).toBe(200);
        expect(comment.save).toHaveBeenCalled();
    });

    it('returns 400 when content is missing', async () => {
        const res = await request(app)
            .put(`/api/comments/${COMMENT_ID}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/content is required/i);
    });

    it('returns 404 when comment does not exist', async () => {
        (Comment.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .put(`/api/comments/${COMMENT_ID}`)
            .send({ content: 'Updated content' });

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Comment not found');
    });

    it('returns 403 when requester is not the author', async () => {
        const comment = makeComment({ author: { toString: () => OTHER_ID } });
        (Comment.findById as jest.Mock).mockResolvedValue(comment);

        const res = await request(app)
            .put(`/api/comments/${COMMENT_ID}`)
            .send({ content: 'Updated content' });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/only edit your own comments/i);
    });
});

//  DELETE /api/comments/:id 

describe('DELETE /api/comments/:id', () => {
    it('allows the comment author to delete', async () => {
        const comment = makeComment(); // author === AUTHOR_ID === jwtUser.userId
        (Comment.findById as jest.Mock).mockResolvedValue(comment);
        (Post.findById as jest.Mock).mockResolvedValue(makePost());
        (Post.findByIdAndUpdate as jest.Mock).mockResolvedValue(undefined);

        const res = await request(app).delete(`/api/comments/${COMMENT_ID}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Comment deleted successfully');
        expect(comment.deleteOne).toHaveBeenCalled();
        expect(Post.findByIdAndUpdate).toHaveBeenCalledWith(
            POST_ID, { $inc: { commentsCount: -1 } }
        );
    });

    it('allows the post seller to delete a comment by another user', async () => {
        // comment author is OTHER_ID, but post seller === AUTHOR_ID (jwtUser.userId)
        const comment = makeComment({ author: { toString: () => OTHER_ID } });
        const post    = makePost({ seller: { toString: () => AUTHOR_ID } });

        (Comment.findById as jest.Mock).mockResolvedValue(comment);
        (Post.findById as jest.Mock).mockResolvedValue(post);
        (Post.findByIdAndUpdate as jest.Mock).mockResolvedValue(undefined);

        const res = await request(app).delete(`/api/comments/${COMMENT_ID}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Comment deleted successfully');
        expect(comment.deleteOne).toHaveBeenCalled();
    });

    it('returns 403 when requester is neither author nor post seller', async () => {
        const comment = makeComment({ author: { toString: () => OTHER_ID } });
        const post    = makePost({ seller: { toString: () => SELLER_ID } });

        (Comment.findById as jest.Mock).mockResolvedValue(comment);
        (Post.findById as jest.Mock).mockResolvedValue(post);

        const res = await request(app).delete(`/api/comments/${COMMENT_ID}`);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/comment author or post owner/i);
    });

    it('returns 404 when comment does not exist', async () => {
        (Comment.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app).delete(`/api/comments/${COMMENT_ID}`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Comment not found');
    });
});
