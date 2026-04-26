import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import PostDetailModal from './PostDetailModal'
import EditPostModal, { type PostData } from './EditPostModal'
import './FeedPage.css'

/* ── Types ── */
interface Seller {
  _id: string
  username: string
  profilePicture?: string | null
}

interface FeedPost {
  _id: string
  title: string
  description: string
  category: string
  price: number
  condition: string
  year: number
  brand: string
  style: string
  images: string[]
  status?: string
  likesCount: number
  commentsCount: number
  seller: Seller
  createdAt: string
  isSaved?: boolean
}

/* ── Categories ── */
const CATEGORIES = [
  { key: '', label: 'All' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'furniture', label: 'Furniture' },
  { key: 'jewelry', label: 'Jewelry' },
  { key: 'electronics', label: 'Electronics' },
  { key: 'books', label: 'Books' },
  { key: 'art', label: 'Art' },
  { key: 'accessories', label: 'Accessories' },
  { key: 'other', label: 'Other' },
]

export default function FeedPage() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()

  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('')
  const [likeState, setLikeState] = useState<Record<string, { liked: boolean; count: number }>>({})
  const [saveState, setSaveState] = useState<Record<string, { saved: boolean }>>({})
  const [feedSaveError, setFeedSaveError] = useState<string | null>(null)
  const [viewingPost, setViewingPost] = useState<FeedPost | null>(null)
  const [editingPost, setEditingPost] = useState<PostData | null>(null)

  const [smartQuery, setSmartQuery] = useState('')
  const [smartResults, setSmartResults] = useState<FeedPost[] | null>(null)
  const [smartExplanation, setSmartExplanation] = useState<string | null>(null)
  const [smartLoading, setSmartLoading] = useState(false)
  const [smartError, setSmartError] = useState<string | null>(null)
  const smartDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const smartReqIdRef = useRef(0)

  useEffect(() => {
    setLoading(true)
    const params = activeCategory ? `?category=${activeCategory}` : ''
    api.get<FeedPost[]>(`/api/posts${params}`)
      .then(({ data }) => {
        setPosts(data)
        const likeSeed: Record<string, { liked: boolean; count: number }> = {}
        const saveSeed: Record<string, { saved: boolean }> = {}
        data.forEach(p => {
          likeSeed[p._id] = { liked: false, count: p.likesCount }
          saveSeed[p._id] = { saved: p.isSaved ?? false }
        })
        setLikeState(prev => ({ ...likeSeed, ...prev }))
        setSaveState(prev => ({ ...saveSeed, ...prev }))
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [activeCategory])

  async function toggleLike(postId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const current = likeState[postId]
    if (!current) return
    const next = { liked: !current.liked, count: current.liked ? current.count - 1 : current.count + 1 }
    setLikeState(prev => ({ ...prev, [postId]: next }))
    try {
      const { data } = await api.post<{ liked: boolean; likesCount: number }>(`/api/posts/${postId}/like`)
      setLikeState(prev => ({ ...prev, [postId]: { liked: data.liked, count: data.likesCount } }))
    } catch {
      setLikeState(prev => ({ ...prev, [postId]: current }))
    }
  }

  async function toggleSave(postId: string, e: React.MouseEvent) {
    e.stopPropagation()
    const current = saveState[postId]
    if (!current) return
    setSaveState(prev => ({ ...prev, [postId]: { saved: !current.saved } }))
    try {
      const { data } = await api.post<{ saved: boolean; savesCount: number }>(`/api/posts/${postId}/save`)
      setSaveState(prev => ({ ...prev, [postId]: { saved: data.saved } }))
    } catch {
      setSaveState(prev => ({ ...prev, [postId]: current }))
      setFeedSaveError('Could not save post. Please try again.')
      setTimeout(() => setFeedSaveError(null), 3000)
    }
  }

  // Debounce: fire smart search 600 ms after the user stops typing (min 3 chars)
  useEffect(() => {
    if (smartDebounceRef.current) clearTimeout(smartDebounceRef.current)
    const q = smartQuery.trim()
    if (q.length === 0) {
      setSmartResults(null)
      setSmartExplanation(null)
      setSmartError(null)
      setSmartLoading(false)
      return
    }
    if (q.length < 3) {
      setSmartLoading(false)
      return
    }
    smartDebounceRef.current = setTimeout(() => runSmartSearch(q), 600)
    return () => { if (smartDebounceRef.current) clearTimeout(smartDebounceRef.current) }
  }, [smartQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  async function runSmartSearch(q: string) {
    const id = ++smartReqIdRef.current
    setSmartLoading(true)
    setSmartError(null)
    try {
      const { data } = await api.post<{ posts: FeedPost[]; explanation: string; fallback?: boolean }>(
        '/api/posts/smart-search', { prompt: q }
      )
      if (id !== smartReqIdRef.current) return // stale — a newer request is in flight
      setSmartResults(data.posts)
      setSmartExplanation(data.explanation)
      if (data.fallback) {
        setSmartError('Smart search had a problem. Showing basic results instead.')
      }
      const likeSeed: Record<string, { liked: boolean; count: number }> = {}
      const saveSeed: Record<string, { saved: boolean }> = {}
      data.posts.forEach(p => {
        likeSeed[p._id] = { liked: false, count: p.likesCount }
        saveSeed[p._id] = { saved: p.isSaved ?? false }
      })
      setLikeState(prev => ({ ...likeSeed, ...prev }))
      setSaveState(prev => ({ ...saveSeed, ...prev }))
    } catch {
      if (id !== smartReqIdRef.current) return
      // Keep any previous results visible; just surface the error
      setSmartError('Smart search had a problem. Showing basic results instead.')
    } finally {
      if (id === smartReqIdRef.current) setSmartLoading(false)
    }
  }

  // Manual Search button / Enter key — cancel pending debounce and fire immediately
  function handleSmartSearch() {
    if (smartDebounceRef.current) clearTimeout(smartDebounceRef.current)
    const q = smartQuery.trim()
    if (!q || q.length < 3) return
    runSmartSearch(q)
  }

  function clearSmartSearch() {
    if (smartDebounceRef.current) clearTimeout(smartDebounceRef.current)
    smartReqIdRef.current++ // invalidate any in-flight request
    setSmartQuery('')
    setSmartResults(null)
    setSmartExplanation(null)
    setSmartError(null)
    setSmartLoading(false)
  }

  const displayPosts = smartResults ?? posts

  return (
    <div className="feed-page">
      {feedSaveError && (
        <div className="save-toast" role="alert">{feedSaveError}</div>
      )}

      {/* ── Hero ── */}
      <section className="feed-hero">
        <div className="feed-hero-overlay" />
        <div className="feed-hero-content">
          <span className="feed-hero-tag">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8.95 1.01a1.35 1.35 0 00-1.9 0L1.01 7.05a1.35 1.35 0 000 1.9l6.04 6.04a1.35 1.35 0 001.9 0l6.04-6.04a1.35 1.35 0 000-1.9L8.95 1.01zM8 10.5a.75.75 0 110-1.5.75.75 0 010 1.5zm.75-3.25a.75.75 0 11-1.5 0V5a.75.75 0 011.5 0v2.25z" />
            </svg>
            Curated Vintage Marketplace
          </span>
          <h1 className="feed-hero-title">
            Discover Stories<br />Worth Keeping
          </h1>
          <p className="feed-hero-sub">
            Find rare vintage treasures, unique second-hand pieces, and give beautiful items a second life.
          </p>
          <div className="feed-hero-actions">
            <button className="feed-hero-btn-primary" onClick={() => document.getElementById('feed-grid')?.scrollIntoView({ behavior: 'smooth' })}>
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              Start Browsing
            </button>
            {authUser && (
              <button className="feed-hero-btn-secondary" onClick={() => navigate(`/profile/${authUser._id}`)}>
                Sell an Item
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Smart Search ── */}
      <div className="feed-smart-search-wrap">
        <div className="feed-smart-search-inner">
          <svg className="feed-smart-search-sparkle" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <input
            className="feed-smart-search-input"
            type="text"
            placeholder="Try: '70s denim jacket under $80' or 'like-new jewelry by Chanel'"
            value={smartQuery}
            onChange={e => setSmartQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSmartSearch()}
            aria-label="Smart natural language search"
          />
          {smartQuery && !smartLoading && (
            <button className="feed-smart-search-clear" onClick={clearSmartSearch} aria-label="Clear search">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          <button
            className="feed-smart-search-btn"
            onClick={handleSmartSearch}
            disabled={!smartQuery.trim() || smartLoading}
            aria-label="Run smart search"
          >
            {smartLoading ? <span className="feed-smart-spinner" aria-hidden="true" /> : 'Search'}
          </button>
        </div>
        {smartError && <p className="feed-smart-error" role="alert">{smartError}</p>}
      </div>

      {/* ── Category strip ── */}
      <div className="feed-categories-wrap">
        <div className="feed-categories">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              className={`feed-cat-pill${activeCategory === cat.key ? ' feed-cat-pill--active' : ''}`}
              onClick={() => setActiveCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Featured Finds ── */}
      <section className="feed-section" id="feed-grid">
        <div className="feed-section-header">
          <div>
            <h2 className="feed-section-title">
              {smartLoading ? 'Searching…' : smartResults ? 'Search Results' : 'Featured Finds'}
            </h2>
            <p className="feed-section-sub">
              {!smartResults
                ? 'Hand-picked treasures from our community'
                : smartLoading ? ''
                : `${smartResults.length} item${smartResults.length === 1 ? '' : 's'} found`}
            </p>
          </div>
        </div>

        {smartExplanation && (
          <div className="feed-smart-banner" role="status">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="feed-smart-banner-text">{smartExplanation}</span>
            <button className="feed-smart-banner-clear" onClick={clearSmartSearch}>Clear</button>
          </div>
        )}

        {loading && !smartResults ? (
          <div className="feed-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="feed-card feed-card--skeleton">
                <div className="feed-skeleton-img" />
                <div className="feed-skeleton-body">
                  <div className="feed-skeleton-line feed-skeleton-line--short" />
                  <div className="feed-skeleton-line feed-skeleton-line--xshort" />
                </div>
              </div>
            ))}
          </div>
        ) : displayPosts.length === 0 ? (
          <div className="feed-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 3.75h6m-3-3v6M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5H4.5A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
            <p className="feed-empty-title">{smartResults ? 'No results found.' : 'No sells yet.'}</p>
            <p className="feed-empty-sub">{smartResults ? 'Try rephrasing your search.' : 'Be the first to post something vintage.'}</p>
          </div>
        ) : (
          <div className="feed-grid">
            {displayPosts.map(post => {
              const imgSrc = post.images?.[0]
                ? `${import.meta.env.VITE_API_URL}${post.images[0]}`
                : null
              const avatarSrc = post.seller?.profilePicture
                ? `${import.meta.env.VITE_API_URL}${post.seller.profilePicture}`
                : null
              const like = likeState[post._id] ?? { liked: false, count: post.likesCount }
              const save = saveState[post._id] ?? { saved: post.isSaved ?? false }

              return (
                <article
                  key={post._id}
                  className="feed-card"
                  onClick={() => setViewingPost(post)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setViewingPost(post)}
                >
                  {/* Image */}
                  <div className="feed-card-img-wrap">
                    {imgSrc ? (
                      <img className="feed-card-img" src={imgSrc} alt={post.title} loading="lazy" />
                    ) : (
                      <div className="feed-card-img-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 3.75h6m-3-3v6M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5H4.5A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z" />
                        </svg>
                      </div>
                    )}
                    {post.status && post.status !== 'active' && (
                      <span className={`feed-card-status-badge feed-card-status-badge--${post.status}`}>
                        {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                      </span>
                    )}

                    {/* Actions: bookmark + heart */}
                    <div className="feed-card-actions">
                      <button
                        className={`feed-card-bookmark${save.saved ? ' feed-card-bookmark--saved' : ''}`}
                        onClick={e => toggleSave(post._id, e)}
                        aria-label={save.saved ? 'Unsave' : 'Save'}
                      >
                        {save.saved ? (
                          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M6.75 3A2.25 2.25 0 004.5 5.25v15.75l7.5-3.75 7.5 3.75V5.25A2.25 2.25 0 0017.25 3H6.75z" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                          </svg>
                        )}
                      </button>

                    {/* Heart */}
                    <button
                      className={`feed-card-heart${like.liked ? ' feed-card-heart--liked' : ''}`}
                      onClick={e => toggleLike(post._id, e)}
                      aria-label={like.liked ? 'Unlike' : 'Like'}
                    >
                      <svg viewBox="0 0 24 24" fill={like.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="feed-card-info">
                    <div className="feed-card-title-row">
                      <p className="feed-card-title">{post.title}</p>
                      <span className="feed-card-price">${post.price}</span>
                    </div>
                    <div className="feed-card-seller-row">
                      {avatarSrc ? (
                        <img
                          className="feed-card-avatar"
                          src={avatarSrc}
                          alt={post.seller.username}
                          onClick={e => { e.stopPropagation(); navigate(`/profile/${post.seller._id}`) }}
                        />
                      ) : (
                        <div
                          className="feed-card-avatar-placeholder"
                          onClick={e => { e.stopPropagation(); navigate(`/profile/${post.seller._id}`) }}
                        >
                          {post.seller?.username?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="feed-card-seller-name">{post.seller?.username}</span>
                      <span className="feed-card-rating">
                        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        4.8
                      </span>
                    </div>
                    <div className="feed-card-meta">
                      <button
                        className="feed-card-comments"
                        onClick={e => { e.stopPropagation(); navigate(`/posts/${post._id}/comments`) }}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                        </svg>
                        {post.commentsCount === 1 ? '1 comment' : `${post.commentsCount} comments`}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Modals ── */}
      {viewingPost && !editingPost && (
        <PostDetailModal
          post={viewingPost as unknown as PostData}
          sellerRating={0}
          sellerLocation={null}
          isOwner={authUser?._id === viewingPost.seller._id}
          currentUserId={authUser?._id}
          onClose={() => setViewingPost(null)}
          onEdit={() => { setEditingPost(viewingPost as unknown as PostData); setViewingPost(null) }}
          onPostUpdated={(updated) => {
            setPosts(prev => prev.map(p => p._id === updated._id ? { ...p, ...updated } : p))
            setViewingPost(prev => prev && prev._id === updated._id ? { ...prev, ...updated } as FeedPost : prev)
          }}
        />
      )}

      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onUpdated={(updated) => {
            setPosts(prev => prev.map(p => p._id === updated._id ? { ...p, ...updated } : p))
            setEditingPost(null)
          }}
        />
      )}
    </div>
  )
}
