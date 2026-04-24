import mongoose, { Document, Schema, Types } from 'mongoose';
import { PaymentMethod, TransactionStatus } from '../types/marketplace';

export interface ITransactionDocument extends Document {
    /** The sale being completed. */
    sale: Types.ObjectId;

    /** The user purchasing the item. */
    buyer: Types.ObjectId;

    /** The user selling the item. */
    seller: Types.ObjectId;

    /** The accepted offer that triggered this transaction. */
    offer: Types.ObjectId;

    /** Agreed meetup location (e.g. "Central Park, NYC"). Optional until confirmed. */
    meetupLocation?: string;

    /** Agreed meetup date/time. Optional until confirmed. */
    meetupTime?: Date;

    /** Payment method chosen by the buyer. */
    paymentMethod: PaymentMethod;

    /** Current state in the transaction lifecycle. Defaults to Pending. */
    status: TransactionStatus;

    /** Set when status transitions to Completed. */
    completedAt?: Date;

    createdAt: Date;
    updatedAt: Date;
}

const TransactionSchema = new Schema<ITransactionDocument>(
    {
        sale:           { type: Schema.Types.ObjectId, ref: 'Post',  required: true },
        buyer:          { type: Schema.Types.ObjectId, ref: 'User',  required: true },
        seller:         { type: Schema.Types.ObjectId, ref: 'User',  required: true },
        offer:          { type: Schema.Types.ObjectId, ref: 'Offer', required: true },
        meetupLocation: { type: String, trim: true, maxlength: 200 },
        meetupTime:     { type: Date },
        paymentMethod:  {
            type:     String,
            enum:     Object.values(PaymentMethod),
            required: true,
        },
        status:         {
            type:    String,
            enum:    Object.values(TransactionStatus),
            default: TransactionStatus.Pending,
        },
        completedAt:    { type: Date, default: null },
    },
    { timestamps: true }
);

// Individual indexes so MongoDB can efficiently satisfy any of:
//   find({ buyer  }) – a buyer's purchase history
//   find({ seller }) – a seller's sales history
//   find({ sale   }) – all transactions tied to a specific listing
TransactionSchema.index({ buyer:  1 });
TransactionSchema.index({ seller: 1 });
TransactionSchema.index({ sale:   1 });

export default mongoose.model<ITransactionDocument>('Transaction', TransactionSchema);
