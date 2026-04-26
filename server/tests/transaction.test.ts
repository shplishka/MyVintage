import request from 'supertest';
import express, { Application } from 'express';

/* ── mocks must be declared before any imports that use them ── */

jest.mock('../src/models/Transaction');
jest.mock('../src/models/Offer');
jest.mock('../src/models/Post');

jest.mock('../src/middleware/auth.middleware', () => ({
    authenticate: jest.fn(),
}));

/* ── imports ── */

import Transaction from '../src/models/Transaction';
import Offer       from '../src/models/Offer';
import Post        from '../src/models/Post';
import { authenticate } from '../src/middleware/auth.middleware';
import transactionRoutes from '../src/routes/transaction.routes';
import { OfferStatus, TransactionStatus, PaymentMethod } from '../src/types/marketplace';

/* ── test app ── */

const app: Application = express();
app.use(express.json());
app.use('/api/transactions', transactionRoutes);

/* ── shared fixtures ── */

const SELLER_ID      = 'seller111';
const BUYER_ID       = 'buyer222';
const OTHER_ID       = 'other333';
const POST_ID        = 'post001';
const OFFER_ID       = 'offer001';
const TRANSACTION_ID = 'txn001';

const makeOffer = (overrides: Record<string, unknown> = {}) => ({
    _id:        { toString: () => OFFER_ID },
    sale:       { toString: () => POST_ID },
    buyer:      { toString: () => BUYER_ID },
    seller:     { toString: () => SELLER_ID },
    offerPrice: 60,
    status:     OfferStatus.Accepted,
    ...overrides,
});

const makeTransaction = (overrides: Record<string, unknown> = {}) => ({
    _id:           { toString: () => TRANSACTION_ID },
    sale:          { toString: () => POST_ID },
    buyer:         { toString: () => BUYER_ID },
    seller:        { toString: () => SELLER_ID },
    offer:         { toString: () => OFFER_ID },
    paymentMethod: PaymentMethod.Cash,
    status:        TransactionStatus.Pending,
    updateOne:     jest.fn().mockResolvedValue({}),
    ...overrides,
});

const makePopulatedTxn = (overrides: Record<string, unknown> = {}) => ({
    ...makeTransaction(),
    sale:   { _id: POST_ID,   title: 'Vintage Jacket', images: [], price: 75, status: 'pending' },
    buyer:  { _id: BUYER_ID,  username: 'buyer_user',  profilePicture: null },
    seller: { _id: SELLER_ID, username: 'seller_user', profilePicture: null },
    offer:  { _id: OFFER_ID,  offerPrice: 60, message: 'Test' },
    ...overrides,
});

/** Build a chainable mock for Transaction.find() with pagination support. */
const mockTxnFind = (result: unknown[]) => {
    const chain = {
        populate: jest.fn().mockReturnThis(),
        sort:     jest.fn().mockReturnThis(),
        skip:     jest.fn().mockReturnThis(),
        limit:    jest.fn().mockResolvedValue(result),
    };
    (Transaction.find as jest.Mock).mockReturnValue(chain);
    return chain;
};

const validBody = {
    offerId:       OFFER_ID,
    paymentMethod: PaymentMethod.Cash,
    meetupLocation: 'Central Park',
    meetupTime:    '2024-06-15T14:00:00.000Z',
};

beforeEach(() => {
    jest.clearAllMocks();

    // Default: authenticated as buyer
    (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
        req.jwtUser = { userId: BUYER_ID, email: 'buyer@test.com' };
        next();
    });
});

/* ════════════════════════════════════════════════════════════
   POST /api/transactions — createTransaction
════════════════════════════════════════════════════════════ */

