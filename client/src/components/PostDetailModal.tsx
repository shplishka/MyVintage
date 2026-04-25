import type { PostData } from './EditPostModal'
import './PostDetailModal.css'

interface Props {
  post: PostData
  sellerRating: number
  sellerLocation: string | null
  isOwner: boolean
  onClose: () => void
  onEdit: () => void
}

const CONDITION_LABELS: Record<string, string> = {
  like_new: 'Like New', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function PostDetailModal({ post, sellerRating, sellerLocation, isOwner, onClose, onEdit }: Props) {
  const imgSrc = post.images?.[0]
    ? `${import.meta.env.VITE_API_URL}${post.images[0]}`
    : null

  const sellerAvatar = post.seller?.profilePicture
    ? `${import.meta.env.VITE_API_URL}${post.seller.profilePicture}`
    : null

  const conditionLabel = CONDITION_LABELS[post.condition] ?? post.condition

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
              <img className="pdm-img" src={imgSrc} alt={post.title} />
            ) : (
              <div className="pdm-img-placeholder" />
            )}

            {/* Badges */}
            <div className="pdm-badges">
              <span className="pdm-badge">{conditionLabel}</span>
              {post.year && <span className="pdm-badge">{post.year}s</span>}
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
            {/* Title + price */}
            <div className="pdm-title-row">
              <h2 className="pdm-title">{post.title}</h2>
              <span className="pdm-price">${post.price}</span>
            </div>

            {/* Category */}
            <p className="pdm-category">
              {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
            </p>

            {/* Seller row */}
            <div className="pdm-seller-row">
              {sellerAvatar ? (
                <img className="pdm-avatar" src={sellerAvatar} alt={post.seller.username} />
              ) : (
                <div className="pdm-avatar-placeholder">
                  {post.seller?.username?.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="pdm-seller-name">{post.seller?.username}</span>
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
              <span className="pdm-time">{timeAgo(post.createdAt)}</span>
            </div>

            <div className="pdm-divider" />

            {/* Description */}
            {post.description && (
              <p className="pdm-description">{post.description}</p>
            )}

            {/* Detail chips */}
            <div className="pdm-chips">
              <div className="pdm-chip">
                <span className="pdm-chip-label">Condition</span>
                <span className="pdm-chip-value">{conditionLabel}</span>
              </div>
              <div className="pdm-chip">
                <span className="pdm-chip-label">Year</span>
                <span className="pdm-chip-value">{post.year}s</span>
              </div>
              <div className="pdm-chip">
                <span className="pdm-chip-label">Brand</span>
                <span className="pdm-chip-value">{post.brand}</span>
              </div>
              <div className="pdm-chip">
                <span className="pdm-chip-label">Style</span>
                <span className="pdm-chip-value">{post.style}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
