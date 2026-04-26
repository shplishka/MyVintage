import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Post, { PostStatus } from '../models/Post';
import Offer from '../models/Offer';
import { OfferStatus } from '../types/marketplace';
import Like from '../models/Like';
import User from '../models/User';
const MAX_POST_IMAGES = parseInt(process.env.MAX_POST_IMAGES ?? '10', 10);

export const createPost = async (req: Request, res: Response): Promise<void> => {
    const { title, description, category, price, condition, year, brand, style, images } = req.body;

    if (!title || !description || !category || price === undefined || !condition || !year || !brand || !style) {
        res.status(400).json({ message: 'title, description, category, price, condition, year, brand and style are required' });
        return;
    }

    const post = await Post.create({
        seller: req.jwtUser!.userId,
        title, description, category, price, condition, year, brand, style,
        images: images ?? [],
    });

    res.status(201).json(post);
};

export const getAllPosts = async (req: Request, res: Response): Promise<void> => {
    const { category, condition, status, minPrice, maxPrice } = req.query;

    const filter: Record<string, unknown> = {};
    if (category)  filter.category  = category;
    if (condition) filter.condition = condition;

    // Only show active posts by default; callers can pass ?status=sold (or any
    // valid PostStatus value) to fetch items with a different status.
    filter.status = Object.values(PostStatus).includes(status as PostStatus)
        ? status
        : PostStatus.Active;

    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) (filter.price as Record<string, unknown>).$gte = Number(minPrice);
        if (maxPrice) (filter.price as Record<string, unknown>).$lte = Number(maxPrice);
    }

    // Single extra query when authenticated — avoids N+1 per post.
    const savedSet = new Set<string>();
    if (req.jwtUser) {
        const userDoc = await User.findById(req.jwtUser.userId).select('savedPosts');
        userDoc?.savedPosts.forEach(id => savedSet.add(id.toString()));
    }

    const posts = await Post.find(filter)
        .populate('seller', 'username profilePicture')
        .sort({ createdAt: -1 });

    const result = posts.map(p => ({
        ...p.toObject(),
        isSaved: savedSet.has(p._id.toString()),
    }));

    res.json(result);
};

export const getPostsByUser = async (req: Request, res: Response): Promise<void> => {
    const posts = await Post.find({ seller: req.params.userId })
        .populate('seller', 'username profilePicture')
        .sort({ createdAt: -1 });
    res.json(posts);
};

export const getPostById = async (req: Request, res: Response): Promise<void> => {
    const post = await Post.findById(req.params.id).populate('seller', 'username profilePicture');

    if (!post) {
        res.status(404).json({ message: 'Post not found' });
        return;
    }

    res.json(post);
};

export const updatePost = async (req: Request, res: Response): Promise<void> => {
    const post = await Post.findById(req.params.id);

    if (!post) {
        res.status(404).json({ message: 'Post not found' });
        return;
    }

    if (post.seller.toString() !== req.jwtUser!.userId) {
        res.status(403).json({ message: 'Forbidden: you are not the seller of this post' });
        return;
    }

    const allowed = ['title', 'description', 'category', 'price', 'condition', 'year', 'brand', 'style', 'images', 'status'];
    allowed.forEach((field) => {
        if (req.body[field] !== undefined) {
            (post as unknown as Record<string, unknown>)[field] = req.body[field];
        }
    });

    await post.save();
    res.json(post);
};

