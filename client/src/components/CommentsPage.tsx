import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import './CommentsPage.css'

/* ── Types ── */
interface Seller {
  _id: string
  username: string
  profilePicture?: string | null
}

interface Post {
  _id: string
  title: string
  price: number
  category: string
  condition: string
  year: number
  images: string[]
  seller: Seller
}

interface Author {
  _id: string
  username: string
  profilePicture?: string | null
}

interface Comment {
  _id: string
  content: string
  author: Author
  createdAt: string
}

/* ── Helpers ── */
const CONDITION_LABELS: Record<string, string> = {
  like_new: 'Like New', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ── Component ── */
export default function CommentsPage() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const { user: authUser } = useAuth()

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingPost, setLoadingPost] = useState(true)
  const [loadingComments, setLoadingComments] = useState(true)
  const [postError, setPostError] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!postId) return

    api.get<Post>(`/api/posts/${postId}`)
      .then(({ data }) => setPost(data))
      .catch(() => setPostError('Could not load post.'))
      .finally(() => setLoadingPost(false))

    api.get<Comment[]>(`/api/posts/${postId}/comments`)
      .then(({ data }) => setComments(data))
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false))
  }, [postId])

  async function handleSend() {
    const content = draft.trim()
    if (!content || submitting) return
    setSubmitting(true)
    try {
      const { data } = await api.post<Comment>(`/api/posts/${postId}/comments`, { content })
      setComments(prev => [...prev, data])
      setDraft('')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    } catch {
      // keep draft so the user can retry
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const imgSrc = post?.images?.[0]
    ? `${import.meta.env.VITE_API_URL}${post.images[0]}`
    : null

  return (
    <div className="cp-page">

      {/* ── Sticky top bar ── */}
      <div className="cp-topbar">
        <button className="cp-back" onClick={() => navigate(-1)} aria-label="Go back">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="cp-topbar-title">Comments</span>
        <div className="cp-topbar-spacer" />
      </div>

      {/* ── Scrollable area ── */}
      <div className="cp-scroll">

        {/* ── Post card ── */}
        {loadingPost ? (
          <div className="cp-post-skeleton" />
        ) : postError || !post ? (
          <p className="cp-error">{postError ?? 'Post not found.'}</p>
        ) : (
          <div className="cp-post-card">
            <div className="cp-post-img-wrap">
              {imgSrc ? (
                <img className="cp-post-img" src={imgSrc} alt={post.title} />
              ) : (
                <div className="cp-post-img-placeholder" />
              )}
              <div className="cp-post-badges">
                <span className="cp-post-badge">
                  {CONDITION_LABELS[post.condition] ?? post.condition}
                </span>
                {post.year && <span className="cp-post-badge">{post.year}s</span>}
              </div>
            </div>

            <div className="cp-post-info">
              <div className="cp-post-title-row">
                <p className="cp-post-title">{post.title}</p>
                <span className="cp-post-price">${post.price}</span>
              </div>
              <p className="cp-post-category">
                {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
              </p>
              <div className="cp-post-seller">
                {post.seller?.profilePicture ? (
                  <img
                    className="cp-post-seller-avatar"
                    src={`${import.meta.env.VITE_API_URL}${post.seller.profilePicture}`}
                    alt={post.seller.username}
                  />
                ) : (
                  <div className="cp-post-seller-avatar-placeholder">
                    {post.seller?.username?.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="cp-post-seller-name">{post.seller?.username}</span>
              </div>
            </div>
          </div>
        )}

        <div className="cp-divider" />

        {/* ── Comments list ── */}
        <div className="cp-comments">
          {loadingComments ? (
            <div className="cp-comments-loading">
              {[0, 1, 2].map(i => <div key={i} className="cp-comment-skeleton" />)}
            </div>
          ) : comments.length === 0 ? (
            <div className="cp-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              <p>No comments yet.</p>
              <p className="cp-empty-sub">Be the first to say something.</p>
            </div>
          ) : (
            comments.map(comment => {
              const avatar = comment.author?.profilePicture
                ? `${import.meta.env.VITE_API_URL}${comment.author.profilePicture}`
                : null
              const isOwn = authUser?._id === comment.author?._id

              return (
                <div key={comment._id} className={`cp-comment${isOwn ? ' cp-comment--own' : ''}`}>
                  <div className="cp-comment-avatar-wrap">
                    {avatar ? (
                      <img className="cp-comment-avatar" src={avatar} alt={comment.author.username} />
                    ) : (
                      <div className="cp-comment-avatar-placeholder">
                        {comment.author?.username?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="cp-comment-body">
                    <div className="cp-comment-header">
                      <span className="cp-comment-username">{comment.author?.username}</span>
                      <span className="cp-comment-time">{timeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="cp-comment-text">{comment.content}</p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Compose bar ── */}
      <div className="cp-compose">
        {authUser?.profilePicture ? (
          <img
            className="cp-compose-avatar"
            src={`${import.meta.env.VITE_API_URL}${authUser.profilePicture}`}
            alt={authUser.username}
          />
        ) : (
          <div className="cp-compose-avatar-placeholder">
            {authUser?.username?.charAt(0).toUpperCase()}
          </div>
        )}
        <textarea
          className="cp-compose-input"
          placeholder="Add a comment…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={500}
          aria-label="Write a comment"
        />
        <button
          className="cp-compose-send"
          onClick={handleSend}
          disabled={!draft.trim() || submitting}
          aria-label="Send"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>

    </div>
  )
}
