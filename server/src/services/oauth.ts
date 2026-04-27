import User, { IUser } from '../models/User';

export interface GoogleProfile {
    id: string;
    emails?: Array<{ value: string }>;
    displayName?: string;
    photos?: Array<{ value: string }>;
}

async function generateUniqueUsername(base: string): Promise<string> {
    const sanitized = (base || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 16) || 'user';

    const existing = await User.findOne({ username: sanitized });
    if (!existing) return sanitized;

    const suffix = Math.floor(Math.random() * 9000 + 1000).toString();
    return `${sanitized.slice(0, 16)}${suffix}`;
}

/**
 * Find or create a user from a Google OAuth profile.
 *
 * Priority order:
 *  1. Existing user with this googleId  → return as-is.
 *  2. Existing user with the same email → link googleId and return.
 *  3. No match                          → create a new user (no password).
 */
export async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<IUser> {
    const { id: googleId, emails, displayName = '', photos } = profile;
    const email = emails?.[0]?.value?.toLowerCase();

    if (!email) throw new Error('Google account has no verified email address.');

    const byGoogleId = await User.findOne({ googleId });
    if (byGoogleId) return byGoogleId;

    const byEmail = await User.findOne({ email });
    if (byEmail) {
        byEmail.googleId = googleId;
        if (!byEmail.profilePicture && photos?.[0]?.value) {
            byEmail.profilePicture = photos[0].value;
        }
        await byEmail.save();
        return byEmail;
    }

    const username = await generateUniqueUsername(displayName);
    return User.create({
        email,
        username,
        googleId,
        authProvider: 'google',
        profilePicture: photos?.[0]?.value ?? undefined,
    });
}
