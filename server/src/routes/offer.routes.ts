import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireActiveListing } from '../middleware/activeListing.middleware';

const router = Router();

/**
 * POST /api/posts/:postId/offers
 *
 * Create a new offer on a post.
 * - authenticate   : caller must be logged in
 * - requireActiveListing : post must exist and be active (not sold / inactive)
 */
router.post(
    '/:postId/offers',
    authenticate,
    requireActiveListing,
    (_req, res) => {
        // TODO: replace with createOffer controller once implemented
        res.status(501).json({ message: 'Not implemented yet.' });
    }
);

export default router;
