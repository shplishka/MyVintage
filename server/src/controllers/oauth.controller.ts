import { Request, Response } from 'express';
import { IUser } from '../models/User';
import { generateTokens, getRefreshTokenExpiry } from '../services/token';
import RefreshToken from '../models/RefreshToken';

/**
 * Called after Passport's Google strategy authenticates the user.
 * Generates a JWT pair and redirects to the frontend callback page.
 */
export const googleCallback = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as IUser | undefined;
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

    if (!user) {
        res.redirect(`${clientUrl}/auth/callback?error=oauth_failed`);
        return;
    }

    const { accessToken, refreshToken } = generateTokens((user as any).id ?? user._id.toString(), user.email);

    await RefreshToken.create({
        token:     refreshToken,
        userId:    user._id,
        expiresAt: getRefreshTokenExpiry(),
    });

    res.redirect(
        `${clientUrl}/auth/callback` +
        `?accessToken=${encodeURIComponent(accessToken)}` +
        `&refreshToken=${encodeURIComponent(refreshToken)}`
    );
};
