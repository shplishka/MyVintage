import mongoose, { Document, Schema, Types } from 'mongoose';
import { OfferStatus } from '../types/marketplace';

export interface IOfferDocument extends Document {
    /** The sale this offer was placed on. */
    sale: Types.ObjectId;

    /** The user who submitted the offer. */
    buyer: Types.ObjectId;

    /** The user who owns the sale (denormalised for query efficiency). */
    seller: Types.ObjectId;

    /** The price the buyer is willing to pay. Must be > 0. */
    offerPrice: number;

    /** Optional note from the buyer to the seller. Max 500 characters. */
    message?: string;

    /** Current state in the offer lifecycle. Defaults to Pending. */
    status: OfferStatus;

    createdAt: Date;
    updatedAt: Date;
}

const OfferSchema = new Schema<IOfferDocument>(
    {
        sale:       { type: Schema.Types.ObjectId, ref: 'Post', required: true },
        buyer:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
        seller:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
        offerPrice: { type: Number, required: true, min: 0.01 },
        message:    { type: String, trim: true, maxlength: 500 },
        status:     {
            type:    String,
            enum:    Object.values(OfferStatus),
            default: OfferStatus.Pending,
        },
    },
    { timestamps: true }
);

/**
 * Compound index on (sale, buyer).
 *
 * Used by the route layer to enforce the one-active-offer-per-buyer rule:
 * before inserting a new offer, query { sale, buyer, status: 'pending' }
 * and reject if a document already exists.
 *
 * Not a unique index — a buyer may re-offer after their previous offer was
 * declined or cancelled, so uniqueness is a behavioural constraint enforced
 * in the controller, not at the database level.
 *
 * The leading `sale` key also makes "all offers on a sale" fast without
 * needing a separate single-field index.
 */
OfferSchema.index({ sale: 1, buyer: 1 });

export default mongoose.model<IOfferDocument>('Offer', OfferSchema);
