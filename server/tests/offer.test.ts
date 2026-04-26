import request from 'supertest';
import express, { Application } from 'express';

/* ── mocks must be declared before any imports that use them ── */

jest.mock('../src/models/Offer');
jest.mock('../src/models/Post');

jest.mock('../src/middleware/auth.middleware', () => ({
    authenticate: jest.fn(),
}));

jest.mock('../src/middleware/activeListing.middleware', () => ({
    requireActiveListing: jest.fn(),
}));

/* ── imports ── */

import Offer from '../src/models/Offer';
import Post  from '../src/models/Post';
import { authenticate }        from '../src/middleware/auth.middleware';
import { requireActiveListing } from '../src/middleware/activeListing.middleware';
import offerRoutes from '../src/routes/offer.routes';
import { OfferStatus } from '../src/types/marketplace';

/* ── test app ── */

const app: Application = express();
app.use(express.json());
app.use('/api/posts',  offerRoutes);   // POST /:postId/offers
app.use('/api/offers', offerRoutes);   // GET + PATCH routes

/* ── shared fixtures ── */

const SELLER_ID = 'seller111';
const BUYER_ID  = 'buyer222';
const OTHER_ID  = 'other333';
const POST_ID   = 'post001';
const OFFER_ID  = 'offer001';

const makePost = (overrides: Record<string, unknown> = {}) => ({
    _id:    { toString: () => POST_ID },
    seller: { toString: () => SELLER_ID },
    status: 'active',
    ...overrides,
});

const makeOffer = (overrides: Record<string, unknown> = {}) => ({
    _id:       { toString: () => OFFER_ID },
    sale:      { toString: () => POST_ID },
    buyer:     { toString: () => BUYER_ID },
    seller:    { toString: () => SELLER_ID },
    offerPrice: 60,
    message:   'Would you take $60?',
    status:    OfferStatus.Pending,
    updateOne: jest.fn().mockResolvedValue({}),
    ...overrides,
});

const makePopulated = (overrides: Record<string, unknown> = {}) => ({
    ...makeOffer(),
    buyer:  { _id: BUYER_ID,  username: 'buyer_user',  profilePicture: null },
    sale:   { _id: POST_ID,   title: 'Vintage Jacket', images: [],   price: 75, status: 'active' },
    seller: { _id: SELLER_ID, username: 'seller_user', profilePicture: null },
    ...overrides,
});

/**
 * Make a chainable populate mock that can be awaited.
 * Handles controllers that chain .populate().populate() before await.
 */
function makePopulateChain(result: unknown) {
    const chain: any = {};
    chain.populate = jest.fn().mockReturnValue(chain);
    // Make thenable so `await chain` resolves to result
    chain.then = (onFulfilled: any, onRejected: any) =>
        Promise.resolve(result).then(onFulfilled, onRejected);
    return chain;
}

/** Make Offer.find() return a chainable mock ending in a resolved array. */
const mockOfferFind = (result: unknown[]) => {
    const chain = {
        populate: jest.fn().mockReturnThis(),
        sort:     jest.fn().mockResolvedValue(result),
    };
    (Offer.find as jest.Mock).mockReturnValue(chain);
    return chain;
};

beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated as buyer
    (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
        req.jwtUser = { userId: BUYER_ID, email: 'buyer@test.com' };
        next();
    });

    // Default: listing is active
    (requireActiveListing as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
        req.post = makePost();
        next();
    });
});

/* ════════════════════════════════════════════════════════════
   POST /api/posts/:postId/offers — createOffer
════════════════════════════════════════════════════════════ */

