import { Types } from 'mongoose';

/* ════════════════════════════════════════════════════════════
   ENUMS
════════════════════════════════════════════════════════════ */

/**
 * The lifecycle state of a sale as it moves through the buy/sell flow.
 *
 * Active  – the item is available and accepting offers.
 * Pending – an offer has been accepted; the transaction is in progress.
 * Sold    – the transaction has been completed and the item is no longer available.
 */
export enum SaleStatus {
    Active  = 'active',
    Pending = 'pending',
    Sold    = 'sold',
}

/**
 * The state of a single offer made by a buyer on a sale.
 *
 * Pending   – the offer has been submitted and is awaiting seller review.
 * Accepted  – the seller accepted the offer; a transaction record is created.
 * Declined  – the seller rejected the offer; the sale remains active.
 * Cancelled – the buyer withdrew the offer before the seller responded.
 */
export enum OfferStatus {
    Pending   = 'pending',
    Accepted  = 'accepted',
    Declined  = 'declined',
    Cancelled = 'cancelled',
}

/**
 * The state of a transaction that was created after an offer was accepted.
 *
 * Pending   – awaiting meetup / payment confirmation.
 * Completed – both parties have confirmed the exchange.
 * Cancelled – the transaction was called off after the offer was accepted.
 */
export enum TransactionStatus {
    Pending   = 'pending',
    Completed = 'completed',
    Cancelled = 'cancelled',
    Disputed  = 'disputed',
}

/**
 * Payment method chosen by the buyer at transaction creation time.
 */
export enum PaymentMethod {
    Cash         = 'cash',
    BankTransfer = 'bank_transfer',
    Other        = 'other',
}

/* ════════════════════════════════════════════════════════════
   INTERFACES
════════════════════════════════════════════════════════════ */

/**
 * Represents an offer made by a buyer on a specific sale.
 *
 * An offer is always tied to one sale and explicitly tracks both
 * participants (buyer + seller) so queries never require a sale join
 * to determine who owns which side of the negotiation.
 */
export interface IOffer {
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

/**
 * Represents a confirmed transaction created when a seller accepts an offer.
 *
 * Captures the full context needed to coordinate a real-world exchange:
 * where they meet, when, how payment is handled, and the final outcome.
 */
export interface ITransaction {
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
