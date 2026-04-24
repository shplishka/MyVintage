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

/* ─────────────────────────────────────────────────────────────
   REUSABLE SCHEMA COMPONENTS
   (registered once here; referenced by $ref elsewhere)
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * tags:
 *   name: Offers
 *   description: Buyer/seller offer negotiation on active listings
 */

/**
 * @swagger
 * components:
 *   schemas:
 *
 *     UserSummary:
 *       type: object
 *       properties:
 *         _id:            { type: string, example: "664a1f2e8b1e4c001f3d9a01" }
 *         username:       { type: string, example: "jane_doe" }
 *         profilePicture: { type: string, nullable: true, example: "/media/avatars/jane.jpg" }
 *
 *     ListingSummary:
 *       type: object
 *       properties:
 *         _id:    { type: string,  example: "664a1f2e8b1e4c001f3d9a10" }
 *         title:  { type: string,  example: "Vintage Levi's Jacket" }
 *         images: { type: array,   items: { type: string }, example: ["/media/posts/jacket.jpg"] }
 *         price:  { type: number,  example: 75 }
 *         status: { type: string,  enum: [active, pending, sold, inactive], example: "active" }
 *
 *     OfferSummary:
 *       type: object
 *       properties:
 *         _id:        { type: string, example: "664a1f2e8b1e4c001f3d9a20" }
 *         offerPrice: { type: number, example: 60 }
 *         message:    { type: string, nullable: true, example: "Would you take $60?" }
 *
 *     Offer:
 *       type: object
 *       properties:
 *         _id:        { type: string,  example: "664a1f2e8b1e4c001f3d9a20" }
 *         sale:       { $ref: '#/components/schemas/ListingSummary' }
 *         buyer:      { $ref: '#/components/schemas/UserSummary' }
 *         seller:     { $ref: '#/components/schemas/UserSummary' }
 *         offerPrice: { type: number,  example: 60 }
 *         message:    { type: string,  nullable: true, example: "Would you take $60?" }
 *         status:
 *           type: string
 *           enum: [pending, accepted, declined, cancelled]
 *           example: pending
 *         createdAt:  { type: string, format: date-time }
 *         updatedAt:  { type: string, format: date-time }
 *
 *     ReceivedOffersResponse:
 *       type: object
 *       properties:
 *         pending:   { type: array, items: { $ref: '#/components/schemas/Offer' } }
 *         accepted:  { type: array, items: { $ref: '#/components/schemas/Offer' } }
 *         declined:  { type: array, items: { $ref: '#/components/schemas/Offer' } }
 *         cancelled: { type: array, items: { $ref: '#/components/schemas/Offer' } }
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message: { type: string, example: "Offer not found." }
 */

/* ─────────────────────────────────────────────────────────────
   POST /api/posts/:postId/offers
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/posts/{postId}/offers:
 *   post:
 *     summary: Submit an offer on an active listing
 *     description: >
 *       Creates a new pending offer on the specified listing.
 *       The listing must exist and be **active** — sold, pending, and inactive
 *       listings are rejected by the `requireActiveListing` middleware.
 *       A buyer may only have one **pending** offer per listing at a time;
 *       they must cancel an existing pending offer before submitting another.
 *       The seller cannot offer on their own listing.
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema: { type: string }
 *         description: ID of the listing to offer on
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [offerPrice]
 *             properties:
 *               offerPrice:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 60
 *                 description: The price the buyer is willing to pay. Must be greater than 0.
 *               message:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Would you take $60? I can meet this weekend."
 *                 description: Optional note from the buyer to the seller.
 *     responses:
 *       201:
 *         description: Offer created successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Offer' }
 *       400:
 *         description: Invalid offerPrice or seller attempting to offer on own listing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             examples:
 *               invalidPrice:
 *                 value: { message: "offerPrice must be a positive number." }
 *               selfOffer:
 *                 value: { message: "You cannot make an offer on your own listing." }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Authorization token missing" }
 *       404:
 *         description: Listing not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Post not found." }
 *       409:
 *         description: Listing unavailable or buyer already has a pending offer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             examples:
 *               alreadyPending:
 *                 value: { message: "This item already has an accepted offer and is no longer taking new offers." }
 *               duplicateOffer:
 *                 value: { message: "You already have a pending offer on this listing. Cancel it before submitting a new one." }
 *       410:
 *         description: Listing has already been sold
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "This item has already been sold." }
 */
