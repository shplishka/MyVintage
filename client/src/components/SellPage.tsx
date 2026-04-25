import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import './SellPage.css'

const CATEGORIES = ['clothing', 'accessories', 'jewelry', 'furniture', 'art', 'electronics', 'books', 'other']
const CONDITIONS = ['like_new', 'excellent', 'good', 'fair', 'poor']
const CONDITION_LABELS: Record<string, string> = {
  like_new: 'Like New', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor',
}

interface CreatedPost { _id: string }

export default function SellPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [condition, setCondition] = useState('')
  const [year, setYear] = useState('')
  const [brand, setBrand] = useState('')
  const [style, setStyle] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!title || !description || !category || !price || !condition || !year || !brand || !style) {
      setError('All fields are required.')
      return
    }

    const priceNum = parseFloat(price)
    const yearNum = parseInt(year, 10)
    if (isNaN(priceNum) || priceNum < 0) { setError('Enter a valid price.'); return }
    if (isNaN(yearNum) || yearNum > new Date().getFullYear()) { setError('Enter a valid year.'); return }

    setSubmitting(true)
    try {
      const { data: post } = await api.post<CreatedPost>('/api/posts', {
        title, description, category, price: priceNum, condition, year: yearNum, brand, style,
      })

      if (imageFile) {
        const fd = new FormData()
        fd.append('images', imageFile)
        await api.post(`/api/posts/${post._id}/images`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      navigate(user ? `/profile/${user._id}` : '/')
    } catch {
      setError('Failed to create sell. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sell-page">
      <div className="sell-container">

        {/* Header */}
        <div className="sell-header">
          <h1 className="sell-title">New Sell</h1>
          <p className="sell-sub">Fill in the details below to list your vintage item.</p>
        </div>

        <form className="sell-form" onSubmit={handleSubmit}>

          {/* Image upload */}
          <div
            className="sell-image-zone"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            aria-label="Upload photo"
          >
            {imagePreview ? (
              <>
                <img className="sell-image-preview" src={imagePreview} alt="Preview" />
                <div className="sell-image-overlay">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Change photo
                </div>
              </>
            ) : (
              <div className="sell-image-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 3.75h6m-3-3v6M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5H4.5A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                <span>Add a photo</span>
                <span className="sell-image-hint">Click to upload</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sell-file-input"
              onChange={handleImageChange}
            />
          </div>

          {/* Fields */}
          <div className="sell-fields">

            <label className="sell-label">
              Title
              <input className="sell-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Vintage Levi's Jacket" maxLength={100} />
            </label>

            <label className="sell-label">
              Description
              <textarea className="sell-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the item — condition details, measurements, story…" maxLength={1000} rows={4} />
            </label>

            <div className="sell-row">
              <label className="sell-label">
                Category
                <select className="sell-select" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">Select…</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </label>

              <label className="sell-label">
                Condition
                <select className="sell-select" value={condition} onChange={e => setCondition(e.target.value)}>
                  <option value="">Select…</option>
                  {CONDITIONS.map(c => (
                    <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="sell-row">
              <label className="sell-label">
                Price ($)
                <input className="sell-input" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
              </label>

              <label className="sell-label">
                Year
                <input className="sell-input" type="number" min="1800" max={new Date().getFullYear()} value={year} onChange={e => setYear(e.target.value)} placeholder={String(new Date().getFullYear())} />
              </label>
            </div>

            <div className="sell-row">
              <label className="sell-label">
                Brand
                <input className="sell-input" value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Levi's" />
              </label>

              <label className="sell-label">
                Style
                <input className="sell-input" value={style} onChange={e => setStyle(e.target.value)} placeholder="e.g. Casual" />
              </label>
            </div>
          </div>

          {error && <p className="sell-error">{error}</p>}

          <div className="sell-actions">
            <button type="button" className="sell-cancel" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="sell-submit" disabled={submitting}>
              {submitting ? 'Publishing…' : 'Publish Sell'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
