import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function useCountUp(target: number, duration = 1800, start = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return value
}

function AnimatedRing({ score, color }: { score: number; color: string }) {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setProgress(score), 300)
    return () => clearTimeout(t)
  }, [score])
  const r = 38
  const circ = 2 * Math.PI * r
  const filled = (progress / 100) * circ
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
      <circle
        cx="50" cy="50" r={r} fill="none"
        stroke={color} strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        strokeDashoffset={circ * 0.25}
        style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      <text x="50" y="47" textAnchor="middle" fill="white" fontSize="18" fontWeight="700" fontFamily="Inter,sans-serif">{progress}</text>
      <text x="50" y="60" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="Inter,sans-serif">SCORE</text>
    </svg>
  )
}

const TICKER_ITEMS = [
  'Net worth tracking', 'AI financial advisor', 'Retirement planner',
  'Debt optimizer', 'Goal tracking', 'Market watchlist',
  'Cash flow analysis', 'Health score', 'Personalized insights',
  'Secure & private', 'No ads. Ever.',
]

export default function Landing() {
  const navigate = useNavigate()
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsVisible, setStatsVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true) }, { threshold: 0.4 })
    if (statsRef.current) obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  const nw = useCountUp(127400, 1800, statsVisible)
  const saved = useCountUp(2340, 1600, statsVisible)
  const score = useCountUp(84, 1400, statsVisible)

  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand-100)', overflowX: 'hidden' }}>

      {/* ── HERO ───────────────────────────────── */}
      <section style={{
        minHeight: '100svh',
        background: 'var(--sand-900)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 0 60px',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* subtle grid texture */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'repeating-linear-gradient(0deg, var(--sand-50) 0px, var(--sand-50) 1px, transparent 1px, transparent 48px), repeating-linear-gradient(90deg, var(--sand-50) 0px, var(--sand-50) 1px, transparent 1px, transparent 48px)',
          pointerEvents: 'none',
        }} />

        {/* glow blob */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-60px',
          width: '320px', height: '320px',
          background: 'radial-gradient(circle, rgba(200,148,58,0.18) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />

        {/* nav */}
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: 'var(--warning)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: '700', fontSize: '14px' }}>W</span>
            </div>
            <span style={{ color: 'var(--sand-50)', fontWeight: '500', fontSize: '16px', letterSpacing: '-0.3px' }}>WealthApp</span>
          </div>
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', borderRadius: '20px', padding: '7px 16px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign in
          </button>
        </nav>

        {/* headline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(200,148,58,0.15)', border: '0.5px solid rgba(200,148,58,0.3)', borderRadius: '20px', padding: '5px 12px', marginBottom: '28px' }}>
            <span style={{ fontSize: '12px' }}>✦</span>
            <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: '500', letterSpacing: '0.02em' }}>AI-powered personal finance</span>
          </div>

          <h1 style={{ fontSize: 'clamp(38px, 10vw, 56px)', fontWeight: '300', color: 'var(--sand-50)', margin: '0 0 6px', lineHeight: '1.1', letterSpacing: '-1.5px', maxWidth: '480px' }}>
            Your money,
          </h1>
          <h1 style={{ fontSize: 'clamp(38px, 10vw, 56px)', fontWeight: '700', color: 'var(--sand-50)', margin: '0 0 20px', lineHeight: '1.1', letterSpacing: '-1.5px', maxWidth: '480px' }}>
            finally clear.
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', margin: '0 0 40px', lineHeight: '1.6', maxWidth: '320px' }}>
            One app that knows your whole financial picture — and actually tells you what to do next.
          </p>

          <button
            onClick={() => navigate('/login')}
            className="btn-primary"
            style={{ padding: '15px 36px', fontSize: '16px', borderRadius: '14px', background: 'var(--sand-50)', color: 'var(--sand-900)', fontWeight: '600', letterSpacing: '-0.2px' }}>
            Get started free →
          </button>
        </div>

        {/* floating mock dashboard */}
        <div style={{ position: 'relative', zIndex: 2, padding: '0 20px', display: 'flex', gap: '12px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {/* health score card */}
          <div style={{ flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px', minWidth: '200px' }}>
            <AnimatedRing score={84} color="var(--warning)" />
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Health</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--sand-50)', lineHeight: 1 }}>Good</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>+6 this month</div>
            </div>
          </div>

          {/* net worth card */}
          <div style={{ flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '18px 20px', minWidth: '170px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Net worth</div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--sand-50)', letterSpacing: '-0.5px', lineHeight: 1 }}>$127k</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: '#7a9e6e', fontWeight: '600' }}>↑ 8.2%</span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>YTD</span>
            </div>
            {/* mini sparkline */}
            <svg width="130" height="32" viewBox="0 0 130 32" style={{ marginTop: '10px', display: 'block' }}>
              <polyline
                points="0,28 18,24 36,26 54,18 72,14 90,10 108,6 130,2"
                fill="none" stroke="rgba(122,158,110,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline
                points="0,28 18,24 36,26 54,18 72,14 90,10 108,6 130,2 130,32 0,32"
                fill="rgba(122,158,110,0.08)" stroke="none" />
            </svg>
          </div>

          {/* insight card */}
          <div style={{ flexShrink: 0, background: 'rgba(122,158,110,0.12)', border: '0.5px solid rgba(122,158,110,0.25)', borderRadius: '20px', padding: '18px 20px', minWidth: '200px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(122,158,110,0.8)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Insight ✦</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: '1.5' }}>You could pay off your car loan 14 months early by adding $180/mo.</div>
          </div>
        </div>
      </section>

      {/* ── TICKER ─────────────────────────────── */}
      <div style={{ background: 'var(--sand-900)', borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '14px 0', overflow: 'hidden' }}>
        <div style={{ display: 'flex', animation: 'tickerScroll 24s linear infinite', width: 'max-content', gap: '0' }}>
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '0 20px', fontSize: '13px', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', fontWeight: '500' }}>
              <span style={{ color: 'var(--warning)', fontSize: '10px' }}>◆</span>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── FEATURES ───────────────────────────── */}
      <section style={{ padding: '72px 20px 64px', maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p className="label" style={{ marginBottom: '12px' }}>What you get</p>
          <h2 style={{ fontSize: '32px', fontWeight: '300', letterSpacing: '-0.8px', color: 'var(--sand-900)', margin: '0 0 8px' }}>Built to think ahead.</h2>
          <h2 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.8px', color: 'var(--sand-900)', margin: 0 }}>For people who want more.</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Feature 1 */}
          <div className="card animate-fade" style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, width: '44px', height: '44px', background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
              🧠
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 6px' }}>AI that knows your finances</h3>
              <p style={{ fontSize: '14px', color: 'var(--sand-600)', margin: '0 0 12px', lineHeight: '1.5' }}>Ask anything. Get answers grounded in your actual numbers — not generic advice.</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Chat anytime', 'Personalized', 'Context-aware'].map(tag => (
                  <span key={tag} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--sand-600)', background: 'var(--sand-200)', padding: '3px 10px', borderRadius: '20px' }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="card animate-fade stagger-2" style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, width: '44px', height: '44px', background: 'rgba(122,158,110,0.1)', border: '0.5px solid rgba(122,158,110,0.2)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
              📈
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 6px' }}>See your whole financial picture</h3>
              <p style={{ fontSize: '14px', color: 'var(--sand-600)', margin: '0 0 14px', lineHeight: '1.5' }}>Net worth, cash flow, goals, and retirement — all in one place, always up to date.</p>
              {/* mini progress bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[{ label: 'Emergency fund', pct: 68, color: 'var(--warning)' }, { label: 'Vacation goal', pct: 43, color: 'var(--success)' }].map(g => (
                  <div key={g.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--sand-600)' }}>{g.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-700)' }}>{g.pct}%</span>
                    </div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${g.pct}%`, background: g.color }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="card animate-fade stagger-3" style={{ display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, width: '44px', height: '44px', background: 'rgba(200,148,58,0.1)', border: '0.5px solid rgba(200,148,58,0.25)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
              ⚡
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 6px' }}>Debt gone faster</h3>
              <p style={{ fontSize: '14px', color: 'var(--sand-600)', margin: '0 0 12px', lineHeight: '1.5' }}>Avalanche or snowball — the optimizer shows you exactly how to save the most interest.</p>
              <div style={{ background: 'rgba(200,148,58,0.08)', border: '0.5px solid rgba(200,148,58,0.2)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>💡</span>
                <span style={{ fontSize: '13px', color: 'var(--sand-700)', fontWeight: '500' }}>Save <strong style={{ color: 'var(--sand-900)' }}>$4,820</strong> in interest by switching strategies</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── LIVE STATS ─────────────────────────── */}
      <section ref={statsRef} style={{ background: 'var(--sand-900)', padding: '64px 24px', textAlign: 'center' }}>
        <p className="label" style={{ color: 'rgba(255,255,255,0.35)', marginBottom: '40px' }}>Real numbers, real clarity</p>
        <div style={{ display: 'flex', justifyContent: 'space-around', gap: '8px', maxWidth: '480px', margin: '0 auto' }}>
          {[
            { label: 'Net worth tracked', value: `$${(nw / 1000).toFixed(0)}k`, sub: 'example user' },
            { label: 'Saved last month', value: fmt(saved), sub: 'after optimization' },
            { label: 'Health score', value: `${score}`, sub: 'out of 100' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(28px, 7vw, 36px)', fontWeight: '700', color: 'var(--sand-50)', letterSpacing: '-1px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'rgba(255,255,255,0.35)', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────── */}
      <section style={{ padding: '72px 20px 64px', maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <p className="label" style={{ marginBottom: '12px' }}>How it works</p>
          <h2 style={{ fontSize: '28px', fontWeight: '600', letterSpacing: '-0.6px', color: 'var(--sand-900)', margin: 0 }}>Up and running in minutes.</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {[
            { n: '01', title: 'Enter your numbers', body: 'Income, assets, debts, goals. Takes about 3 minutes.' },
            { n: '02', title: 'AI builds your picture', body: 'Instant health score, cash flow analysis, and personalized insights.' },
            { n: '03', title: 'Get a plan', body: 'Clear next actions, debt payoff strategy, and retirement projections.' },
          ].map((step, i) => (
            <div key={step.n} style={{ display: 'flex', gap: '20px', paddingBottom: i < 2 ? '28px' : 0, position: 'relative' }}>
              {i < 2 && <div style={{ position: 'absolute', left: '19px', top: '40px', width: '2px', height: 'calc(100% - 12px)', background: 'var(--sand-300)' }} />}
              <div style={{ flexShrink: 0, width: '40px', height: '40px', background: 'var(--sand-900)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--sand-50)', fontVariantNumeric: 'tabular-nums' }}>{step.n}</span>
              </div>
              <div style={{ paddingTop: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 4px' }}>{step.title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--sand-600)', margin: 0, lineHeight: '1.5' }}>{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────── */}
      <section style={{ background: 'var(--sand-900)', padding: '72px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: '-40px', left: '50%', transform: 'translateX(-50%)', width: '400px', height: '200px', background: 'radial-gradient(ellipse, rgba(200,148,58,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: '34px', fontWeight: '300', color: 'var(--sand-50)', margin: '0 0 4px', letterSpacing: '-1px', lineHeight: 1.1 }}>Start knowing</h2>
          <h2 style={{ fontSize: '34px', fontWeight: '700', color: 'var(--sand-50)', margin: '0 0 16px', letterSpacing: '-1px', lineHeight: 1.1 }}>where you stand.</h2>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.4)', margin: '0 0 36px' }}>Free to use. No credit card.</p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary"
            style={{ padding: '16px 40px', fontSize: '16px', borderRadius: '14px', background: 'var(--sand-50)', color: 'var(--sand-900)', fontWeight: '600', letterSpacing: '-0.2px' }}>
            Create your account →
          </button>
          <div style={{ marginTop: '16px' }}>
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────── */}
      <footer style={{ background: 'var(--sand-900)', borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '20px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', margin: 0 }}>Your financial data is encrypted and never shared with third parties.</p>
      </footer>

    </div>
  )
}