router.post('/:postId/offers', requireActiveListing, createOffer);

/* ─────────────────────────────────────────────────────────────
   GET /api/offers/received
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/offers/received:
 *   get:
 *     summary: Get all offers received on the seller's listings
 *     description: >
 *       Returns every offer submitted on any listing owned by the authenticated user,
 *       grouped by status into four buckets: `pending`, `accepted`, `declined`, `cancelled`.
 *       Each bucket is sorted newest first. Buyer profile and listing snapshot are populated.
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Offers grouped by status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ReceivedOffersResponse' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Authorization token missing" }
 */
router.get('/received', getReceivedOffers);

/* ─────────────────────────────────────────────────────────────
   GET /api/offers/sent
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/offers/sent:
 *   get:
 *     summary: Get all offers submitted by the buyer
 *     description: >
 *       Returns every offer the authenticated user has submitted, sorted newest first.
 *       Listing snapshot and seller profile are populated.
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of offers sent by the current user
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Offer' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Authorization token missing" }
 */
router.get('/sent', getSentOffers);

/* ─────────────────────────────────────────────────────────────
   PATCH /api/offers/:offerId/accept
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/offers/{offerId}/accept:
 *   patch:
 *     summary: Accept a pending offer (seller only)
 *     description: >
 *       Transitions the offer to **accepted** and atomically:
 *       - Sets the listing status to **pending** so no further offers can be submitted.
 *       - Declines all other pending offers on the same listing.
 *
 *       Only the seller on the offer may call this endpoint.
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offerId
 *         required: true
 *         schema: { type: string }
 *         description: ID of the offer to accept
 *     responses:
 *       200:
 *         description: Offer accepted. Listing locked and competing offers declined.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Offer' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Authorization token missing" }
 *       403:
 *         description: Requester is not the seller of this offer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Only the seller can accept this offer." }
 *       404:
 *         description: Offer not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Offer not found." }
 *       409:
 *         description: Offer is not in pending status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Cannot accept an offer that is already accepted." }
 */
router.patch('/:offerId/accept', acceptOffer);

/* ─────────────────────────────────────────────────────────────
   PATCH /api/offers/:offerId/decline
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/offers/{offerId}/decline:
 *   patch:
 *     summary: Decline a pending offer (seller only)
 *     description: >
 *       Transitions the offer to **declined**.
 *       If no other pending offers remain on the listing, the listing is
 *       automatically restored to **active** so new offers can be submitted.
 *
 *       Only the seller on the offer may call this endpoint.
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offerId
 *         required: true
 *         schema: { type: string }
 *         description: ID of the offer to decline
 *     responses:
 *       200:
 *         description: Offer declined. Listing restored to active if no pending offers remain.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Offer' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Authorization token missing" }
 *       403:
 *         description: Requester is not the seller of this offer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Only the seller can decline this offer." }
 *       404:
 *         description: Offer not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Offer not found." }
 *       409:
 *         description: Offer is not in pending status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Cannot decline an offer that is already declined." }
 */
router.patch('/:offerId/decline', declineOffer);

/* ─────────────────────────────────────────────────────────────
   PATCH /api/offers/:offerId/cancel
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/offers/{offerId}/cancel:
 *   patch:
 *     summary: Cancel a pending offer (buyer only)
 *     description: >
 *       Transitions the offer to **cancelled**.
 *       If no other pending offers remain on the listing, the listing is
 *       automatically restored to **active** so new offers can be submitted.
 *
 *       Only the buyer who submitted the offer may call this endpoint.
 *     tags: [Offers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offerId
 *         required: true
 *         schema: { type: string }
 *         description: ID of the offer to cancel
 *     responses:
 *       200:
 *         description: Offer cancelled. Listing restored to active if no pending offers remain.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Offer' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Authorization token missing" }
 *       403:
 *         description: Requester is not the buyer of this offer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Only the buyer can cancel this offer." }
 *       404:
 *         description: Offer not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Offer not found." }
 *       409:
 *         description: Offer is not in pending status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Cannot cancel an offer that is already cancelled." }
 */
router.patch('/:offerId/cancel', cancelOffer);

export default router;
