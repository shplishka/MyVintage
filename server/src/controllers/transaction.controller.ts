import { Request, Response } from 'express';
import Transaction from '../models/Transaction';
import Offer from '../models/Offer';
import Post, { PostStatus } from '../models/Post';
import { OfferStatus, TransactionStatus } from '../types/marketplace';
import Offer from '../models/Offer';

const POPULATE_SALE   = { path: 'sale',   select: 'title images price status' };
const POPULATE_BUYER  = { path: 'buyer',  select: 'username profilePicture'   };
const POPULATE_SELLER = { path: 'seller', select: 'username profilePicture'   };
const POPULATE_OFFER  = { path: 'offer',  select: 'offerPrice message'        };

/* ─────────────────────────────────────────────────────────────
   POST /api/transactions
   Create a transaction from an accepted offer.
   Body: { offerId, paymentMethod, meetupLocation?, meetupTime? }
───────────────────────────────────────────────────────────── */
export const createTransaction = async (req: Request, res: Response): Promise<void> => {
    const { offerId, paymentMethod, meetupLocation, meetupTime } = req.body;

    if (!offerId || !paymentMethod) {
        res.status(400).json({ message: 'offerId and paymentMethod are required.' });
        return;
    }

    const offer = await Offer.findById(offerId);

    if (!offer) {
        res.status(404).json({ message: 'Offer not found.' });
        return;
    }

    if (offer.status !== OfferStatus.Accepted) {
        res.status(409).json({ message: 'A transaction can only be created from an accepted offer.' });
        return;
    }

    // Only the buyer may initiate the transaction.
    if (offer.buyer.toString() !== req.jwtUser!.userId) {
        res.status(403).json({ message: 'Only the buyer of this offer can create a transaction.' });
        return;
    }

    // Prevent duplicate transactions for the same offer.
    const existing = await Transaction.exists({ offer: offer._id });
    if (existing) {
        res.status(409).json({ message: 'A transaction already exists for this offer.' });
        return;
    }

    const transaction = await Transaction.create({
        sale:           offer.sale,
        buyer:          offer.buyer,
        seller:         offer.seller,
        offer:          offer._id,
        paymentMethod,
        meetupLocation: meetupLocation ?? undefined,
        meetupTime:     meetupTime     ?? undefined,
        status:         TransactionStatus.Pending,
    });

    const populated = await transaction.populate([
        POPULATE_SALE, POPULATE_BUYER, POPULATE_SELLER, POPULATE_OFFER,
    ]);

    res.status(201).json(populated);
};

/* ─────────────────────────────────────────────────────────────
   GET /api/transactions/buying?page=1&limit=20
   All transactions where the logged-in user is the buyer,
   sorted newest first with cursor-style pagination.
───────────────────────────────────────────────────────────── */
export const getBuyingHistory = async (req: Request, res: Response): Promise<void> => {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip  = (page - 1) * limit;

    const filter = { buyer: req.jwtUser!.userId };

    const [transactions, total] = await Promise.all([
        Transaction.find(filter)
            .populate([POPULATE_SALE, POPULATE_SELLER, POPULATE_OFFER])
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Transaction.countDocuments(filter),
    ]);

    res.json({
        data:       transactions,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNext:    page * limit < total,
        },
    });
};

/* ─────────────────────────────────────────────────────────────
   GET /api/transactions/selling?page=1&limit=20
   All transactions where the logged-in user is the seller,
   sorted newest first with cursor-style pagination.
───────────────────────────────────────────────────────────── */
export const getSellingHistory = async (req: Request, res: Response): Promise<void> => {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip  = (page - 1) * limit;

    const filter = { seller: req.jwtUser!.userId };

    const [transactions, total] = await Promise.all([
        Transaction.find(filter)
            .populate([POPULATE_SALE, POPULATE_BUYER, POPULATE_OFFER])
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        Transaction.countDocuments(filter),
    ]);

    res.json({
        data:       transactions,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNext:    page * limit < total,
        },
    });
};

/* ─────────────────────────────────────────────────────────────
   PATCH /api/transactions/:transactionId/complete
   Mark a transaction as completed.
   Either the buyer or seller may confirm completion.
   Side-effects:
     • Sets completedAt timestamp.
     • Marks the listing as Sold and records the buyer.
───────────────────────────────────────────────────────────── */
export const completeTransaction = async (req: Request, res: Response): Promise<void> => {
    const transaction = await Transaction.findById(req.params.transactionId);

    if (!transaction) {
        res.status(404).json({ message: 'Transaction not found.' });
        return;
    }

    const callerId = req.jwtUser!.userId;
    const isBuyer  = transaction.buyer.toString()  === callerId;
    const isSeller = transaction.seller.toString() === callerId;

    if (!isBuyer && !isSeller) {
        res.status(403).json({ message: 'Only the buyer or seller of this transaction can mark it as complete.' });
        return;
    }

    if (transaction.status !== TransactionStatus.Pending) {
        res.status(409).json({ message: `Cannot complete a transaction that is already ${transaction.status}.` });
        return;
    }

    const now = new Date();

    await Promise.all([
        transaction.updateOne({
            status:      TransactionStatus.Completed,
            completedAt: now,
        }),
        // Mark the listing as sold and record who bought it.
        Post.updateOne(
            { _id: transaction.sale },
            { status: PostStatus.Sold, buyer: transaction.buyer, soldAt: now }
        ),
    ]);

    const updated = await Transaction.findById(transaction._id)
        .populate([POPULATE_SALE, POPULATE_BUYER, POPULATE_SELLER, POPULATE_OFFER]);

    res.json(updated);
};

/* ─────────────────────────────────────────────────────────────
   PATCH /api/transactions/:transactionId/dispute
   Raise a dispute on a pending transaction.
   Either the buyer or seller may open a dispute.
   Side-effects (fully undoes the sale):
     • Transaction status → Disputed
     • Listing status     → Active   (available for new offers again)
     • Accepted offer     → Declined (offer is no longer in-flight)
───────────────────────────────────────────────────────────── */
export const disputeTransaction = async (req: Request, res: Response): Promise<void> => {
    const transaction = await Transaction.findById(req.params.transactionId);

    if (!transaction) {
        res.status(404).json({ message: 'Transaction not found.' });
        return;
    }

    const callerId = req.jwtUser!.userId;
    const isBuyer  = transaction.buyer.toString()  === callerId;
    const isSeller = transaction.seller.toString() === callerId;

    if (!isBuyer && !isSeller) {
        res.status(403).json({ message: 'Only the buyer or seller of this transaction can raise a dispute.' });
        return;
    }

    if (transaction.status !== TransactionStatus.Pending) {
        res.status(409).json({ message: `Cannot dispute a transaction that is already ${transaction.status}.` });
        return;
    }

    await Promise.all([
        // Mark the transaction itself as disputed.
        transaction.updateOne({ status: TransactionStatus.Disputed }),

        // Restore the listing to active so new offers can be submitted.
        Post.updateOne(
            { _id: transaction.sale },
            { status: PostStatus.Active }
        ),

        // Decline the accepted offer so it is no longer treated as in-flight.
        Offer.updateOne(
            { _id: transaction.offer, status: OfferStatus.Accepted },
            { status: OfferStatus.Declined }
        ),
    ]);

    const updated = await Transaction.findById(transaction._id)
        .populate([POPULATE_SALE, POPULATE_BUYER, POPULATE_SELLER, POPULATE_OFFER]);

    res.json(updated);
};
