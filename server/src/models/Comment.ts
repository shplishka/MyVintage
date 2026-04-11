import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IComment extends Document {
    post:      Types.ObjectId;
    author:    Types.ObjectId;
    content:   string;
    createdAt: Date;
    updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
    {
        post:    { type: Schema.Types.ObjectId, ref: 'Post',   required: true, index: true },
        author:  { type: Schema.Types.ObjectId, ref: 'User',   required: true },
        content: { type: String, required: true, trim: true, minLength: 1, maxLength: 500 },
    },
    { timestamps: true }
);

export default mongoose.model<IComment>('Comment', CommentSchema);
