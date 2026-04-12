import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import './ProfilePage.css'

interface User {
  _id: string
  username: string
  email: string
  profilePhoto?: string
}

interface Post {
  _id: string
  title?: string
  imageUrl?: string
  image?: string
  description?: string
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()

  const [user, setUser] = useState<User | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'listings' | 'saved' | 'sold'>('listings')
  const { user: authUser } = useAuth()
  const isOwner = authUser?._id === userId

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
      .get<Post[]>(`/api/posts?userId=${userId}`)
      .then(({ data }) => setPosts(data))
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false))
  }, [userId])

  if (loadingUser) {
    return <div className="profile-loading">Loading profile…</div>
  }

  if (error || !user) {
    return <div className="profile-error">{error ?? 'User not found.'}</div>
  }

  const avatarSrc = user.profilePhoto
    ? `${import.meta.env.VITE_API_URL}/${user.profilePhoto}`
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
          <p className="profile-email">{user.email}</p>
        </div>

        {isOwner && (
          <button className="profile-edit-btn" aria-label="Edit profile">
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
        {(['listings', 'saved', 'sold'] as const).map((tab) => (
          <button
            key={tab}
            className={`profile-tab${activeTab === tab ? ' profile-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'listings' ? 'My Listings' : tab === 'saved' ? 'Saved' : 'Archive'}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <section className="profile-posts-section">
        {activeTab === 'listings' && (
          loadingPosts ? (
            <p className="profile-posts-loading">Loading posts…</p>
          ) : posts.length === 0 ? (
            <p className="profile-no-posts">no posts yet</p>
          ) : (
            <div className="profile-posts-grid">
              {posts.map((post) => {
                const imgSrc = post.imageUrl ?? post.image
                  ? `${import.meta.env.VITE_API_URL}/${post.imageUrl ?? post.image}`
                  : null

                return (
                  <div key={post._id} className="profile-post-card">
                    {imgSrc ? (
                      <img className="post-card-img" src={imgSrc} alt={post.title ?? 'Post'} />
                    ) : (
                      <div className="post-card-img-placeholder" />
                    )}
                    {post.title && <p className="post-card-title">{post.title}</p>}
                  </div>
                )
              })}
            </div>
          )
        )}

        {activeTab === 'saved' && (
          <p className="profile-no-posts">No saved items yet.</p>
        )}

        {activeTab === 'sold' && (
          <p className="profile-no-posts">No archived items yet.</p>
        )}
      </section>
    </div>
  )
}
