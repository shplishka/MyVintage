import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { IPost } from '../models/Post';

export interface JwtPayload {
    userId: string;
    email: string;
}

declare global {
    namespace Express {
        interface Request {
            jwtUser?: JwtPayload;
            /** Populated by requireActiveListing middleware. */
            post?: IPost;
        }
    }
}

/**
 * Like `authenticate` but never rejects the request.
 * Sets req.jwtUser when a valid Bearer token is present; otherwise continues
 * with req.jwtUser left undefined. Use on public routes that return
 * personalised data when a user happens to be logged in.
 */
export const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
            req.jwtUser = payload;
        } catch {
            // Invalid token — treat as unauthenticated, do not reject.
        }
    }

    next();
};

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Authorization token missing' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
        req.jwtUser = payload;
    } catch {
        res.status(401).json({ message: 'Invalid or expired token' });
        return;
    }

    next();
};
