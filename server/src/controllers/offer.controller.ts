import { Request, Response } from 'express';
import Offer from '../models/Offer';
import Post, { PostStatus } from '../models/Post';
import { OfferStatus } from '../types/marketplace';

/* ─────────────────────────────────────────────────────────────
   POST /api/posts/:postId/offers
   Create a new offer on an active listing.
   requireActiveListing middleware runs before this, so req.post
   is already populated and the listing is guaranteed to be active.
───────────────────────────────────────────────────────────── */
export const createOffer = async (req: Request, res: Response): Promise<void> => {
    const buyerId  = req.jwtUser!.userId;
    const post     = req.post!;

    if (post.seller.toString() === buyerId) {
        res.status(400).json({ message: 'You cannot make an offer on your own listing.' });
        return;
    }

    const { offerPrice, message } = req.body;

    if (!offerPrice || isNaN(Number(offerPrice)) || Number(offerPrice) <= 0) {
        res.status(400).json({ message: 'offerPrice must be a positive number.' });
        return;
    }

    // Enforce one active offer per buyer per listing.
    const existing = await Offer.exists({
        sale:   post._id,
        buyer:  buyerId,
        status: OfferStatus.Pending,
    });

    if (existing) {
        res.status(409).json({ message: 'You already have a pending offer on this listing. Cancel it before submitting a new one.' });
        return;
    }

    const created = await Offer.create({
        sale:       post._id,
        buyer:      buyerId,
        seller:     post.seller,
        offerPrice: Number(offerPrice),
        message:    message ?? undefined,
        status:     OfferStatus.Pending,
    });

    const offer = await created.populate([
        { path: 'buyer', select: 'username profilePicture' },
        { path: 'sale',  select: 'title images price'      },
    ]);

    res.status(201).json(offer);
};

/* ─────────────────────────────────────────────────────────────
   GET /api/offers/received
   All offers on listings owned by the logged-in user,
   grouped by status.
───────────────────────────────────────────────────────────── */
export const getReceivedOffers = async (req: Request, res: Response): Promise<void> => {
    const offers = await Offer.find({ seller: req.jwtUser!.userId })
        .populate('sale',  'title images price')
        .populate('buyer', 'username profilePicture')
        .sort({ createdAt: -1 });

    const grouped: Record<OfferStatus, typeof offers> = {
        [OfferStatus.Pending]:   [],
        [OfferStatus.Accepted]:  [],
        [OfferStatus.Declined]:  [],
        [OfferStatus.Cancelled]: [],
    };

    for (const offer of offers) {
        grouped[offer.status].push(offer);
    }

    res.json(grouped);
};

/* ─────────────────────────────────────────────────────────────
   GET /api/offers/sent
   All offers submitted by the logged-in user.
───────────────────────────────────────────────────────────── */
export const getSentOffers = async (req: Request, res: Response): Promise<void> => {
    const offers = await Offer.find({ buyer: req.jwtUser!.userId })
        .populate('sale',   'title images price')
        .populate('seller', 'username profilePicture')
        .sort({ createdAt: -1 });

    res.json(offers);
};

