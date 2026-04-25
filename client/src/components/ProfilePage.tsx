import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import EditPostModal, { type PostData } from './EditPostModal'
import PostDetailModal from './PostDetailModal'
import './ProfilePage.css'

interface User {
  _id: string
  username: string
  email: string
  profilePicture?: string | null
  biography?: string | null
  location?: string | null
  rating?: number
  reviewCount?: number
  itemsSold?: number
}

type Post = PostData

function conditionLabel(c: string) {
  return c.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const isOwner = authUser?._id === userId

  const [user, setUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'sells' | 'saved' | 'sold'>('sells')

  const [viewingPost, setViewingPost] = useState<Post | null>(null)
  const [editingPost, setEditingPost] = useState<Post | null>(null)

  useEffect(() => {
    if (!userId) return

    setLoadingUser(true)
    api
      .get<User>(`/api/users/${userId}`)
      .then(({ data }) => setUser(data))
      .catch(() => setError('Could not load profile.'))
      .finally(() => setLoadingUser(false))

    setLoadingPosts(true)
    api
      .get<Post[]>(`/api/posts/user/${userId}`)
      .then(({ data }) => setPosts(data))
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false))
  }, [userId])

  function handlePostUpdated(updated: PostData) {
    setPosts(prev => prev.map(p => p._id === updated._id ? updated as Post : p))
    setViewingPost(updated as Post)
    setEditingPost(null)
  }

  if (loadingUser) return <div className="profile-loading">Loading profile…</div>
  if (error || !user) return <div className="profile-error">{error ?? 'User not found.'}</div>

  const avatarSrc = user.profilePicture
    ? `${import.meta.env.VITE_API_URL}${user.profilePicture}`
    : null

  return (
    <div className="profile-page">
      {/* ── Profile header ── */}
      <div className="profile-header">
        <div className="profile-avatar-wrap">
          {avatarSrc ? (
            <img className="profile-avatar" src={avatarSrc} alt={user.username} />
          ) : (
            <div className="profile-avatar-placeholder">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="profile-info">
          <h1 className="profile-username">{user.username}</h1>
          {user.biography && <p className="profile-bio">{user.biography}</p>}
          <div className="profile-meta">
            {user.location && (
              <>
                <span className="profile-meta-item">
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  {user.location}
                </span>
                <span className="profile-meta-dot">·</span>
              </>
            )}
            <span className="profile-meta-item profile-meta-star">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {(user.rating ?? 0).toFixed(1)}
              <span className="profile-meta-muted">({user.reviewCount ?? 0})</span>
            </span>
            <span className="profile-meta-dot">·</span>
            <span className="profile-meta-item">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              {user.itemsSold ?? 0} sold
            </span>
          </div>
        </div>

        {isOwner && (
          <button
            className="profile-edit-btn"
            onClick={() => navigate(`/profile/${userId}/edit`)}
            aria-label="Edit profile"
          >
            <svg className="profile-edit-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            Edit
          </button>
        )}
      </div>

      <div className="profile-divider" />

      {/* ── Tab bar ── */}
      <div className="profile-tabs">
        {(['sells', 'saved', 'sold'] as const).map((tab) => (
          <button
            key={tab}
            className={`profile-tab${activeTab === tab ? ' profile-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'sells' ? 'My Sells' : tab === 'saved' ? 'Saved' : 'Archive'}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <section className="profile-posts-section">
        {activeTab === 'sells' && (
          <>

            {loadingPosts ? (
              <p className="profile-posts-loading">Loading posts…</p>
            ) : posts.length === 0 ? (
              <p className="profile-no-posts">no posts yet</p>
            ) : (
              <div className="profile-posts-grid">
                {posts.map((post) => {
                  const imgSrc = post.images?.[0]
                    ? `${import.meta.env.VITE_API_URL}${post.images[0]}`
                    : null
                  const sellerAvatar = post.seller?.profilePicture
                    ? `${import.meta.env.VITE_API_URL}${post.seller.profilePicture}`
                    : null
                  const label = conditionLabel(post.condition)
                  const ago = timeAgo(post.createdAt)

                  return (
                    <div
                      key={post._id}
                      className="profile-post-card"
                      onClick={() => setViewingPost(post)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && setViewingPost(post)}
                    >
                      {/* Image + overlays */}
                      <div className="post-card-img-wrap">
                        {imgSrc ? (
                          <img className="post-card-img" src={imgSrc} alt={post.title} />
                        ) : (
                          <div className="post-card-img-placeholder" />
                        )}

                        {/* Edit pencil — owner only */}
                        {isOwner && (
                          <button
                            className="post-card-edit"
                            aria-label="Edit post"
                            onClick={e => { e.stopPropagation(); setEditingPost(post) }}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                        )}

                        <button
                          className="post-card-heart"
                          aria-label="Save"
                          onClick={e => e.stopPropagation()}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>

                        <div className="post-card-badges">
                          <span className="post-card-badge">{label}</span>
                          {post.year && <span className="post-card-badge">{post.year}s</span>}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="post-card-info">
                        <div className="post-card-title-row">
                          <p className="post-card-title">{post.title}</p>
                          <span className="post-card-price">${post.price}</span>
                        </div>
                        <p className="post-card-category">
                          {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
                        </p>
                        <div className="post-card-seller-row">
                          {sellerAvatar ? (
                            <img className="post-card-avatar" src={sellerAvatar} alt={post.seller.username} />
                          ) : (
                            <div className="post-card-avatar-placeholder">
                              {post.seller?.username?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="post-card-seller-name">{post.seller?.username}</span>
                          <span className="post-card-rating">
                            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {(user.rating ?? 0).toFixed(1)}
                          </span>
                        </div>
                        <div className="post-card-meta-row">
                          {user.location && (
                            <span className="post-card-location">
                              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                              {user.location}
                            </span>
                          )}
                          <span className="post-card-time">{ago}</span>
                        </div>
                        <button
                          className="post-card-comments-link"
                          onClick={e => { e.stopPropagation(); navigate(`/posts/${post._id}/comments`) }}
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                          </svg>
                          {post.commentsCount === 1 ? '1 comment' : `${post.commentsCount ?? 0} comments`}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
        {activeTab === 'saved' && <p className="profile-no-posts">No saved items yet.</p>}
        {activeTab === 'sold' && <p className="profile-no-posts">No archived items yet.</p>}
      </section>

      {/* ── Modals ── */}
      {viewingPost && !editingPost && (
        <PostDetailModal
          post={viewingPost}
          sellerRating={user.rating ?? 0}
          sellerLocation={user.location ?? null}
          isOwner={isOwner}
          onClose={() => setViewingPost(null)}
          onEdit={() => { setEditingPost(viewingPost); setViewingPost(null) }}
        />
      )}

      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onUpdated={handlePostUpdated}
        />
      )}
    </div>
  )
}