export const updatePostStatus = async (req: Request, res: Response): Promise<void> => {
    const post = await Post.findById(req.params.id);

    if (!post) {
        res.status(404).json({ message: 'Post not found' });
        return;
    }

    if (post.seller.toString() !== req.jwtUser!.userId) {
        res.status(403).json({ message: 'Forbidden: you are not the seller of this post' });
        return;
    }

    const { status } = req.body;
    const allowed = [PostStatus.Active, PostStatus.Sold, PostStatus.Cancelled];
    if (!allowed.includes(status)) {
        res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}` });
        return;
    }

    post.status = status;
    await post.save();
    res.json(post);
};

export const deletePost = async (req: Request, res: Response): Promise<void> => {
    const post = await Post.findById(req.params.id);

    if (!post) {
        res.status(404).json({ message: 'Post not found' });
        return;
    }

    if (post.seller.toString() !== req.jwtUser!.userId) {
        res.status(403).json({ message: 'Forbidden: you are not the seller of this post' });
        return;
    }

    const blockedOffer = await Offer.exists({
        sale:   post._id,
        status: { $in: [OfferStatus.Pending, OfferStatus.Accepted] },
    });

    if (blockedOffer) {
        res.status(409).json({ message: 'Cancel all pending and accepted offers before deleting this post.' });
        return;
    }

    await post.deleteOne();
    res.json({ message: 'Post deleted successfully' });
};

export const uploadPostImages = async (req: Request, res: Response): Promise<void> => {
    const post = await Post.findById(req.params.id);

    if (!post) {
        res.status(404).json({ message: 'Post not found' });
        return;
    }

    if (post.seller.toString() !== req.jwtUser!.userId) {
        res.status(403).json({ message: 'Forbidden: you are not the seller of this post' });
        return;
    }

    const incoming = (req.files as Express.Multer.File[]) ?? [];

    if (incoming.length === 0) {
        res.status(400).json({ message: 'No image files provided' });
        return;
    }

    if (post.images.length + incoming.length > MAX_POST_IMAGES) {
        res.status(400).json({
            message: `Cannot exceed ${MAX_POST_IMAGES} images per post. Post already has ${post.images.length}.`,
        });
        return;
    }

    const newPaths = incoming.map(f => `/media/posts/${req.params.id}/${f.filename}`);
    post.images.push(...newPaths);
    await post.save();

    res.json({ images: post.images });
};

export const toggleLike = async (req: Request, res: Response): Promise<void> => {
    const userId = req.jwtUser!.userId;
    const postId = req.params.id as string;

    if (!Types.ObjectId.isValid(postId)) {
        res.status(400).json({ message: 'Invalid post id' });
        return;
    }

    const postExists = await Post.exists({ _id: postId });
    if (!postExists) {
        res.status(404).json({ message: 'Post not found' });
        return;
    }

    const existing = await Like.findOne({ post: postId, user: userId });

    if (existing) {
        await existing.deleteOne();
        const updated = await Post.findByIdAndUpdate(
            postId,
            { $inc: { likesCount: -1 } },
            { new: true }
        );
        res.json({ liked: false, likesCount: updated!.likesCount });
    } else {
        await Like.create({ post: new Types.ObjectId(postId), user: new Types.ObjectId(userId) });
        const updated = await Post.findByIdAndUpdate(
            postId,
            { $inc: { likesCount: 1 } },
            { new: true }
        );
        res.json({ liked: true, likesCount: updated!.likesCount });
    }
};

export const toggleSave = async (req: Request, res: Response): Promise<void> => {
    const userId = req.jwtUser!.userId;
    const postId = req.params.id;

    const postExists = await Post.exists({ _id: postId });
    if (!postExists) {
        res.status(404).json({ message: 'Post not found' });
        return;
    }

    const user = await User.findById(userId);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    const alreadySaved = user.savedPosts.some(id => id.toString() === postId);

    if (alreadySaved) {
        const [, updated] = await Promise.all([
            User.findByIdAndUpdate(userId, { $pull: { savedPosts: postId } }),
            Post.findByIdAndUpdate(postId, { $inc: { savesCount: -1 } }, { new: true }),
        ]);
        res.json({ saved: false, savesCount: updated!.savesCount });
    } else {
        const [, updated] = await Promise.all([
            User.findByIdAndUpdate(userId, { $addToSet: { savedPosts: postId } }),
            Post.findByIdAndUpdate(postId, { $inc: { savesCount: 1 } }, { new: true }),
        ]);
        res.json({ saved: true, savesCount: updated!.savesCount });
    }
};

export const getSavedPosts = async (req: Request, res: Response): Promise<void> => {
    const page  = Math.max(1, parseInt(req.query.page  as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    // Fetch only the savedPosts array — no need to hydrate the full user document.
    const user = await User.findById(req.jwtUser!.userId).select('savedPosts');
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    // Reverse so index 0 = most recently saved (array is append-ordered).
    const allIds   = [...user.savedPosts].reverse();
    const total    = allIds.length;
    const pagedIds = allIds.slice((page - 1) * limit, page * limit);

    const posts = await Post.find({ _id: { $in: pagedIds } })
        .populate('seller', 'username profilePicture');

    // $in does not preserve insertion order — restore saved-recency ordering.
    const indexMap = new Map(pagedIds.map((id, i) => [id.toString(), i]));
    posts.sort((a, b) => indexMap.get(a._id.toString())! - indexMap.get(b._id.toString())!);

    res.json({
        data: posts,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    });
};
