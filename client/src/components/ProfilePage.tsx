import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api/axiosInstance'
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
      </div>

      <div className="profile-divider" />
      <section className="profile-posts-section">
        <h2 className="profile-posts-title">Products</h2>

        {loadingPosts ? (
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
        )}
      </section>
    </div>
  )
}