describe('POST /api/posts/:postId/offers', () => {

    it('creates an offer and returns 201 with populated data', async () => {
        const populated = makePopulated();
        const created   = { ...makeOffer(), populate: jest.fn().mockResolvedValue(populated) };

        (Offer.exists  as jest.Mock).mockResolvedValue(null);
        (Offer.create  as jest.Mock).mockResolvedValue(created);

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/offers`)
            .send({ offerPrice: 60, message: 'Would you take $60?' });

        expect(res.status).toBe(201);
        expect(Offer.create).toHaveBeenCalledWith(
            expect.objectContaining({ offerPrice: 60, buyer: BUYER_ID })
        );
        expect(created.populate).toHaveBeenCalled();
    });

    it('returns 400 when offerPrice is missing', async () => {
        const res = await request(app)
            .post(`/api/posts/${POST_ID}/offers`)
            .send({ message: 'No price here' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/positive number/i);
    });

    it('returns 400 when offerPrice is zero', async () => {
        const res = await request(app)
            .post(`/api/posts/${POST_ID}/offers`)
            .send({ offerPrice: 0 });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/positive number/i);
    });

    it('returns 400 when the seller tries to offer on their own listing', async () => {
        // Authenticate as the seller (same ID as post.seller)
        (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.jwtUser = { userId: SELLER_ID };
            next();
        });

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/offers`)
            .send({ offerPrice: 50 });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/own listing/i);
        expect(Offer.create).not.toHaveBeenCalled();
    });

    it('returns 409 when a pending offer already exists from this buyer', async () => {
        (Offer.exists as jest.Mock).mockResolvedValue({ _id: 'existing' });

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/offers`)
            .send({ offerPrice: 60 });

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/pending offer/i);
        expect(Offer.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the listing does not exist (middleware blocks)', async () => {
        (requireActiveListing as jest.Mock).mockImplementation((_req: any, res: any) => {
            res.status(404).json({ message: 'Post not found.' });
        });

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/offers`)
            .send({ offerPrice: 60 });

        expect(res.status).toBe(404);
        expect(Offer.create).not.toHaveBeenCalled();
    });

    it('returns 410 when the listing is already sold (middleware blocks)', async () => {
        (requireActiveListing as jest.Mock).mockImplementation((_req: any, res: any) => {
            res.status(410).json({ message: 'This item has already been sold.' });
        });

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/offers`)
            .send({ offerPrice: 60 });

        expect(res.status).toBe(410);
        expect(Offer.create).not.toHaveBeenCalled();
    });

    it('returns 409 when the listing has a pending accepted offer (middleware blocks)', async () => {
        (requireActiveListing as jest.Mock).mockImplementation((_req: any, res: any) => {
            res.status(409).json({ message: 'This item already has an accepted offer.' });
        });

        const res = await request(app)
            .post(`/api/posts/${POST_ID}/offers`)
            .send({ offerPrice: 60 });

        expect(res.status).toBe(409);
        expect(Offer.create).not.toHaveBeenCalled();
    });
});

/* ════════════════════════════════════════════════════════════
   GET /api/offers/received — getReceivedOffers
════════════════════════════════════════════════════════════ */

describe('GET /api/offers/received', () => {

    it('returns offers grouped into four status buckets', async () => {
        const pending  = { ...makeOffer(), status: OfferStatus.Pending   };
        const accepted = { ...makeOffer(), status: OfferStatus.Accepted  };
        const declined = { ...makeOffer(), status: OfferStatus.Declined  };
        mockOfferFind([pending, accepted, declined]);

        const res = await request(app).get('/api/offers/received');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('pending');
        expect(res.body).toHaveProperty('accepted');
        expect(res.body).toHaveProperty('declined');
        expect(res.body).toHaveProperty('cancelled');
        expect(res.body.pending).toHaveLength(1);
        expect(res.body.accepted).toHaveLength(1);
        expect(res.body.declined).toHaveLength(1);
        expect(res.body.cancelled).toHaveLength(0);
    });

    it('returns empty buckets when seller has no offers', async () => {
        mockOfferFind([]);

        const res = await request(app).get('/api/offers/received');

        expect(res.status).toBe(200);
        expect(res.body.pending).toHaveLength(0);
        expect(res.body.accepted).toHaveLength(0);
    });
});

/* ════════════════════════════════════════════════════════════
   GET /api/offers/sent — getSentOffers
════════════════════════════════════════════════════════════ */

describe('GET /api/offers/sent', () => {

    it('returns all offers sent by the current user as an array', async () => {
        mockOfferFind([makeOffer(), makeOffer()]);

        const res = await request(app).get('/api/offers/sent');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);
        expect(Offer.find).toHaveBeenCalledWith({ buyer: BUYER_ID });
    });

    it('returns an empty array when buyer has submitted no offers', async () => {
        mockOfferFind([]);

        const res = await request(app).get('/api/offers/sent');

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/offers/:offerId/accept — acceptOffer
════════════════════════════════════════════════════════════ */

describe('PATCH /api/offers/:offerId/accept', () => {

    beforeEach(() => {
        // Accept routes are called by the seller
        (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.jwtUser = { userId: SELLER_ID };
            next();
        });
    });

    it('accepts a pending offer, locks the listing, and declines other offers', async () => {
        const raw       = makeOffer();
        const populated = makePopulated({ status: OfferStatus.Accepted });

        (Offer.findById as jest.Mock)
            .mockResolvedValueOnce(raw)
            .mockReturnValueOnce(makePopulateChain(populated));

        (Post.updateOne    as jest.Mock).mockResolvedValue({});
        (Offer.updateMany  as jest.Mock).mockResolvedValue({});

        const res = await request(app).patch(`/api/offers/${OFFER_ID}/accept`);

        expect(res.status).toBe(200);

        // Listing should be locked as pending (not yet sold — that happens at transaction completion)
        expect(Post.updateOne).toHaveBeenCalledWith(
            { _id: raw.sale },
            { status: 'pending' }
        );

        // All other pending offers on the same listing should be declined
        expect(Offer.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ sale: raw.sale, status: OfferStatus.Pending }),
            { status: OfferStatus.Declined }
        );
    });

    it('returns 404 when offer does not exist', async () => {
        (Offer.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app).patch(`/api/offers/${OFFER_ID}/accept`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Offer not found.');
    });

    it('returns 403 when a non-seller tries to accept', async () => {
        (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.jwtUser = { userId: OTHER_ID };
            next();
        });
        (Offer.findById as jest.Mock).mockResolvedValue(makeOffer());

        const res = await request(app).patch(`/api/offers/${OFFER_ID}/accept`);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/only the seller/i);
    });

    it('returns 409 when the offer is not pending', async () => {
        (Offer.findById as jest.Mock).mockResolvedValue(
            makeOffer({ status: OfferStatus.Accepted })
        );

        const res = await request(app).patch(`/api/offers/${OFFER_ID}/accept`);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already accepted/i);
    });
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/offers/:offerId/decline — declineOffer
════════════════════════════════════════════════════════════ */

describe('PATCH /api/offers/:offerId/decline', () => {

    beforeEach(() => {
        (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.jwtUser = { userId: SELLER_ID };
            next();
        });
    });

    it('declines the offer and restores the listing to active when no other pending offers exist', async () => {
        const raw       = makeOffer();
        const populated = makePopulated({ status: OfferStatus.Declined });

        (Offer.findById as jest.Mock)
            .mockResolvedValueOnce(raw)
            .mockReturnValueOnce(makePopulateChain(populated));

        (Offer.exists   as jest.Mock).mockResolvedValue(null);   // no other pending offers
        (Post.updateOne as jest.Mock).mockResolvedValue({});

        const res = await request(app).patch(`/api/offers/${OFFER_ID}/decline`);

        expect(res.status).toBe(200);
        expect(Post.updateOne).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'pending' }),
            { status: 'active' }
        );
    });

    it('does not restore the listing when other pending offers still exist', async () => {
        const raw       = makeOffer();
        const populated = makePopulated({ status: OfferStatus.Declined });

        (Offer.findById as jest.Mock)
            .mockResolvedValueOnce(raw)
            .mockReturnValueOnce(makePopulateChain(populated));

        (Offer.exists as jest.Mock).mockResolvedValue({ _id: 'anotherOffer' });

        const res = await request(app).patch(`/api/offers/${OFFER_ID}/decline`);

        expect(res.status).toBe(200);
        expect(Post.updateOne).not.toHaveBeenCalled();
    });

    it('returns 403 when a non-seller tries to decline', async () => {
        (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.jwtUser = { userId: OTHER_ID };
            next();
        });
        (Offer.findById as jest.Mock).mockResolvedValue(makeOffer());

        const res = await request(app).patch(`/api/offers/${OFFER_ID}/decline`);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/only the seller/i);
    });

    it('returns 409 when the offer is not pending', async () => {
        (Offer.findById as jest.Mock).mockResolvedValue(
            makeOffer({ status: OfferStatus.Declined })
        );

        const res = await request(app).patch(`/api/offers/${OFFER_ID}/decline`);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already declined/i);
    });
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/offers/:offerId/cancel — cancelOffer
════════════════════════════════════════════════════════════ */

describe('PATCH /api/offers/:offerId/cancel', () => {

    it('cancels the offer and restores the listing to active when no other pending offers exist', async () => {
        const raw       = makeOffer();
        const populated = makePopulated({ status: OfferStatus.Cancelled });

        (Offer.findById as jest.Mock)
            .mockResolvedValueOnce(raw)
            .mockReturnValueOnce(makePopulateChain(populated));

        (Offer.exists   as jest.Mock).mockResolvedValue(null);
        (Post.updateOne as jest.Mock).mockResolvedValue({});

        const res = await request(app).patch(`/api/offers/${OFFER_ID}/cancel`);

        expect(res.status).toBe(200);
        expect(Post.updateOne).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'pending' }),
            { status: 'active' }
        );
    });

    it('returns 403 when a non-buyer tries to cancel', async () => {
        (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.jwtUser = { userId: OTHER_ID };
            next();
        });
        (Offer.findById as jest.Mock).mockResolvedValue(makeOffer());

        const res = await request(app).patch(`/api/offers/${OFFER_ID}/cancel`);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/only the buyer/i);
    });

    it('returns 409 when the offer is not pending', async () => {
        (Offer.findById as jest.Mock).mockResolvedValue(
            makeOffer({ status: OfferStatus.Accepted })
        );

        const res = await request(app).patch(`/api/offers/${OFFER_ID}/cancel`);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already accepted/i);
    });

    it('returns 404 when the offer does not exist', async () => {
        (Offer.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app).patch(`/api/offers/${OFFER_ID}/cancel`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Offer not found.');
    });
});
