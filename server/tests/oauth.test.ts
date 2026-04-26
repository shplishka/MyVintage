// OAuth service unit tests — no real Google calls, no DB connection.

jest.mock('../src/models/User');

import User from '../src/models/User';
import { findOrCreateGoogleUser, GoogleProfile } from '../src/services/oauth';

const makeProfile = (overrides: Partial<GoogleProfile> = {}): GoogleProfile => ({
    id:          'google_profile_123',
    emails:      [{ value: 'googleuser@gmail.com' }],
    displayName: 'Google User',
    photos:      [{ value: 'https://photo.google.com/avatar.jpg' }],
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('findOrCreateGoogleUser', () => {

    /* ── 1. Existing Google user ──────────────────────────────── */

    it('returns existing user found by googleId without DB writes', async () => {
        const existingUser = { _id: 'u1', email: 'googleuser@gmail.com', googleId: 'google_profile_123' };
        (User.findOne as jest.Mock).mockResolvedValueOnce(existingUser);

        const result = await findOrCreateGoogleUser(makeProfile());

        expect(result).toBe(existingUser);
        expect(User.findOne).toHaveBeenCalledWith({ googleId: 'google_profile_123' });
        expect(User.create).not.toHaveBeenCalled();
    });

    /* ── 2. Existing email user — link Google to their account ── */

    it('links googleId to an existing local-auth user with the same email', async () => {
        const existingUser = {
            _id:           'u2',
            email:         'googleuser@gmail.com',
            profilePicture: null,
            googleId:      undefined as string | undefined,
            save:          jest.fn().mockResolvedValue(undefined),
        };
        (User.findOne as jest.Mock)
            .mockResolvedValueOnce(null)          // not found by googleId
            .mockResolvedValueOnce(existingUser); // found by email

        const result = await findOrCreateGoogleUser(makeProfile());

        expect(result).toBe(existingUser);
        expect(existingUser.googleId).toBe('google_profile_123');
        expect(existingUser.save).toHaveBeenCalled();
        expect(User.create).not.toHaveBeenCalled();
    });

    it('does not overwrite an existing profile picture when linking', async () => {
        const existingUser = {
            _id:           'u3',
            email:         'googleuser@gmail.com',
            profilePicture:'https://my-own-pic.com/photo.jpg',
            googleId:      undefined as string | undefined,
            save:          jest.fn().mockResolvedValue(undefined),
        };
        (User.findOne as jest.Mock)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(existingUser);

        await findOrCreateGoogleUser(makeProfile());

        expect(existingUser.profilePicture).toBe('https://my-own-pic.com/photo.jpg');
    });

    /* ── 3. Brand new Google user ─────────────────────────────── */

    it('creates a new user when email is not in the database', async () => {
        const newUser = { _id: 'u4', email: 'googleuser@gmail.com', googleId: 'google_profile_123' };
        // findOne returns null for both googleId and email lookups, and null for username check
        (User.findOne as jest.Mock).mockResolvedValue(null);
        (User.create  as jest.Mock).mockResolvedValue(newUser);

        const result = await findOrCreateGoogleUser(makeProfile());

        expect(User.create).toHaveBeenCalledWith(
            expect.objectContaining({
                email:        'googleuser@gmail.com',
                googleId:     'google_profile_123',
                authProvider: 'google',
            })
        );
        expect(result).toBe(newUser);
    });

    it('does not require a password for new OAuth users', async () => {
        (User.findOne as jest.Mock).mockResolvedValue(null);
        (User.create  as jest.Mock).mockImplementation(async (data: Record<string, unknown>) => data);

        const result = await findOrCreateGoogleUser(makeProfile()) as unknown as Record<string, unknown>;

        expect(result.password).toBeUndefined();
    });

    it('sets profilePicture from Google profile for new users', async () => {
        (User.findOne as jest.Mock).mockResolvedValue(null);
        (User.create  as jest.Mock).mockImplementation(async (data: Record<string, unknown>) => data);

        const result = await findOrCreateGoogleUser(makeProfile()) as unknown as Record<string, unknown>;

        expect(result.profilePicture).toBe('https://photo.google.com/avatar.jpg');
    });

    /* ── 4. Duplicate email prevention ───────────────────────── */

    it('does not create a second user when email already exists', async () => {
        const existingUser = {
            _id:           'u5',
            email:         'googleuser@gmail.com',
            profilePicture: null,
            googleId:      undefined as string | undefined,
            save:          jest.fn().mockResolvedValue(undefined),
        };
        // Same email, but a different Google ID (re-linking scenario)
        (User.findOne as jest.Mock)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(existingUser);

        await findOrCreateGoogleUser(makeProfile({ id: 'google_new_id' }));

        expect(User.create).not.toHaveBeenCalled();
        expect(existingUser.googleId).toBe('google_new_id');
    });

    /* ── 5. Error handling ────────────────────────────────────── */

    it('throws when the Google profile has no email', async () => {
        await expect(
            findOrCreateGoogleUser(makeProfile({ emails: [] }))
        ).rejects.toThrow('Google account has no verified email address.');
    });

    it('throws when the Google profile emails array is undefined', async () => {
        await expect(
            findOrCreateGoogleUser(makeProfile({ emails: undefined }))
        ).rejects.toThrow('Google account has no verified email address.');
    });
});
