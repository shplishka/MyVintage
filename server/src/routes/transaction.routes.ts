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

// POST /api/transactions — create a transaction from an accepted offer
router.post('/', createTransaction);

// GET /api/transactions/buying — all transactions where the user is the buyer
router.get('/buying', getBuyingHistory);

// GET /api/transactions/selling — all transactions where the user is the seller
router.get('/selling', getSellingHistory);

// PATCH /api/transactions/:transactionId/complete — mark transaction as completed
router.patch('/:transactionId/complete', completeTransaction);

// PATCH /api/transactions/:transactionId/dispute — raise a dispute on a transaction
router.patch('/:transactionId/dispute', disputeTransaction);

export default router;
