import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { findOrCreateGoogleUser } from '../services/oauth';

export function configurePassport(): void {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        passport.use(
            new GoogleStrategy(
                {
                    clientID:     process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    callbackURL:  process.env.GOOGLE_CALLBACK_URL as string,
                },
                async (_accessToken, _refreshToken, profile, done) => {
                    try {
                        const user = await findOrCreateGoogleUser(profile);
                        done(null, user);
                    } catch (err) {
                        done(err as Error);
                    }
                }
            )
        );
    } else {
        console.warn('[oauth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google login disabled.');
    }

    // JWT-only app — no sessions needed. Passport requires these stubs.
    passport.serializeUser((user: Express.User, done) => done(null, (user as any).id));
    passport.deserializeUser((_id: string, done) => done(null, false));
}
