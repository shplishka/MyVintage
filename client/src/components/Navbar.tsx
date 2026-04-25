import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axiosInstance'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

interface UserResult {
  _id: string
  username: string
  profilePicture?: string | null
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const avatarSrc = user?.profilePicture
    ? `${import.meta.env.VITE_API_URL}${user.profilePicture}`
    : null

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) { setResults([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const { data } = await api.get<UserResult[]>(`/api/users/search?q=${encodeURIComponent(q)}`)
        setResults(data)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(userId: string) {
    setQuery('')
    setResults([])
    setOpen(false)
    navigate(`/profile/${userId}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <header className="navbar">
      {/* Logo */}
      <button className="navbar-logo" onClick={() => navigate('/')} aria-label="Home">
        MyVintage
      </button>

      {/* Center nav */}
      <nav className="navbar-nav" aria-label="Main navigation">
        <button className="navbar-nav-link" onClick={() => navigate('/')}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" />
          </svg>
          Browse
        </button>

        {/* User search */}
        <div className="navbar-search-wrap" ref={wrapperRef}>
          <div className="navbar-search-box">
            <svg className="navbar-search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" />
            </svg>
            <input
              className="navbar-search-input"
              type="text"
              placeholder="Search users…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (results.length > 0) setOpen(true) }}
              aria-label="Search users by username"
              aria-autocomplete="list"
              aria-expanded={open}
            />
            {loading && <span className="navbar-search-spinner" aria-hidden="true" />}
            {query && (
              <button
                className="navbar-search-clear"
                onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
                aria-label="Clear search"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {open && (
            <ul className="navbar-search-dropdown" role="listbox">
              {results.length === 0 ? (
                <li className="navbar-search-empty">No users found</li>
              ) : results.map(u => {
                const pic = u.profilePicture
                  ? `${import.meta.env.VITE_API_URL}${u.profilePicture}`
                  : null
                return (
                  <li key={u._id} role="option">
                    <button
                      className="navbar-search-result"
                      onMouseDown={() => handleSelect(u._id)}
                    >
                      {pic ? (
                        <img className="navbar-search-avatar" src={pic} alt={u.username} />
                      ) : (
                        <div className="navbar-search-avatar-placeholder">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="navbar-search-username">{u.username}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {user && (
          <button className="navbar-sell-btn" onClick={() => navigate('/sell')}>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Sell
          </button>
        )}
      </nav>

      {/* Right side */}
      <div className="navbar-right">
        {user && (
          <button
            className="navbar-profile-btn"
            onClick={() => navigate(`/profile/${user._id}`)}
            aria-label="My profile"
          >
            {avatarSrc ? (
              <img className="navbar-avatar" src={avatarSrc} alt={user.username} />
            ) : (
              <div className="navbar-avatar-placeholder">
                {user.username?.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="navbar-profile-label">Profile</span>
          </button>
        )}

        <button className="navbar-logout" onClick={() => logout()}>
          Log out
        </button>
      </div>
    </header>
  )
}
