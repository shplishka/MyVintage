import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { findOrCreateGoogleUser } from '../services/oauth';

export function configurePassport(): void {
    passport.use(
        new GoogleStrategy(
            {
                clientID:     process.env.GOOGLE_CLIENT_ID     as string,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
                callbackURL:  process.env.GOOGLE_CALLBACK_URL  as string,
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

    // JWT-only app — no sessions needed. Passport requires these stubs.
    passport.serializeUser((user: Express.User, done) => done(null, (user as any).id));
    passport.deserializeUser((_id: string, done) => done(null, false));
}
