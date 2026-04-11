import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import RefreshToken from '../models/RefreshToken';
import { generateTokens, getRefreshTokenExpiry } from '../services/token';

export const register = async (req: Request, res: Response): Promise<void> => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        res.status(400).json({ message: 'username, email and password are required' });
        return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
        res.status(409).json({ message: 'Email already in use' });
        return;
    }

    const user = await User.create({ username, email, password });
    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    await RefreshToken.create({
        token: refreshToken,
        userId: user._id,
        expiresAt: getRefreshTokenExpiry(),
    });

    res.status(201).json({ accessToken, refreshToken });
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ message: 'email and password are required' });
        return;
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    await RefreshToken.create({
        token: refreshToken,
        userId: user._id,
        expiresAt: getRefreshTokenExpiry(),
    });

    res.json({ accessToken, refreshToken });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        res.status(400).json({ message: 'refreshToken is required' });
        return;
    }

    let payload: { userId: string; email: string };
    try {
        payload = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET as string
        ) as { userId: string; email: string };
    } catch {
        res.status(401).json({ message: 'Invalid or expired refresh token' });
        return;
    }

    const stored = await RefreshToken.findOne({ token: refreshToken });
    if (!stored) {
        res.status(401).json({ message: 'Refresh token not recognised' });
        return;
    }

    // Rotate: delete old, issue new pair
    await stored.deleteOne();

    const tokens = generateTokens(payload.userId, payload.email);

    await RefreshToken.create({
        token: tokens.refreshToken,
        userId: stored.userId,
        expiresAt: getRefreshTokenExpiry(),
    });

    res.json(tokens);
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        res.status(400).json({ message: 'refreshToken is required' });
        return;
    }

    await RefreshToken.deleteOne({ token: refreshToken });
    res.json({ message: 'Logged out successfully' });
};
