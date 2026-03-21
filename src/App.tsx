import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProfileProvider } from './contexts/ProfileContext'
import BottomNav from './components/BottomNav'
import FAB from './components/FAB'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Home from './pages/Home'
import Plan from './pages/Plan'
import Grow from './pages/Grow'
import Onboarding from './pages/Onboarding'
import Chat from './pages/Chat'
import Chats from './pages/Chats'
import Retirement from './pages/Retirement'
import News from './pages/News'
import Money from './pages/Money'
import Settings from './pages/Settings'

const SHOW_NAV = ['/dashboard', '/plan', '/grow']

function Layout({ user, children }: { user: any; children: React.ReactNode }) {
  const location = useLocation()
  const showNav = user && SHOW_NAV.includes(location.pathname)

  return (
    <>
      <div key={location.pathname} className="page-enter">
        {children}
      </div>
      {showNav && <BottomNav />}
      {showNav && <FAB />}
    </>
  )
}

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sand-100)' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <ThemeProvider>
      <ProfileProvider>
      <BrowserRouter>
        <Layout user={user}>
          <Routes>
            <Route path="/" element={!user ? <Landing /> : <Navigate to="/dashboard" />} />
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
            <Route path="/onboarding" element={user ? <Onboarding /> : <Navigate to="/login" />} />
            <Route path="/dashboard" element={user ? <Home /> : <Navigate to="/login" />} />
            <Route path="/plan" element={user ? <Plan /> : <Navigate to="/login" />} />
            <Route path="/grow" element={user ? <Grow /> : <Navigate to="/login" />} />
            <Route path="/chats" element={user ? <Chats /> : <Navigate to="/login" />} />
            <Route path="/chat/:id" element={user ? <Chat /> : <Navigate to="/login" />} />
            <Route path="/retirement" element={user ? <Retirement /> : <Navigate to="/login" />} />
            <Route path="/news" element={user ? <News /> : <Navigate to="/login" />} />
            <Route path="/money" element={user ? <Money /> : <Navigate to="/login" />} />
            <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
            <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      </ProfileProvider>
    </ThemeProvider>
  )
}