/* ─────────────────────────────────────────────────────────────
   PATCH /api/offers/:offerId/accept
   Seller accepts an offer. Only the seller may call this.
   Side-effects:
     • Listing status → Pending  (blocks new offers via middleware)
     • All other pending offers on the same listing → Declined
───────────────────────────────────────────────────────────── */
export const acceptOffer = async (req: Request, res: Response): Promise<void> => {
    const offer = await Offer.findById(req.params.offerId);

    if (!offer) {
        res.status(404).json({ message: 'Offer not found.' });
        return;
    }

    if (offer.seller.toString() !== req.jwtUser!.userId) {
        res.status(403).json({ message: 'Only the seller can accept this offer.' });
        return;
    }

    if (offer.status !== OfferStatus.Pending) {
        res.status(409).json({ message: `Cannot accept an offer that is already ${offer.status}.` });
        return;
    }

    // Accept this offer and lock the listing in one atomic-ish pass.
    // Run the three writes in parallel — none depends on the others' result.
    await Promise.all([
        // 1. Mark the accepted offer.
        offer.updateOne({ status: OfferStatus.Accepted }),

        // 2. Lock the listing so requireActiveListing blocks any new offers.
        Post.updateOne({ _id: offer.sale }, { status: PostStatus.Pending }),

        // 3. Decline every other pending offer on the same listing.
        Offer.updateMany(
            { sale: offer.sale, _id: { $ne: offer._id }, status: OfferStatus.Pending },
            { status: OfferStatus.Declined }
        ),
    ]);

    // Return the updated offer with buyer and listing details populated.
    const updated = await Offer.findById(offer._id)
        .populate('buyer', 'username profilePicture')
        .populate('sale',  'title images price status');

    res.json(updated);
};

/* ─────────────────────────────────────────────────────────────
   PATCH /api/offers/:offerId/decline
   Seller declines an offer. Only the seller may call this.
   Side-effect:
     • If no other pending offers remain on the listing,
       the listing status is restored to Active so new offers
       can be submitted again.
───────────────────────────────────────────────────────────── */
export const declineOffer = async (req: Request, res: Response): Promise<void> => {
    const offer = await Offer.findById(req.params.offerId);

    if (!offer) {
        res.status(404).json({ message: 'Offer not found.' });
        return;
    }

    if (offer.seller.toString() !== req.jwtUser!.userId) {
        res.status(403).json({ message: 'Only the seller can decline this offer.' });
        return;
    }

    if (offer.status !== OfferStatus.Pending) {
        res.status(409).json({ message: `Cannot decline an offer that is already ${offer.status}.` });
        return;
    }

    await offer.updateOne({ status: OfferStatus.Declined });

    // Check whether any other pending offers remain on this listing.
    // If none do, restore the listing to Active so buyers can offer again.
    const otherPending = await Offer.exists({
        sale:   offer.sale,
        _id:    { $ne: offer._id },
        status: OfferStatus.Pending,
    });

    if (!otherPending) {
        await Post.updateOne(
            { _id: offer.sale, status: PostStatus.Pending },
            { status: PostStatus.Active }
        );
    }

    const updated = await Offer.findById(offer._id)
        .populate('buyer', 'username profilePicture')
        .populate('sale',  'title images price status');

    res.json(updated);
};

/* ─────────────────────────────────────────────────────────────
   PATCH /api/offers/:offerId/cancel
   Buyer withdraws their own offer. Only the buyer may call this.
   Side-effect:
     • If no other pending offers remain on the listing,
       the listing status is restored to Active so new offers
       can be submitted again.
───────────────────────────────────────────────────────────── */
export const cancelOffer = async (req: Request, res: Response): Promise<void> => {
    const offer = await Offer.findById(req.params.offerId);

    if (!offer) {
        res.status(404).json({ message: 'Offer not found.' });
        return;
    }

    if (offer.buyer.toString() !== req.jwtUser!.userId) {
        res.status(403).json({ message: 'Only the buyer can cancel this offer.' });
        return;
    }

    if (offer.status !== OfferStatus.Pending) {
        res.status(409).json({ message: `Cannot cancel an offer that is already ${offer.status}.` });
        return;
    }

    await offer.updateOne({ status: OfferStatus.Cancelled });

    // Restore the listing to Active if no other pending offers remain.
    const otherPending = await Offer.exists({
        sale:   offer.sale,
        _id:    { $ne: offer._id },
        status: OfferStatus.Pending,
    });

    if (!otherPending) {
        await Post.updateOne(
            { _id: offer.sale, status: PostStatus.Pending },
            { status: PostStatus.Active }
        );
    }

    const updated = await Offer.findById(offer._id)
        .populate('buyer', 'username profilePicture')
        .populate('sale',  'title images price status');

    res.json(updated);
};
