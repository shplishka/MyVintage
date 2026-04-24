import { Request, Response, NextFunction } from 'express';
import Post, { PostStatus } from '../models/Post';

/**
 * Verifies that the post referenced by :postId (or :saleId) is active before
 * allowing the request to continue.
 *
 * Blocks with:
 *   404 – the post does not exist
 *   410 – the post has been sold (Gone — the resource existed but is permanently unavailable)
 *   409 – the post is in a non-actionable state (inactive or any future status)
 *
 * On success the loaded post document is attached to `req.post` so downstream
 * handlers can use it without a second database round-trip.
 */
export const requireActiveListing = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const postId = req.params.postId ?? req.params.saleId ?? req.params.id;

    const post = await Post.findById(postId);

    if (!post) {
        res.status(404).json({ message: 'Post not found.' });
        return;
    }

    if (post.status === PostStatus.Sold) {
        res.status(410).json({ message: 'This item has already been sold.' });
        return;
    }

    if (post.status !== PostStatus.Active) {
        res.status(409).json({ message: 'This item is not available for offers.' });
        return;
    }

    req.post = post;
    next();
};
