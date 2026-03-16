import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { ThemeProvider } from './contexts/ThemeContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Onboarding from './pages/Onboarding'
import Chat from './pages/Chat'
import Chats from './pages/Chats'
import Retirement from './pages/Retirement'
import News from './pages/News'
import Money from './pages/Money'
import Settings from './pages/Settings'

export default function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/onboarding" element={user ? <Onboarding /> : <Navigate to="/login" />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/chats" element={user ? <Chats /> : <Navigate to="/login" />} />
          <Route path="/chat/:id" element={user ? <Chat /> : <Navigate to="/login" />} />
          <Route path="/retirement" element={user ? <Retirement /> : <Navigate to="/login" />} />
          <Route path="/news" element={user ? <News /> : <Navigate to="/login" />} />
          <Route path="/money" element={user ? <Money /> : <Navigate to="/login" />} />
          <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
