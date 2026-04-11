import { Request, Response } from 'express';
import Comment from '../models/Comment';
import Post from '../models/Post';

export const addComment = async (req: Request, res: Response): Promise<void> => {
    const { content } = req.body;

    if (!content) {
        res.status(400).json({ message: 'content is required' });
        return;
    }

    const post = await Post.findById(req.params.postId);
    if (!post) {
        res.status(404).json({ message: 'Post not found' });
        return;
    }

    const comment = await Comment.create({
        post:    req.params.postId,
        author:  req.jwtUser!.userId,
        content,
    });

    await Post.findByIdAndUpdate(req.params.postId, { $inc: { commentsCount: 1 } });

    await comment.populate('author', 'username profilePicture');
    res.status(201).json(comment);
};

export const getCommentsByPost = async (req: Request, res: Response): Promise<void> => {
    const post = await Post.findById(req.params.postId);
    if (!post) {
        res.status(404).json({ message: 'Post not found' });
        return;
    }

    const comments = await Comment.find({ post: req.params.postId })
        .populate('author', 'username profilePicture')
        .sort({ createdAt: 1 });

    res.json(comments);
};

export const updateComment = async (req: Request, res: Response): Promise<void> => {
    const { content } = req.body;

    if (!content) {
        res.status(400).json({ message: 'content is required' });
        return;
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
        res.status(404).json({ message: 'Comment not found' });
        return;
    }

    if (comment.author.toString() !== req.jwtUser!.userId) {
        res.status(403).json({ message: 'Forbidden: you can only edit your own comments' });
        return;
    }

    comment.content = content;
    await comment.save();
    await comment.populate('author', 'username profilePicture');
    res.json(comment);
};

export const deleteComment = async (req: Request, res: Response): Promise<void> => {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
        res.status(404).json({ message: 'Comment not found' });
        return;
    }

    const post = await Post.findById(comment.post);
    const requesterId = req.jwtUser!.userId;
    const isAuthor    = comment.author.toString() === requesterId;
    const isPostOwner = post?.seller.toString() === requesterId;

    if (!isAuthor && !isPostOwner) {
        res.status(403).json({ message: 'Forbidden: only the comment author or post owner can delete this comment' });
        return;
    }

    await comment.deleteOne();
    await Post.findByIdAndUpdate(comment.post, { $inc: { commentsCount: -1 } });
    res.json({ message: 'Comment deleted successfully' });
};
