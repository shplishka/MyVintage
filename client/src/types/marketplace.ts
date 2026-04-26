/* ════════════════════════════════════════════════════════════
   ENUMS
════════════════════════════════════════════════════════════ */

/**
 * The lifecycle state of a listing as it moves through the buy/sell flow.
 *
 * Active  – the item is available and accepting offers.
 * Pending – an offer has been accepted; the transaction is in progress.
 * Sold    – the transaction has been completed and the item is no longer available.
 * Inactive – the seller has hidden the listing without deleting it.
 */
export const ListingStatus = {
  Active:   'active',
  Pending:  'pending',
  Sold:     'sold',
  Inactive: 'inactive',
} as const;
export type ListingStatus = typeof ListingStatus[keyof typeof ListingStatus];

/**
 * The state of a single offer made by a buyer on a listing.
 *
 * Pending   – submitted, awaiting seller review.
 * Accepted  – seller accepted; a transaction record is created.
 * Declined  – seller rejected; the listing remains active.
 * Cancelled – buyer withdrew before the seller responded.
 */
export const OfferStatus = {
  Pending:   'pending',
  Accepted:  'accepted',
  Declined:  'declined',
  Cancelled: 'cancelled',
} as const;
export type OfferStatus = typeof OfferStatus[keyof typeof OfferStatus];

/**
 * The state of a transaction created after an offer is accepted.
 *
 * Pending   – awaiting meetup / payment confirmation.
 * Completed – both parties confirmed the exchange.
 * Cancelled – called off after the offer was accepted.
 * Disputed  – one party raised a dispute; sale is under review.
 */
export const TransactionStatus = {
  Pending:   'pending',
  Completed: 'completed',
  Cancelled: 'cancelled',
  Disputed:  'disputed',
} as const;
export type TransactionStatus = typeof TransactionStatus[keyof typeof TransactionStatus];

/**
 * Payment method chosen by the buyer when creating a transaction.
 */
export const PaymentMethod = {
  Cash:         'cash',
  BankTransfer: 'bank_transfer',
  Other:        'other',
} as const;
export type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];

/* ════════════════════════════════════════════════════════════
   SHARED PARTIALS
════════════════════════════════════════════════════════════ */

/** Minimal seller / buyer profile attached to populated responses. */
export interface UserSummary {
  _id:            string
  username:       string
  profilePicture: string | null
}

/** Minimal listing snapshot attached to populated offer / transaction responses. */
export interface ListingSummary {
  _id:    string
  title:  string
  images: string[]
  price:  number
  status: ListingStatus
}

/* ════════════════════════════════════════════════════════════
   OFFER
════════════════════════════════════════════════════════════ */

/**
 * An offer made by a buyer on an active listing.
 * Populated fields use their summary types; raw fields remain string IDs.
 */
export interface Offer {
  _id:        string
  sale:       ListingSummary | string
  buyer:      UserSummary   | string
  seller:     UserSummary   | string
  offerPrice: number
  message?:   string
  status:     OfferStatus
  createdAt:  string
  updatedAt:  string
}

/**
 * The shape sent to POST /api/posts/:postId/offers.
 */
export interface CreateOfferPayload {
  offerPrice: number
  message?:   string
}

/**
 * The grouped response from GET /api/offers/received.
 */
export interface ReceivedOffersResponse {
  pending:   Offer[]
  accepted:  Offer[]
  declined:  Offer[]
  cancelled: Offer[]
}

/* ════════════════════════════════════════════════════════════
   TRANSACTION
════════════════════════════════════════════════════════════ */

/**
 * A confirmed transaction created when a seller accepts an offer.
 */
export interface Transaction {
  _id:            string
  sale:           ListingSummary | string
  buyer:          UserSummary   | string
  seller:         UserSummary   | string
  offer:          OfferSummary  | string
  meetupLocation?: string
  meetupTime?:    string
  paymentMethod:  PaymentMethod
  status:         TransactionStatus
  completedAt?:   string
  createdAt:      string
  updatedAt:      string
}

/** Minimal offer snapshot attached to populated transaction responses. */
export interface OfferSummary {
  _id:        string
  offerPrice: number
  message?:   string
}

/**
 * The shape sent to POST /api/transactions.
 */
export interface CreateTransactionPayload {
  offerId:         string
  paymentMethod:   PaymentMethod
  meetupLocation?: string
  meetupTime?:     string
}

/**
 * Paginated response envelope used by
 * GET /api/transactions/buying and /selling.
 */
export interface PaginatedTransactions {
  data: Transaction[]
  pagination: {
    total:      number
    page:       number
    limit:      number
    totalPages: number
    hasNext:    boolean
  }
}
