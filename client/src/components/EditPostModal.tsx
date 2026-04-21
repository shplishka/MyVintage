import { useRef, useState } from 'react'
import api from '../api/axiosInstance'
import './NewPostModal.css'
import './EditPostModal.css'

export interface PostData {
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
  seller: { _id: string; username: string; profilePicture?: string | null }
  createdAt: string
}

interface Props {
  post: PostData
  onClose: () => void
  onUpdated: (post: PostData) => void
}

const CATEGORIES = ['clothing', 'accessories', 'jewelry', 'furniture', 'art', 'electronics', 'books', 'other']
const CONDITIONS = ['like_new', 'excellent', 'good', 'fair', 'poor']
const CONDITION_LABELS: Record<string, string> = {
  like_new: 'Like New', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor',
}

export default function EditPostModal({ post, onClose, onUpdated }: Props) {
  const [title, setTitle] = useState(post.title)
  const [description, setDescription] = useState(post.description)
  const [category, setCategory] = useState(post.category)
  const [price, setPrice] = useState(String(post.price))
  const [condition, setCondition] = useState(post.condition)
  const [year, setYear] = useState(String(post.year))
  const [brand, setBrand] = useState(post.brand)
  const [style, setStyle] = useState(post.style)

  const existingImgSrc = post.images?.[0]
    ? `${import.meta.env.VITE_API_URL}${post.images[0]}`
    : null

  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(existingImgSrc)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setNewImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : existingImgSrc)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const priceNum = parseFloat(price)
    const yearNum = parseInt(year, 10)
    if (!title || !description || !category || !condition || !brand || !style) {
      setError('All fields are required.')
      return
    }
    if (isNaN(priceNum) || priceNum < 0) { setError('Enter a valid price.'); return }
    if (isNaN(yearNum) || yearNum > new Date().getFullYear()) { setError('Enter a valid year.'); return }

    setSubmitting(true)
    try {
      const { data: updated } = await api.put<PostData>(`/api/posts/${post._id}`, {
        title, description, category, price: priceNum, condition, year: yearNum, brand, style,
      })

      if (newImageFile) {
        const fd = new FormData()
        fd.append('images', newImageFile)
        const { data: imgRes } = await api.post<{ images: string[] }>(
          `/api/posts/${post._id}/images`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        updated.images = imgRes.images
      }

      onUpdated(updated)
      onClose()
    } catch {
      setError('Failed to save changes. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="npm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="npm-modal" role="dialog" aria-modal="true" aria-label="Edit listing">
        <div className="npm-header">
          <button className="npm-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <h2 className="npm-title">Edit Listing</h2>
          <button className="npm-save" form="epm-form" type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>

        <form id="epm-form" className="npm-body" onSubmit={handleSubmit}>
          <div className="npm-image-zone" onClick={() => fileInputRef.current?.click()}>
            {imagePreview ? (
              <>
                <img className="npm-image-preview" src={imagePreview} alt="Preview" />
                <div className="epm-img-overlay">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Change photo</span>
                </div>
              </>
            ) : (
              <div className="npm-image-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 3.75h6m-3-3v6M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5H4.5A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                <span>Add photo</span>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="npm-file-input" onChange={handleImageChange} aria-label="Upload image" />
          </div>

          <div className="npm-fields">
            <label className="npm-label">
              Title
              <input className="npm-input" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
            </label>
            <label className="npm-label">
              Description
              <textarea className="npm-textarea" value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} rows={3} />
            </label>
            <div className="npm-row">
              <label className="npm-label">
                Category
                <select className="npm-select" value={category} onChange={e => setCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </label>
              <label className="npm-label">
                Condition
                <select className="npm-select" value={condition} onChange={e => setCondition(e.target.value)}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
                </select>
              </label>
            </div>
            <div className="npm-row">
              <label className="npm-label">
                Price ($)
                <input className="npm-input" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
              </label>
              <label className="npm-label">
                Year
                <input className="npm-input" type="number" min="1800" max={new Date().getFullYear()} value={year} onChange={e => setYear(e.target.value)} />
              </label>
            </div>
            <div className="npm-row">
              <label className="npm-label">
                Brand
                <input className="npm-input" value={brand} onChange={e => setBrand(e.target.value)} />
              </label>
              <label className="npm-label">
                Style
                <input className="npm-input" value={style} onChange={e => setStyle(e.target.value)} />
              </label>
            </div>
          </div>

          {error && <p className="npm-error">{error}</p>}
        </form>
      </div>
    </div>
  )
}
