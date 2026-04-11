import { Link } from 'react-router-dom'

export default function Signup() {
  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf6ec' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', color: '#3b2314' }}>Sign Up</h2>
        <p style={{ color: '#9c7a5a' }}>Coming soon.</p>
        <Link to="/login" style={{ color: '#8b4513', fontWeight: 600 }}>Back to Login</Link>
      </div>
    </div>
  )
}