describe('POST /api/transactions', () => {

    it('creates a transaction and returns 201 with fully populated data', async () => {
        const populated = makePopulatedTxn();
        const created   = { ...makeTransaction(), populate: jest.fn().mockResolvedValue(populated) };

        (Offer.findById       as jest.Mock).mockResolvedValue(makeOffer());
        (Transaction.exists   as jest.Mock).mockResolvedValue(null);
        (Transaction.create   as jest.Mock).mockResolvedValue(created);

        const res = await request(app)
            .post('/api/transactions')
            .send(validBody);

        expect(res.status).toBe(201);
        // buyer/seller come directly from offer.buyer/offer.seller (ObjectId-like mock objects)
        // so we only assert on fields that are plain values
        expect(Transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                paymentMethod:  PaymentMethod.Cash,
                meetupLocation: 'Central Park',
            })
        );
        // Verify the create received the mock offer's buyer/seller references
        const [txnArg] = (Transaction.create as jest.Mock).mock.calls[0];
        expect(txnArg.buyer.toString()).toBe(BUYER_ID);
        expect(txnArg.seller.toString()).toBe(SELLER_ID);
        expect(created.populate).toHaveBeenCalled();
    });

    it('returns 400 when offerId is missing', async () => {
        const res = await request(app)
            .post('/api/transactions')
            .send({ paymentMethod: PaymentMethod.Cash });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/required/i);
        expect(Transaction.create).not.toHaveBeenCalled();
    });

    it('returns 400 when paymentMethod is missing', async () => {
        const res = await request(app)
            .post('/api/transactions')
            .send({ offerId: OFFER_ID });

        expect(res.status).toBe(400);
        expect(Transaction.create).not.toHaveBeenCalled();
    });

    it('returns 404 when the offer does not exist', async () => {
        (Offer.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .post('/api/transactions')
            .send(validBody);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Offer not found.');
        expect(Transaction.create).not.toHaveBeenCalled();
    });

    it('returns 409 when the offer is still pending (not accepted)', async () => {
        (Offer.findById as jest.Mock).mockResolvedValue(
            makeOffer({ status: OfferStatus.Pending })
        );

        const res = await request(app)
            .post('/api/transactions')
            .send(validBody);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/accepted offer/i);
        expect(Transaction.create).not.toHaveBeenCalled();
    });

    it('returns 409 when the offer was declined', async () => {
        (Offer.findById as jest.Mock).mockResolvedValue(
            makeOffer({ status: OfferStatus.Declined })
        );

        const res = await request(app)
            .post('/api/transactions')
            .send(validBody);

        expect(res.status).toBe(409);
        expect(Transaction.create).not.toHaveBeenCalled();
    });

    it('returns 403 when a non-buyer tries to create the transaction', async () => {
        (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.jwtUser = { userId: OTHER_ID };
            next();
        });
        (Offer.findById as jest.Mock).mockResolvedValue(makeOffer());

        const res = await request(app)
            .post('/api/transactions')
            .send(validBody);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/only the buyer/i);
        expect(Transaction.create).not.toHaveBeenCalled();
    });

    it('returns 409 when a transaction already exists for this offer', async () => {
        (Offer.findById     as jest.Mock).mockResolvedValue(makeOffer());
        (Transaction.exists as jest.Mock).mockResolvedValue({ _id: 'existing' });

        const res = await request(app)
            .post('/api/transactions')
            .send(validBody);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already exists/i);
        expect(Transaction.create).not.toHaveBeenCalled();
    });
});

/* ════════════════════════════════════════════════════════════
   GET /api/transactions/buying — getBuyingHistory
════════════════════════════════════════════════════════════ */

describe('GET /api/transactions/buying', () => {

    it('returns a paginated list of purchase transactions', async () => {
        mockTxnFind([makeTransaction(), makeTransaction()]);
        (Transaction.countDocuments as jest.Mock).mockResolvedValue(2);

        const res = await request(app).get('/api/transactions/buying');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(res.body.pagination).toMatchObject({ total: 2, page: 1, hasNext: false });
        expect(Transaction.find).toHaveBeenCalledWith({ buyer: BUYER_ID });
    });

    it('respects page and limit query params', async () => {
        mockTxnFind([makeTransaction()]);
        (Transaction.countDocuments as jest.Mock).mockResolvedValue(25);

        const res = await request(app).get('/api/transactions/buying?page=2&limit=10');

        expect(res.status).toBe(200);
        expect(res.body.pagination).toMatchObject({ page: 2, limit: 10, total: 25, hasNext: true });
    });

    it('caps limit at 50 regardless of query param', async () => {
        const chain = mockTxnFind([]);
        (Transaction.countDocuments as jest.Mock).mockResolvedValue(0);

        await request(app).get('/api/transactions/buying?limit=999');

        expect(chain.limit).toHaveBeenCalledWith(50);
    });

    it('returns empty data array when buyer has no transactions', async () => {
        mockTxnFind([]);
        (Transaction.countDocuments as jest.Mock).mockResolvedValue(0);

        const res = await request(app).get('/api/transactions/buying');

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
        expect(res.body.pagination.total).toBe(0);
    });
});

/* ════════════════════════════════════════════════════════════
   GET /api/transactions/selling — getSellingHistory
════════════════════════════════════════════════════════════ */

