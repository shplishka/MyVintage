import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
    createTransaction,
    getBuyingHistory,
    getSellingHistory,
    completeTransaction,
    disputeTransaction,
} from '../controllers/transaction.controller';

const router = Router();

// All transaction routes require an authenticated user.
router.use(authenticate);

/* ─────────────────────────────────────────────────────────────
   REUSABLE SCHEMA COMPONENTS
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Real-world exchange coordination after an offer is accepted
 */

/**
 * @swagger
 * components:
 *   schemas:
 *
 *     Transaction:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "664a1f2e8b1e4c001f3d9b01"
 *         sale:
 *           $ref: '#/components/schemas/ListingSummary'
 *         buyer:
 *           $ref: '#/components/schemas/UserSummary'
 *         seller:
 *           $ref: '#/components/schemas/UserSummary'
 *         offer:
 *           $ref: '#/components/schemas/OfferSummary'
 *         meetupLocation:
 *           type: string
 *           nullable: true
 *           example: "Central Park South entrance, NYC"
 *         meetupTime:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2024-06-15T14:00:00.000Z"
 *         paymentMethod:
 *           type: string
 *           enum: [cash, bank_transfer, other]
 *           example: cash
 *         status:
 *           type: string
 *           enum: [pending, completed, cancelled, disputed]
 *           example: pending
 *         completedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         total:      { type: integer, example: 42 }
 *         page:       { type: integer, example: 1 }
 *         limit:      { type: integer, example: 20 }
 *         totalPages: { type: integer, example: 3 }
 *         hasNext:    { type: boolean, example: true }
 *
 *     PaginatedTransactions:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items: { $ref: '#/components/schemas/Transaction' }
 *         pagination:
 *           $ref: '#/components/schemas/PaginationMeta'
 */

/* ─────────────────────────────────────────────────────────────
   POST /api/transactions
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Create a transaction from an accepted offer (buyer only)
 *     description: >
 *       Initiates a transaction after the seller has accepted the buyer's offer.
 *       Only the **buyer** on the accepted offer may call this endpoint.
 *       The offer must be in **accepted** status — pending, declined, and cancelled
 *       offers are rejected. A second transaction cannot be created for the same offer.
 *
 *       `meetupLocation` and `meetupTime` are optional at creation time; they can
 *       represent details the parties still need to agree on.
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [offerId, paymentMethod]
 *             properties:
 *               offerId:
 *                 type: string
 *                 example: "664a1f2e8b1e4c001f3d9a20"
 *                 description: ID of the accepted offer this transaction is based on.
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, bank_transfer, other]
 *                 example: cash
 *                 description: Payment method the buyer will use at meetup.
 *               meetupLocation:
 *                 type: string
 *                 maxLength: 200
 *                 example: "Central Park South entrance, NYC"
 *                 description: Optional agreed meetup location.
 *               meetupTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-15T14:00:00.000Z"
 *                 description: Optional agreed meetup date and time.
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Transaction' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "offerId and paymentMethod are required." }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Authorization token missing" }
 *       403:
 *         description: Requester is not the buyer on this offer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Only the buyer of this offer can create a transaction." }
 *       404:
 *         description: Offer not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Offer not found." }
 *       409:
 *         description: Offer is not accepted, or a transaction already exists
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             examples:
 *               notAccepted:
 *                 value: { message: "A transaction can only be created from an accepted offer." }
 *               duplicate:
 *                 value: { message: "A transaction already exists for this offer." }
 */
router.post('/', createTransaction);

/* ─────────────────────────────────────────────────────────────
   GET /api/transactions/buying
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/transactions/buying:
 *   get:
 *     summary: Get the authenticated user's purchase history
 *     description: >
 *       Returns all transactions where the current user is the **buyer**, sorted
 *       newest first. Results are paginated; defaults to page 1 with 20 items per page.
 *       Maximum 50 items per page. Listing snapshot, seller profile, and original offer
 *       message are populated.
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
 *         description: Number of results per page (capped at 50)
 *     responses:
 *       200:
 *         description: Paginated list of purchase transactions
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedTransactions' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Authorization token missing" }
 */
router.get('/buying', getBuyingHistory);

/* ─────────────────────────────────────────────────────────────
   GET /api/transactions/selling
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/transactions/selling:
 *   get:
 *     summary: Get the authenticated user's sales history
 *     description: >
 *       Returns all transactions where the current user is the **seller**, sorted
 *       newest first. Results are paginated; defaults to page 1 with 20 items per page.
 *       Maximum 50 items per page. Listing snapshot, buyer profile, and original offer
 *       message are populated.
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
 *         description: Number of results per page (capped at 50)
 *     responses:
 *       200:
 *         description: Paginated list of sale transactions
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PaginatedTransactions' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Authorization token missing" }
 */
router.get('/selling', getSellingHistory);

/* ─────────────────────────────────────────────────────────────
   PATCH /api/transactions/:transactionId/complete
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/transactions/{transactionId}/complete:
 *   patch:
 *     summary: Mark a transaction as completed (buyer or seller)
 *     description: >
 *       Confirms the real-world exchange has taken place. Either the **buyer** or
 *       **seller** may call this endpoint.
 *
 *       Side-effects on success:
 *       - Transaction status → `completed`, `completedAt` is set to the current timestamp.
 *       - Listing status → `sold`, `buyer` and `soldAt` are recorded on the listing document.
 *
 *       Only transactions in **pending** status can be completed.
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string }
 *         description: ID of the transaction to complete
 *     responses:
 *       200:
 *         description: Transaction completed. Listing marked as sold.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Transaction' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Authorization token missing" }
 *       403:
 *         description: Requester is not the buyer or seller of this transaction
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Only the buyer or seller of this transaction can mark it as complete." }
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Transaction not found." }
 *       409:
 *         description: Transaction is not in pending status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             examples:
 *               alreadyCompleted:
 *                 value: { message: "Cannot complete a transaction that is already completed." }
 *               alreadyDisputed:
 *                 value: { message: "Cannot complete a transaction that is already disputed." }
 */
router.patch('/:transactionId/complete', completeTransaction);

/* ─────────────────────────────────────────────────────────────
   PATCH /api/transactions/:transactionId/dispute
───────────────────────────────────────────────────────────── */

/**
 * @swagger
 * /api/transactions/{transactionId}/dispute:
 *   patch:
 *     summary: Raise a dispute on a transaction (buyer or seller)
 *     description: >
 *       Flags the transaction as disputed. Either the **buyer** or **seller** may
 *       raise a dispute. Only transactions in **pending** status can be disputed.
 *
 *       Side-effects on success (fully undoes the in-progress sale):
 *       - Transaction status → `disputed`.
 *       - Listing status → `active` so new offers can be submitted again.
 *       - The accepted offer → `declined` so it is no longer treated as in-flight.
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string }
 *         description: ID of the transaction to dispute
 *     responses:
 *       200:
 *         description: Dispute raised. Listing restored to active and offer declined.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Transaction' }
 *       401:
 *         description: Missing or invalid bearer token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Authorization token missing" }
 *       403:
 *         description: Requester is not the buyer or seller of this transaction
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Only the buyer or seller of this transaction can raise a dispute." }
 *       404:
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             example: { message: "Transaction not found." }
 *       409:
 *         description: Transaction is not in pending status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *             examples:
 *               alreadyCompleted:
 *                 value: { message: "Cannot dispute a transaction that is already completed." }
 *               alreadyDisputed:
 *                 value: { message: "Cannot dispute a transaction that is already disputed." }
 */
router.patch('/:transactionId/dispute', disputeTransaction);

export default router;
