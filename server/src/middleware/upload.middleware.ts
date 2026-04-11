import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const imageFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
};

const getExt = (originalname: string): string =>
    originalname.split('.').filter(Boolean).slice(1).join('.');

// Profile pictures — public/profile-pictures/<userId>.<ext>
export const uploadProfilePicture = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, 'public/profile-pictures/'),
        filename: (req, file, cb) => cb(null, req.params.id + '.' + getExt(file.originalname)),
    }),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: imageFilter,
});

// Post images — public/posts/<postId>/<uuid>.<ext>
export const uploadPostImages = multer({
    storage: multer.diskStorage({
        destination: (req, _file, cb) => {
            const dir = path.join('public', 'posts', req.params.id as string);
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, crypto.randomUUID() + '.' + getExt(file.originalname)),
    }),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: imageFilter,
});
