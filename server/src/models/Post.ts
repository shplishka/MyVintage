import mongoose, { Document, Schema, Types } from 'mongoose';

export enum Category {
    Clothing    = 'clothing',
    Accessories = 'accessories',
    Jewelry     = 'jewelry',
    Furniture   = 'furniture',
    Art         = 'art',
    Electronics = 'electronics',
    Books       = 'books',
    Other       = 'other',
}

export enum Condition {
    LikeNew   = 'like_new',
    Excellent = 'excellent',
    Good      = 'good',
    Fair      = 'fair',
    Poor      = 'poor',
}

export enum PostStatus {
    Active   = 'active',
    Pending  = 'pending',   // an offer has been accepted; awaiting transaction completion
    Sold     = 'sold',
    Inactive = 'inactive',
}

export interface IPost extends Document {
    seller:        Types.ObjectId;
    title:         string;
    description:   string;
    category:      Category;
    price:         number;
    condition:     Condition;
    year:          number;
    brand:         string;
    style:         string;
    images:        string[];
    status:        PostStatus;
    /** The user who purchased this item. Set when status transitions to Sold. */
    buyer?:        Types.ObjectId;
    /** Timestamp of when the item was sold. Set when status transitions to Sold. */
    soldAt?:       Date;
    /** Running count of how many times this sale has been viewed. */
    viewsCount:    number;
    likesCount:    number;
    commentsCount: number;
    createdAt:     Date;
    updatedAt:     Date;
}

const PostSchema = new Schema<IPost>(
    {
        seller:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
        title:         { type: String, required: true, trim: true, minLength: 2, maxLength: 100 },
        description:   { type: String, required: true, trim: true, maxLength: 1000 },
        category:      { type: String, enum: Object.values(Category), required: true },
        price:         { type: Number, required: true, min: 0 },
        condition:     { type: String, enum: Object.values(Condition), required: true },
        year:          { type: Number, required: true, max: new Date().getFullYear() },
        brand:         { type: String, required: true, trim: true },
        style:         { type: String, required: true, trim: true },
        images:        { type: [String], default: [] },
        status:        {
            type:    String,
            enum:    Object.values(PostStatus),
            default: PostStatus.Active,
            // Documents written before this field existed have no stored value.
            // The getter returns 'active' for them so callers never see undefined.
            get:     (v: string | undefined) => v ?? PostStatus.Active,
        },
        buyer:         { type: Schema.Types.ObjectId, ref: 'User', default: null },
        soldAt:        { type: Date, default: null },
        viewsCount:    { type: Number, default: 0, min: 0 },
        likesCount:    { type: Number, default: 0 },
        commentsCount: { type: Number, default: 0 },
    },
    { timestamps: true, toJSON: { getters: true }, toObject: { getters: true } }
);

// Index for fast filtering by sale status (active / sold).
PostSchema.index({ status: 1 });

export default mongoose.model<IPost>('Post', PostSchema);
