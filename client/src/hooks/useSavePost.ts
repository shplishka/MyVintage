import { useEffect, useState } from 'react'
import api from '../api/axiosInstance'

export function useSavePost(postId: string, initialSaved: boolean) {
  const [saved, setSaved] = useState(initialSaved)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 3000)
    return () => clearTimeout(t)
  }, [error])

  async function toggleSave(e: React.MouseEvent) {
    e.stopPropagation()
    if (loading) return
    const prev = saved
    setSaved(!prev)
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post<{ saved: boolean; savesCount: number }>(
        `/api/posts/${postId}/save`
      )
      setSaved(data.saved)
    } catch {
      setSaved(prev)
      setError('Could not save post. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return { saved, toggleSave, loading, error }
}
