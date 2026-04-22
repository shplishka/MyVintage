import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import './EditProfilePage.css'

interface User {
  _id: string
  username: string
  biography?: string | null
  location?: string | null
  profilePicture?: string | null
}

export default function EditProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user: authUser, refreshUser } = useAuth()

  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [currentPicture, setCurrentPicture] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Redirect if not the owner
  useEffect(() => {
    if (authUser && authUser._id !== userId) {
      navigate(`/profile/${userId}`, { replace: true })
    }
  }, [authUser, userId, navigate])

  // Load current user data
  useEffect(() => {
    if (!userId) return
    api.get<User>(`/api/users/${userId}`).then(({ data }) => {
      setUsername(data.username)
      setBio(data.biography ?? '')
      setLocation(data.location ?? '')
      setCurrentPicture(data.profilePicture ?? null)
    })
  }, [userId])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    setError(null)
    try {
      await api.put(`/api/users/${userId}`, {
        username: username.trim(),
        biography: bio.trim(),
        location: location.trim(),
      })

      if (photo) {
        const formData = new FormData()
        formData.append('image', photo)
        await api.post(`/api/users/${userId}/profile-picture`, formData)
      }

      await refreshUser()
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      navigate(`/profile/${userId}`)
    } catch {
      setError('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const avatarSrc = photoPreview
    ?? (currentPicture ? `${import.meta.env.VITE_API_URL}${currentPicture}` : null)

  return (
    <div className="ep-page">
      <div className="ep-card">

        {/* ── Header ── */}
        <div className="ep-header">
          <button
            className="ep-back"
            onClick={() => navigate(`/profile/${userId}`)}
            aria-label="Back to profile"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <h2 className="ep-title">Edit Profile</h2>
          <button
            className="ep-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* ── Photo ── */}
        <div className="ep-photo-section">
          <div
            className="ep-avatar-wrap"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            aria-label="Change profile photo"
          >
            {avatarSrc ? (
              <img className="ep-avatar" src={avatarSrc} alt="Profile" />
            ) : (
              <div className="ep-avatar-placeholder">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="ep-avatar-overlay">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileChange}
            />
          </div>
          <button
            className="ep-change-photo-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Change photo
          </button>
        </div>

        {/* ── Error ── */}
        {error && <p className="ep-error">{error}</p>}

        {/* ── Fields ── */}
        <div className="ep-fields">
          <div className="ep-field">
            <label className="ep-label" htmlFor="ep-username">Username</label>
            <input
              id="ep-username"
              className="ep-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
            />
          </div>

          <div className="ep-field">
            <label className="ep-label" htmlFor="ep-bio">Bio</label>
            <textarea
              id="ep-bio"
              className="ep-textarea"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell people about yourself"
              rows={4}
            />
          </div>

          <div className="ep-field">
            <label className="ep-label" htmlFor="ep-location">Location</label>
            <input
              id="ep-location"
              className="ep-input"
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="City, Country"
            />
          </div>
        </div>

      </div>
    </div>
  )
}
