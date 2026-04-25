import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import FeedPage from './components/FeedPage'
import SellPage from './components/SellPage'
import ProfilePage from './components/ProfilePage'
import EditProfilePage from './components/EditProfilePage'
import CommentsPage from './components/CommentsPage'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/sell" element={<SellPage />} />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/profile/:userId/edit" element={<EditProfilePage />} />
          </Route>
          {/* CommentsPage has its own top bar — no shared Layout navbar */}
          <Route path="/posts/:postId/comments" element={<CommentsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
