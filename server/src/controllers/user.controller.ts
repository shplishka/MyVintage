import { Request, Response } from 'express';
import User from '../models/User';
import { AuthRequest } from '../types/authRequest';

export const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
    const users = await User.find().select('-password');
    res.json(users);
};

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
    const q = (req.query.q as string ?? '').trim();
    if (!q) {
        res.json([]);
        return;
    }
    const users = await User.find({
        username: { $regex: q, $options: 'i' },
    })
        .select('_id username profilePicture')
        .limit(10);
    res.json(users);
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    res.json(user);
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
    if (req.params.id !== req.jwtUser?.userId) {
        res.status(403).json({ message: 'Forbidden: you can only update your own profile' });
        return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    const allowed = ['username', 'profilePicture', 'biography', 'location'];
    allowed.forEach((field) => {
        if (req.body[field] !== undefined) {
            (user as unknown as Record<string, unknown>)[field] = req.body[field];
        }
    });

    await user.save();
    res.json(user);
};

export const uploadProfilePicture = async (req: AuthRequest, res: Response): Promise<void> => {
    if (req.params.id !== req.jwtUser?.userId) {
        res.status(403).json({ message: 'Forbidden: you can only update your own profile picture' });
        return;
    }

    if (!req.file) {
        res.status(400).json({ message: 'No image file provided' });
        return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    user.profilePicture = `/media/profile-pictures/${req.file.filename}`;
    await user.save();

    res.json({ profilePicture: user.profilePicture });
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
    if (req.params.id !== req.jwtUser?.userId) {
        res.status(403).json({ message: 'Forbidden: you can only delete your own account' });
        return;
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    res.json({ message: 'Account deleted successfully' });
};
