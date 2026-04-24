import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
const avatarSrc = user?.profilePicture
    ? `${import.meta.env.VITE_API_URL}${user.profilePicture}`
    : null

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

        {user && (
          <button
            className="navbar-sell-btn"
            onClick={() => navigate('/sell')}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Sell
          </button>
        )}
      </nav>

      {/* Right side */}
      <div className="navbar-right">
        {/* Profile */}
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