describe('GET /api/transactions/selling', () => {

    beforeEach(() => {
        (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.jwtUser = { userId: SELLER_ID };
            next();
        });
    });

    it('returns a paginated list of sale transactions', async () => {
        mockTxnFind([makeTransaction()]);
        (Transaction.countDocuments as jest.Mock).mockResolvedValue(1);

        const res = await request(app).get('/api/transactions/selling');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(Transaction.find).toHaveBeenCalledWith({ seller: SELLER_ID });
    });
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/transactions/:transactionId/complete — completeTransaction
════════════════════════════════════════════════════════════ */

describe('PATCH /api/transactions/:transactionId/complete', () => {

    it('completes the transaction and marks the listing as sold', async () => {
        const raw       = makeTransaction();
        const populated = makePopulatedTxn({ status: TransactionStatus.Completed });

        (Transaction.findById as jest.Mock)
            .mockResolvedValueOnce(raw)
            .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(populated) });

        (Post.updateOne as jest.Mock).mockResolvedValue({});

        const res = await request(app)
            .patch(`/api/transactions/${TRANSACTION_ID}/complete`);

        expect(res.status).toBe(200);

        // Listing should be marked sold with buyer and soldAt recorded
        expect(Post.updateOne).toHaveBeenCalledWith(
            { _id: raw.sale },
            expect.objectContaining({ status: 'sold', buyer: raw.buyer })
        );

        // Transaction updateOne should record completed status and timestamp
        expect(raw.updateOne).toHaveBeenCalledWith(
            expect.objectContaining({ status: TransactionStatus.Completed, completedAt: expect.any(Date) })
        );
    });

    it('allows the seller to complete the transaction', async () => {
        (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.jwtUser = { userId: SELLER_ID };
            next();
        });

        const raw       = makeTransaction();
        const populated = makePopulatedTxn({ status: TransactionStatus.Completed });

        (Transaction.findById as jest.Mock)
            .mockResolvedValueOnce(raw)
            .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(populated) });

        (Post.updateOne as jest.Mock).mockResolvedValue({});

        const res = await request(app)
            .patch(`/api/transactions/${TRANSACTION_ID}/complete`);

        expect(res.status).toBe(200);
    });

    it('returns 404 when the transaction does not exist', async () => {
        (Transaction.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .patch(`/api/transactions/${TRANSACTION_ID}/complete`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Transaction not found.');
    });

    it('returns 403 when a third party tries to complete the transaction', async () => {
        (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.jwtUser = { userId: OTHER_ID };
            next();
        });
        (Transaction.findById as jest.Mock).mockResolvedValue(makeTransaction());

        const res = await request(app)
            .patch(`/api/transactions/${TRANSACTION_ID}/complete`);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/buyer or seller/i);
    });

    it('returns 409 when the transaction is already completed', async () => {
        (Transaction.findById as jest.Mock).mockResolvedValue(
            makeTransaction({ status: TransactionStatus.Completed })
        );

        const res = await request(app)
            .patch(`/api/transactions/${TRANSACTION_ID}/complete`);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already completed/i);
    });
});

/* ════════════════════════════════════════════════════════════
   PATCH /api/transactions/:transactionId/dispute — disputeTransaction
════════════════════════════════════════════════════════════ */

describe('PATCH /api/transactions/:transactionId/dispute', () => {

    it('disputes the transaction, restores listing to active, and declines the offer', async () => {
        const raw       = makeTransaction();
        const populated = makePopulatedTxn({ status: TransactionStatus.Disputed });

        (Transaction.findById as jest.Mock)
            .mockResolvedValueOnce(raw)
            .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(populated) });

        (Post.updateOne  as jest.Mock).mockResolvedValue({});
        (Offer.updateOne as jest.Mock).mockResolvedValue({});

        const res = await request(app)
            .patch(`/api/transactions/${TRANSACTION_ID}/dispute`);

        expect(res.status).toBe(200);

        // Listing should be restored to active
        expect(Post.updateOne).toHaveBeenCalledWith(
            { _id: raw.sale },
            { status: 'active' }
        );

        // The accepted offer should be declined to fully undo the sale
        expect(Offer.updateOne).toHaveBeenCalledWith(
            { _id: raw.offer, status: OfferStatus.Accepted },
            { status: OfferStatus.Declined }
        );

        // Transaction updateOne should record disputed status
        expect(raw.updateOne).toHaveBeenCalledWith({ status: TransactionStatus.Disputed });
    });

    it('allows the seller to raise a dispute', async () => {
        (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.jwtUser = { userId: SELLER_ID };
            next();
        });

        const raw       = makeTransaction();
        const populated = makePopulatedTxn({ status: TransactionStatus.Disputed });

        (Transaction.findById as jest.Mock)
            .mockResolvedValueOnce(raw)
            .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(populated) });

        (Post.updateOne  as jest.Mock).mockResolvedValue({});
        (Offer.updateOne as jest.Mock).mockResolvedValue({});

        const res = await request(app)
            .patch(`/api/transactions/${TRANSACTION_ID}/dispute`);

        expect(res.status).toBe(200);
    });

    it('returns 404 when the transaction does not exist', async () => {
        (Transaction.findById as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
            .patch(`/api/transactions/${TRANSACTION_ID}/dispute`);

        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Transaction not found.');
    });

    it('returns 403 when a third party tries to dispute', async () => {
        (authenticate as jest.Mock).mockImplementation((req: any, _res: any, next: any) => {
            req.jwtUser = { userId: OTHER_ID };
            next();
        });
        (Transaction.findById as jest.Mock).mockResolvedValue(makeTransaction());

        const res = await request(app)
            .patch(`/api/transactions/${TRANSACTION_ID}/dispute`);

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/buyer or seller/i);
    });

    it('returns 409 when the transaction is not in pending status', async () => {
        (Transaction.findById as jest.Mock).mockResolvedValue(
            makeTransaction({ status: TransactionStatus.Completed })
        );

        const res = await request(app)
            .patch(`/api/transactions/${TRANSACTION_ID}/dispute`);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already completed/i);
    });

    it('returns 409 when the transaction is already disputed', async () => {
        (Transaction.findById as jest.Mock).mockResolvedValue(
            makeTransaction({ status: TransactionStatus.Disputed })
        );

        const res = await request(app)
            .patch(`/api/transactions/${TRANSACTION_ID}/dispute`);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already disputed/i);
    });
});
