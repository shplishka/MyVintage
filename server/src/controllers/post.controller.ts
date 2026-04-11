import { Request, Response } from 'express';
import Post from '../models/Post';
import Like from '../models/Like';
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
    if (status)    filter.status    = status;
    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) (filter.price as Record<string, unknown>).$gte = Number(minPrice);
        if (maxPrice) (filter.price as Record<string, unknown>).$lte = Number(maxPrice);
    }

    const posts = await Post.find(filter).populate('seller', 'username profilePicture').sort({ createdAt: -1 });
    res.json(posts);
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
    const postId = req.params.id;

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
        await Like.create({ post: postId, user: userId });
        const updated = await Post.findByIdAndUpdate(
            postId,
            { $inc: { likesCount: 1 } },
            { new: true }
        );
        res.json({ liked: true, likesCount: updated!.likesCount });
    }
};
