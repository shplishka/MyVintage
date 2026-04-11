import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILike extends Document {
    post: Types.ObjectId;
    user: Types.ObjectId;
}

const LikeSchema = new Schema<ILike>(
    {
        post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true }
);

LikeSchema.index({ post: 1, user: 1 }, { unique: true });

export default mongoose.model<ILike>('Like', LikeSchema);
