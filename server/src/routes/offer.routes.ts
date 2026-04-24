import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireActiveListing } from '../middleware/activeListing.middleware';
import {
    createOffer,
    getReceivedOffers,
    getSentOffers,
    acceptOffer,
    declineOffer,
    cancelOffer,
} from '../controllers/offer.controller';

const router = Router();

// All offer routes require an authenticated user.
router.use(authenticate);

/* ── Scoped to a specific post ── */

// POST /api/posts/:postId/offers — submit an offer on an active listing
router.post('/:postId/offers', requireActiveListing, createOffer);

/* ── Inbox / outbox for the logged-in user ── */

// GET /api/offers/received — offers received on the user's own listings
router.get('/received', getReceivedOffers);

// GET /api/offers/sent — offers the user has submitted
router.get('/sent', getSentOffers);

/* ── Offer lifecycle actions ── */

// PATCH /api/offers/:offerId/accept  — seller accepts
router.patch('/:offerId/accept',  acceptOffer);

// PATCH /api/offers/:offerId/decline — seller declines
router.patch('/:offerId/decline', declineOffer);

// PATCH /api/offers/:offerId/cancel  — buyer cancels
router.patch('/:offerId/cancel',  cancelOffer);

export default router;
