import { useAuth } from '../context/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { logout } = useAuth()

  return (
    <header className="navbar">
      <span className="navbar-logo">MyVintage</span>
      <button className="navbar-logout" onClick={() => logout()}>
        Log out
      </button>
    </header>
  )
}
