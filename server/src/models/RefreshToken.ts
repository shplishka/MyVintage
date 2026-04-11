import mongoose, { Document, Schema } from 'mongoose';

export interface IRefreshToken extends Document {
    token: string;
    userId: mongoose.Types.ObjectId;
    expiresAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
    {
        token:     { type: String, required: true, unique: true, index: true },
        userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true }
);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
