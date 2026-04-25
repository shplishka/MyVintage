import { useEffect, useState } from 'react'
import api from '../api/axiosInstance'
import type { PostData } from './EditPostModal'
import { type Offer, OfferStatus } from '../types/marketplace'
import './PostDetailModal.css'

interface Props {
  post: PostData
  sellerRating: number
  sellerLocation: string | null
  isOwner: boolean
  currentUserId?: string
  onClose: () => void
  onEdit: () => void
  onPostUpdated?: (post: PostData) => void
}

const CONDITION_LABELS: Record<string, string> = {
  like_new: 'Like New', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active', sold: 'Sold', cancelled: 'Cancelled', pending: 'Pending',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface BuyerSummary { _id: string; username: string; profilePicture?: string | null }

interface PopulatedOffer extends Omit<Offer, 'buyer' | 'sale' | 'seller'> {
  buyer: BuyerSummary
}

export default function PostDetailModal({
  post,
  sellerRating,
  sellerLocation,
  isOwner,
  currentUserId,
  onClose,
  onEdit,
  onPostUpdated,
}: Props) {
  const [localPost, setLocalPost] = useState(post)

  // Status change
  const [statusChanging, setStatusChanging] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Offer form (buyer)
  const [offerOpen, setOfferOpen] = useState(false)
  const [offerPrice, setOfferPrice] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [offerSubmitting, setOfferSubmitting] = useState(false)
  const [offerMsg, setOfferMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Bids section (seller)
  const [bidsOpen, setBidsOpen] = useState(false)
  const [bids, setBids] = useState<PopulatedOffer[]>([])
  const [bidsLoading, setBidsLoading] = useState(false)
  const [bidsMsg, setBidsMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  useEffect(() => { setLocalPost(post) }, [post])

  const imgSrc = localPost.images?.[0]
    ? `${import.meta.env.VITE_API_URL}${localPost.images[0]}`
    : null

  const sellerAvatar = localPost.seller?.profilePicture
    ? `${import.meta.env.VITE_API_URL}${localPost.seller.profilePicture}`
    : null

  const conditionLabel = CONDITION_LABELS[localPost.condition] ?? localPost.condition
  const postStatus = localPost.status ?? 'active'
  const isActive = postStatus === 'active'

  const canOffer = !isOwner && !!currentUserId && isActive

  // ── Status change ─────────────────────────────────────────
  async function handleStatusChange(newStatus: string) {
    if (newStatus === postStatus) return
    setStatusChanging(true)
    setStatusMsg(null)
    try {
      const { data } = await api.patch<PostData>(`/api/posts/${localPost._id}/status`, { status: newStatus })
      setLocalPost(data)
      onPostUpdated?.(data)
      setStatusMsg({ type: 'ok', text: `Status updated to ${STATUS_LABELS[newStatus] ?? newStatus}.` })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setStatusMsg({ type: 'err', text: msg ?? 'Failed to update status.' })
    } finally {
      setStatusChanging(false)
    }
  }

  // ── Submit offer ──────────────────────────────────────────
  async function handleSubmitOffer(e: React.FormEvent) {
    e.preventDefault()
    setOfferMsg(null)
    const price = parseFloat(offerPrice)
    if (!offerPrice || isNaN(price) || price <= 0) {
      setOfferMsg({ type: 'err', text: 'Enter a valid offer amount greater than 0.' })
      return
    }
    setOfferSubmitting(true)
    try {
      await api.post(`/api/posts/${localPost._id}/offers`, {
        offerPrice: price,
        message: offerMessage.trim() || undefined,
      })
      setOfferMsg({ type: 'ok', text: 'Offer submitted! The seller will review it.' })
      setOfferPrice('')
      setOfferMessage('')
      setOfferOpen(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setOfferMsg({ type: 'err', text: msg ?? 'Failed to submit offer.' })
    } finally {
      setOfferSubmitting(false)
    }
  }

  // ── Load bids ─────────────────────────────────────────────
  async function loadBids() {
    setBidsLoading(true)
    setBidsMsg(null)
    try {
      const { data } = await api.get<PopulatedOffer[]>(`/api/posts/${localPost._id}/offers`)
      setBids(data)
    } catch {
      setBidsMsg({ type: 'err', text: 'Failed to load offers.' })
    } finally {
      setBidsLoading(false)
    }
  }

  function toggleBids() {
    if (!bidsOpen) loadBids()
    setBidsOpen(v => !v)
  }

  // ── Accept bid ────────────────────────────────────────────
  async function handleAccept(offerId: string) {
    setAcceptingId(offerId)
    setBidsMsg(null)
    try {
      await api.patch(`/api/offers/${offerId}/accept`)
      setBidsMsg({ type: 'ok', text: 'Offer accepted! The listing is now marked as Sold.' })
      // Refresh bids and update post status locally
      const [bidsRes, postRes] = await Promise.all([
        api.get<PopulatedOffer[]>(`/api/posts/${localPost._id}/offers`),
        api.get<PostData>(`/api/posts/${localPost._id}`),
      ])
      setBids(bidsRes.data)
      setLocalPost(postRes.data)
      onPostUpdated?.(postRes.data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setBidsMsg({ type: 'err', text: msg ?? 'Failed to accept offer.' })
    } finally {
      setAcceptingId(null)
    }
  }

  const pendingBids = bids.filter(b => b.status === OfferStatus.Pending)
  const otherBids   = bids.filter(b => b.status !== OfferStatus.Pending)

  return (
    <div className="pdm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pdm-modal" role="dialog" aria-modal="true">

        {/* ── Header ── */}
        <div className="pdm-header">
          <button className="pdm-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <span className="pdm-header-title">Sell</span>
          {isOwner && (
            <button className="pdm-edit-btn" onClick={onEdit}>
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        <div className="pdm-body">
          {/* ── Image ── */}
          <div className="pdm-img-wrap">
            {imgSrc ? (
              <img className="pdm-img" src={imgSrc} alt={localPost.title} />
            ) : (
              <div className="pdm-img-placeholder" />
            )}

            {/* Badges */}
            <div className="pdm-badges">
              <span className="pdm-badge">{conditionLabel}</span>
              {localPost.year && <span className="pdm-badge">{localPost.year}s</span>}
            </div>

            {/* Heart */}
            <button className="pdm-heart" aria-label="Save">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>

          {/* ── Info ── */}
          <div className="pdm-info">

            {/* Status row */}
            <div className="pdm-status-row">
              <span className={`pdm-status-badge pdm-status-badge--${postStatus}`}>
                {STATUS_LABELS[postStatus] ?? postStatus}
              </span>
            </div>

            {/* ── Owner: status controls ── */}
            {isOwner && (
              <div className="pdm-status-controls">
                <label className="pdm-status-label">Change status:</label>
                <div className="pdm-status-buttons">
                  {(['active', 'sold', 'cancelled'] as const).map(s => (
                    <button
                      key={s}
                      className={`pdm-status-btn pdm-status-btn--${s}${postStatus === s ? ' pdm-status-btn--current' : ''}`}
                      onClick={() => handleStatusChange(s)}
                      disabled={statusChanging || postStatus === s}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                {statusMsg && (
                  <p className={`pdm-feedback pdm-feedback--${statusMsg.type}`}>{statusMsg.text}</p>
                )}
              </div>
            )}

            {/* Title + price */}
            <div className="pdm-title-row">
              <h2 className="pdm-title">{localPost.title}</h2>
              <span className="pdm-price">${localPost.price}</span>
            </div>

            {/* Category */}
            <p className="pdm-category">
              {localPost.category.charAt(0).toUpperCase() + localPost.category.slice(1)}
            </p>

            {/* Seller row */}
            <div className="pdm-seller-row">
              {sellerAvatar ? (
                <img className="pdm-avatar" src={sellerAvatar} alt={localPost.seller.username} />
              ) : (
                <div className="pdm-avatar-placeholder">
                  {localPost.seller?.username?.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="pdm-seller-name">{localPost.seller?.username}</span>
              <span className="pdm-rating">
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {sellerRating.toFixed(1)}
              </span>
            </div>

            {/* Location + time */}
            <div className="pdm-meta-row">
              {sellerLocation && (
                <span className="pdm-location">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  {sellerLocation}
                </span>
              )}
              <span className="pdm-time">{timeAgo(localPost.createdAt)}</span>
            </div>

            <div className="pdm-divider" />

            {/* Description */}
            {localPost.description && (
              <p className="pdm-description">{localPost.description}</p>
            )}

            {/* Detail chips */}
            <div className="pdm-chips">
              <div className="pdm-chip">
                <span className="pdm-chip-label">Condition</span>
                <span className="pdm-chip-value">{conditionLabel}</span>
              </div>
              <div className="pdm-chip">
                <span className="pdm-chip-label">Year</span>
                <span className="pdm-chip-value">{localPost.year}s</span>
              </div>
              <div className="pdm-chip">
                <span className="pdm-chip-label">Brand</span>
                <span className="pdm-chip-value">{localPost.brand}</span>
              </div>
              <div className="pdm-chip">
                <span className="pdm-chip-label">Style</span>
                <span className="pdm-chip-value">{localPost.style}</span>
              </div>
            </div>

            {/* ── Owner: bids section ── */}
            {isOwner && (
              <div className="pdm-bids-section">
                <div className="pdm-divider" />
                <button className="pdm-bids-toggle" onClick={toggleBids}>
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                  </svg>
                  {bidsOpen ? 'Hide Offers' : 'View Offers'}
                  {bids.length > 0 && ` (${bids.length})`}
                </button>

                {bidsOpen && (
                  <div className="pdm-bids-list">
                    {bidsLoading && <p className="pdm-bids-loading">Loading offers…</p>}
                    {bidsMsg && (
                      <p className={`pdm-feedback pdm-feedback--${bidsMsg.type}`}>{bidsMsg.text}</p>
                    )}
                    {!bidsLoading && bids.length === 0 && (
                      <p className="pdm-bids-empty">No offers yet.</p>
                    )}

                    {pendingBids.length > 0 && (
                      <>
                        <p className="pdm-bids-group-label">Pending</p>
                        {pendingBids.map(bid => (
                          <BidRow
                            key={bid._id}
                            bid={bid}
                            canAccept={isActive}
                            accepting={acceptingId === bid._id}
                            onAccept={() => handleAccept(bid._id)}
                          />
                        ))}
                      </>
                    )}

                    {otherBids.length > 0 && (
                      <>
                        <p className="pdm-bids-group-label">Previous</p>
                        {otherBids.map(bid => (
                          <BidRow
                            key={bid._id}
                            bid={bid}
                            canAccept={false}
                            accepting={false}
                            onAccept={() => {}}
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Buyer: offer form ── */}
            {canOffer && (
              <div className="pdm-offer-section">
                <div className="pdm-divider" />
                {offerMsg && (
                  <p className={`pdm-feedback pdm-feedback--${offerMsg.type}`}>{offerMsg.text}</p>
                )}
                {!offerOpen && !offerMsg?.type.includes('ok') && (
                  <button className="pdm-offer-open-btn" onClick={() => setOfferOpen(true)}>
                    Make an Offer
                  </button>
                )}
                {offerOpen && (
                  <form className="pdm-offer-form" onSubmit={handleSubmitOffer}>
                    <p className="pdm-offer-form-title">Submit your offer</p>
                    <label className="pdm-offer-label">
                      Your offer ($)
                      <input
                        className="pdm-offer-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder={`Asking price: $${localPost.price}`}
                        value={offerPrice}
                        onChange={e => setOfferPrice(e.target.value)}
                      />
                    </label>
                    <label className="pdm-offer-label">
                      Message to seller (optional)
                      <textarea
                        className="pdm-offer-textarea"
                        rows={3}
                        maxLength={500}
                        placeholder="e.g. Can we meet this weekend?"
                        value={offerMessage}
                        onChange={e => setOfferMessage(e.target.value)}
                      />
                    </label>
                    <div className="pdm-offer-actions">
                      <button type="button" className="pdm-offer-cancel" onClick={() => setOfferOpen(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="pdm-offer-submit" disabled={offerSubmitting}>
                        {offerSubmitting ? 'Sending…' : 'Send Offer'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

/* ── BidRow sub-component ── */
interface BidRowProps {
  bid: PopulatedOffer
  canAccept: boolean
  accepting: boolean
  onAccept: () => void
}

function BidRow({ bid, canAccept, accepting, onAccept }: BidRowProps) {
  const buyer = bid.buyer
  const avatarSrc = buyer.profilePicture
    ? `${import.meta.env.VITE_API_URL}${buyer.profilePicture}`
    : null

  const statusColors: Record<string, string> = {
    pending: '#c9960c', accepted: '#2d7a4f', declined: '#9c7a5a', cancelled: '#c0392b',
  }

  return (
    <div className="pdm-bid-row">
      <div className="pdm-bid-buyer">
        {avatarSrc ? (
          <img className="pdm-bid-avatar" src={avatarSrc} alt={buyer.username} />
        ) : (
          <div className="pdm-bid-avatar-placeholder">
            {buyer.username.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="pdm-bid-buyer-info">
          <span className="pdm-bid-username">{buyer.username}</span>
          {bid.message && <span className="pdm-bid-message">"{bid.message}"</span>}
        </div>
      </div>
      <div className="pdm-bid-right">
        <span className="pdm-bid-price">${bid.offerPrice}</span>
        <span className="pdm-bid-status" style={{ color: statusColors[bid.status] ?? '#9c7a5a' }}>
          {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
        </span>
        {canAccept && bid.status === OfferStatus.Pending && (
          <button className="pdm-bid-accept-btn" onClick={onAccept} disabled={accepting}>
            {accepting ? 'Accepting…' : 'Accept'}
          </button>
        )}
      </div>
    </div>
  )
}
