import jwt from 'jsonwebtoken';

export const generateTokens = (userId: string, email: string) => {
    const accessToken = jwt.sign(
        { userId, email },
        process.env.JWT_SECRET as string,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
        { userId, email },
        process.env.REFRESH_TOKEN_SECRET as string,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
};

export const getRefreshTokenExpiry = (): Date => {
    const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN || '7') || 7;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
};
