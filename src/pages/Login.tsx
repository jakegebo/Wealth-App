import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAuth = async () => {
    if (!email || !password) return
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setError(error.message)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError(error.message)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand-100)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{ width: '56px', height: '56px', background: 'var(--accent)', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <span style={{ color: 'var(--sand-50)', fontWeight: '700', fontSize: '22px' }}>W</span>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '400', color: 'var(--sand-900)', margin: '0 0 6px', letterSpacing: '-0.5px' }}>WealthApp</h1>
        <p style={{ fontSize: '14px', color: 'var(--sand-500)', margin: 0 }}>Your personal AI financial advisor</p>
      </div>

      {/* Form */}
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div className="card" style={{ padding: '28px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 20px', textAlign: 'center' }}>
            {isSignUp ? 'Create account' : 'Welcome back'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--sand-600)', marginBottom: '6px' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                placeholder="you@example.com"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--sand-600)', marginBottom: '6px' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAuth()}
                placeholder="••••••••"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(192,57,43,0.08)', border: '0.5px solid rgba(192,57,43,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--danger)', margin: 0 }}>{error}</p>
            </div>
          )}

          <button onClick={handleAuth} disabled={loading || !email || !password} className="btn-primary"
            style={{ width: '100%', padding: '13px', fontSize: '15px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loading || !email || !password ? 0.6 : 1 }}>
            {loading ? (
              <>
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                {isSignUp ? 'Creating account...' : 'Signing in...'}
              </>
            ) : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button onClick={() => { setIsSignUp(!isSignUp); setError('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', color: 'var(--sand-500)' }}>
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>

      {/* Footer */}
      <p style={{ fontSize: '11px', color: 'var(--sand-400)', marginTop: '48px', textAlign: 'center', maxWidth: '280px', lineHeight: '1.5' }}>
        Your financial data is encrypted and never shared with third parties.
      </p>
    </div>
  )
}
