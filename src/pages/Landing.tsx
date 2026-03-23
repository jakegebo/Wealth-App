import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, Target, Zap, Lightbulb } from 'lucide-react'

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

function useInView(threshold = 0.25) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView] as const
}

const TICKER_ITEMS = [
  'Net worth tracking', 'Debt optimizer', 'Retirement planner',
  'Goal tracking', 'Market watchlist', 'Cash flow analysis',
  'Health score', 'Personalized insights', 'Secure & private', 'No ads. Ever.',
]

export default function Landing() {
  const navigate = useNavigate()

  const [statsRef, statsVisible] = useInView(0.3)
  const [featRef, featVisible] = useInView(0.1)
  const [stepsRef, stepsVisible] = useInView(0.1)

  const nw = useCountUp(127400, 1800, statsVisible)
  const saved = useCountUp(2340, 1600, statsVisible)
  const score = useCountUp(84, 1400, statsVisible)

  // Hero card progress bars animate in after mount
  const [heroReady, setHeroReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setHeroReady(true), 400); return () => clearTimeout(t) }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--sand-100)', overflowX: 'hidden' }}>

      {/* ── HERO ──────────────────────────────────── */}
      <section style={{
        minHeight: '100svh',
        background: 'linear-gradient(160deg, var(--sand-50) 0%, var(--sand-100) 60%, var(--sand-200) 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* warm organic blob — top left */}
        <div style={{
          position: 'absolute', top: '-120px', left: '-80px',
          width: '500px', height: '500px',
          background: 'radial-gradient(ellipse at 40% 40%, var(--sand-300) 0%, transparent 65%)',
          borderRadius: '60% 40% 70% 30% / 50% 60% 40% 50%',
          opacity: 0.5, pointerEvents: 'none',
        }} />

        {/* warm organic blob — bottom right */}
        <div style={{
          position: 'absolute', bottom: '-60px', right: '-40px',
          width: '380px', height: '380px',
          background: 'radial-gradient(ellipse at 60% 60%, var(--sand-200) 0%, transparent 70%)',
          borderRadius: '40% 60% 30% 70% / 60% 40% 60% 40%',
          opacity: 0.6, pointerEvents: 'none',
        }} />

        {/* nav */}
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', position: 'relative', zIndex: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', background: 'var(--accent)',
              borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: 'var(--sand-50)', fontWeight: '700', fontSize: '14px' }}>W</span>
            </div>
            <span style={{ color: 'var(--sand-900)', fontWeight: '600', fontSize: '15px', letterSpacing: '-0.3px' }}>WealthApp</span>
          </div>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none', border: '0.5px solid var(--sand-400)',
              color: 'var(--sand-700)', borderRadius: '20px',
              padding: '7px 18px', fontSize: '13px', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: '500',
              transition: 'border-color var(--transition), color var(--transition)',
            }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.target as HTMLButtonElement).style.color = 'var(--accent)' }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = 'var(--sand-400)'; (e.target as HTMLButtonElement).style.color = 'var(--sand-700)' }}
          >
            Sign in
          </button>
        </nav>

        {/* headline + cards */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '20px 24px 0', textAlign: 'center',
          position: 'relative', zIndex: 2,
        }}>

          <div style={{ animation: 'pageEnter 0.5s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
            <h1 style={{
              fontSize: 'clamp(36px, 9vw, 52px)', fontWeight: '300',
              color: 'var(--sand-700)', margin: '0 0 2px',
              lineHeight: 1.08, letterSpacing: '-1.5px',
            }}>
              Money that finally
            </h1>
            <h1 style={{
              fontSize: 'clamp(36px, 9vw, 52px)', fontWeight: '700',
              color: 'var(--sand-900)', margin: '0 0 20px',
              lineHeight: 1.08, letterSpacing: '-1.5px',
            }}>
              makes sense.
            </h1>
          </div>

          <p style={{
            fontSize: '16px', color: 'var(--sand-600)', margin: '0 0 36px',
            lineHeight: '1.6', maxWidth: '300px',
            animation: 'pageEnter 0.5s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}>
            One place for your net worth, goals, debt, and retirement. Clear answers, not noise.
          </p>

          <div style={{ animation: 'pageEnter 0.5s 0.18s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary"
              style={{ padding: '14px 32px', fontSize: '15px', borderRadius: '12px', letterSpacing: '-0.2px' }}
            >
              Get started free →
            </button>
          </div>
        </div>

        {/* preview cards */}
        <div style={{
          position: 'relative', zIndex: 2, padding: '40px 20px 32px',
          display: 'flex', gap: '12px', overflowX: 'auto',
          scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as any,
          justifyContent: 'center',
        }}>

          {/* net worth card */}
          <div className="card" style={{
            flexShrink: 0, minWidth: '160px', maxWidth: '170px',
            animation: 'pageEnter 0.6s 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}>
            <div className="label" style={{ marginBottom: '10px' }}>Net worth</div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: 'var(--sand-900)', letterSpacing: '-0.8px', lineHeight: 1 }}>$127k</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '600' }}>↑ 8.2%</span>
              <span style={{ fontSize: '12px', color: 'var(--sand-500)' }}>YTD</span>
            </div>
            <svg width="100%" height="28" viewBox="0 0 130 28" style={{ marginTop: '10px', display: 'block' }}>
              <polyline points="0,24 20,20 40,22 60,14 80,10 100,6 120,3 130,1" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
              <polyline points="0,24 20,20 40,22 60,14 80,10 100,6 120,3 130,1 130,28 0,28" fill="var(--success)" fillOpacity="0.07" stroke="none" />
            </svg>
          </div>

          {/* goals card */}
          <div className="card" style={{
            flexShrink: 0, minWidth: '190px', maxWidth: '200px',
            animation: 'pageEnter 0.6s 0.36s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}>
            <div className="label" style={{ marginBottom: '12px' }}>Goals</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Emergency fund', pct: 68, color: 'var(--accent)' },
                { label: 'Vacation', pct: 43, color: 'var(--success)' },
              ].map(g => (
                <div key={g.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--sand-700)', fontWeight: '500' }}>{g.label}</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-800)' }}>{g.pct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: heroReady ? `${g.pct}%` : '0%', background: g.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* insight card */}
          <div className="card" style={{
            flexShrink: 0, minWidth: '190px', maxWidth: '200px',
            background: 'var(--accent-light)', border: '0.5px solid var(--accent-border)',
            animation: 'pageEnter 0.6s 0.44s cubic-bezier(0.22, 1, 0.36, 1) both',
          }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Insight</div>
            <div style={{ fontSize: '13px', color: 'var(--sand-800)', lineHeight: '1.55' }}>Add $180/mo to your car loan and pay it off 14 months early.</div>
          </div>

        </div>
      </section>

      {/* ── TICKER ────────────────────────────────── */}
      <div style={{
        background: 'var(--sand-200)', borderTop: '0.5px solid var(--sand-300)',
        borderBottom: '0.5px solid var(--sand-300)', padding: '13px 0', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', animation: 'tickerScroll 28s linear infinite', width: 'max-content' }}>
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: '12px',
              padding: '0 22px', fontSize: '13px', color: 'var(--sand-600)',
              whiteSpace: 'nowrap', fontWeight: '500',
            }}>
              <span style={{ color: 'var(--accent)', fontSize: '7px', opacity: 0.5 }}>◆</span>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── FEATURES ──────────────────────────────── */}
      <section ref={featRef} style={{ padding: '72px 20px 64px', maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p className="label" style={{ marginBottom: '12px' }}>What you get</p>
          <h2 style={{
            fontSize: 'clamp(26px, 6vw, 34px)', fontWeight: '300',
            letterSpacing: '-0.8px', color: 'var(--sand-700)', margin: '0 0 4px',
          }}>
            Not another dashboard.
          </h2>
          <h2 style={{
            fontSize: 'clamp(26px, 6vw, 34px)', fontWeight: '700',
            letterSpacing: '-0.8px', color: 'var(--sand-900)', margin: 0,
          }}>
            A plan that actually works.
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <div className="card" style={{
            display: 'flex', gap: '18px', alignItems: 'flex-start',
            opacity: featVisible ? 1 : 0, transform: featVisible ? 'none' : 'translateY(16px)',
            transition: 'opacity 0.4s 0.05s cubic-bezier(0.22, 1, 0.36, 1), transform 0.4s 0.05s cubic-bezier(0.22, 1, 0.36, 1)',
          }}>
            <div style={{
              flexShrink: 0, width: '44px', height: '44px', background: 'var(--accent-light)',
              border: '0.5px solid var(--accent-border)', borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><MessageCircle size={20} strokeWidth={1.5} color="var(--accent)" /></div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 6px' }}>Ask anything, get real answers</h3>
              <p style={{ fontSize: '14px', color: 'var(--sand-600)', margin: '0 0 12px', lineHeight: '1.55' }}>
                Your AI advisor knows your actual numbers — income, debts, goals. Ask "Can I afford this?" and get a straight answer.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Based on your data', 'No generic advice', 'Always available'].map(tag => (
                  <span key={tag} style={{
                    fontSize: '11px', fontWeight: '600', color: 'var(--sand-600)',
                    background: 'var(--sand-200)', padding: '3px 10px', borderRadius: '20px',
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{
            display: 'flex', gap: '18px', alignItems: 'flex-start',
            opacity: featVisible ? 1 : 0, transform: featVisible ? 'none' : 'translateY(16px)',
            transition: 'opacity 0.4s 0.15s cubic-bezier(0.22, 1, 0.36, 1), transform 0.4s 0.15s cubic-bezier(0.22, 1, 0.36, 1)',
          }}>
            <div style={{
              flexShrink: 0, width: '44px', height: '44px', background: 'rgba(122,158,110,0.1)',
              border: '0.5px solid rgba(122,158,110,0.2)', borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Target size={20} strokeWidth={1.5} color="var(--accent)" /></div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 6px' }}>Your whole picture, one glance</h3>
              <p style={{ fontSize: '14px', color: 'var(--sand-600)', margin: '0 0 14px', lineHeight: '1.55' }}>
                Net worth, cash flow, goals, and retirement projections — updated in real time. No more spreadsheets.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { label: 'Emergency fund', pct: 68, color: 'var(--accent)' },
                  { label: 'Vacation fund', pct: 43, color: 'var(--success)' },
                ].map(g => (
                  <div key={g.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--sand-600)' }}>{g.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--sand-700)' }}>{g.pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: featVisible ? `${g.pct}%` : '0%', background: g.color, transition: 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{
            display: 'flex', gap: '18px', alignItems: 'flex-start',
            opacity: featVisible ? 1 : 0, transform: featVisible ? 'none' : 'translateY(16px)',
            transition: 'opacity 0.4s 0.25s cubic-bezier(0.22, 1, 0.36, 1), transform 0.4s 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
          }}>
            <div style={{
              flexShrink: 0, width: '44px', height: '44px', background: 'rgba(122,158,110,0.1)',
              border: '0.5px solid rgba(122,158,110,0.2)', borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Zap size={20} strokeWidth={1.5} color="var(--accent)" /></div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 6px' }}>A real debt payoff plan</h3>
              <p style={{ fontSize: '14px', color: 'var(--sand-600)', margin: '0 0 12px', lineHeight: '1.55' }}>
                Avalanche or snowball — the optimizer picks the right strategy for your debts and shows you exactly how much you save.
              </p>
              <div style={{
                background: 'rgba(122,158,110,0.08)', border: '0.5px solid rgba(122,158,110,0.2)',
                borderRadius: '10px', padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <Lightbulb size={18} strokeWidth={1.5} color="var(--accent)" />
                <span style={{ fontSize: '13px', color: 'var(--sand-700)', fontWeight: '500' }}>
                  Save <strong style={{ color: 'var(--sand-900)' }}>$4,820</strong> in interest by switching strategies
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── STATS ─────────────────────────────────── */}
      <section ref={statsRef} style={{
        background: 'var(--sand-200)', borderTop: '0.5px solid var(--sand-300)',
        borderBottom: '0.5px solid var(--sand-300)',
        padding: '64px 24px', textAlign: 'center',
      }}>
        <p className="label" style={{ marginBottom: '40px' }}>Real clarity, real numbers</p>
        <div style={{
          display: 'flex', justifyContent: 'space-around',
          gap: '8px', maxWidth: '480px', margin: '0 auto',
        }}>
          {[
            { label: 'Net worth tracked', value: `$${(nw / 1000).toFixed(0)}k` },
            { label: 'Saved last month', value: saved >= 1000 ? `$${(saved / 1000).toFixed(1)}k` : `$${saved}` },
            { label: 'Health score', value: `${score}` },
          ].map((s, i) => (
            <div key={s.label} style={{
              textAlign: 'center',
              opacity: statsVisible ? 1 : 0,
              transform: statsVisible ? 'none' : 'translateY(12px)',
              transition: `opacity 0.5s ${i * 0.1}s cubic-bezier(0.22, 1, 0.36, 1), transform 0.5s ${i * 0.1}s cubic-bezier(0.22, 1, 0.36, 1)`,
            }}>
              <div style={{
                fontSize: 'clamp(28px, 7vw, 36px)', fontWeight: '700',
                color: 'var(--accent)', letterSpacing: '-1px',
                lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              }}>{s.value}</div>
              <div style={{
                fontSize: '11px', fontWeight: '600', color: 'var(--sand-500)',
                marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────── */}
      <section ref={stepsRef} style={{ padding: '72px 20px 64px', maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <p className="label" style={{ marginBottom: '12px' }}>How it works</p>
          <h2 style={{ fontSize: '28px', fontWeight: '600', letterSpacing: '-0.6px', color: 'var(--sand-900)', margin: 0 }}>
            Up and running in minutes.
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {[
            { n: '01', title: 'Enter your numbers', body: 'Income, assets, debts, goals. Takes about 3 minutes and no account linking required.' },
            { n: '02', title: 'We build your picture', body: 'Instant health score, cash flow analysis, and insights specific to your situation.' },
            { n: '03', title: 'Follow a clear plan', body: 'Next actions, debt payoff strategy, retirement projections — all in plain language.' },
          ].map((step, i) => (
            <div key={step.n} style={{
              display: 'flex', gap: '20px',
              paddingBottom: i < 2 ? '28px' : 0,
              position: 'relative',
              opacity: stepsVisible ? 1 : 0,
              transform: stepsVisible ? 'none' : 'translateY(12px)',
              transition: `opacity 0.45s ${i * 0.12}s cubic-bezier(0.22, 1, 0.36, 1), transform 0.45s ${i * 0.12}s cubic-bezier(0.22, 1, 0.36, 1)`,
            }}>
              {i < 2 && (
                <div style={{
                  position: 'absolute', left: '19px', top: '40px',
                  width: '2px', height: 'calc(100% - 12px)',
                  background: 'var(--sand-300)',
                }} />
              )}
              <div style={{
                flexShrink: 0, width: '40px', height: '40px',
                background: 'var(--accent)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
              }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--sand-50)', fontVariantNumeric: 'tabular-nums' }}>{step.n}</span>
              </div>
              <div style={{ paddingTop: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--sand-900)', margin: '0 0 4px' }}>{step.title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--sand-600)', margin: 0, lineHeight: '1.55' }}>{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────── */}
      <section style={{
        background: 'var(--accent)', padding: '72px 24px 80px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        {/* subtle warm highlight */}
        <div style={{
          position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
          width: '500px', height: '300px',
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontSize: 'clamp(28px, 7vw, 38px)', fontWeight: '300',
            color: 'rgba(255,255,255,0.6)', margin: '0 0 2px',
            letterSpacing: '-1px', lineHeight: 1.1,
          }}>Know where you stand.</h2>
          <h2 style={{
            fontSize: 'clamp(28px, 7vw, 38px)', fontWeight: '700',
            color: 'var(--sand-50)', margin: '0 0 14px',
            letterSpacing: '-1px', lineHeight: 1.1,
          }}>Start today.</h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', margin: '0 0 36px' }}>Free to use. No credit card. No ads.</p>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'var(--sand-50)', color: 'var(--accent)',
              border: 'none', borderRadius: '12px',
              padding: '15px 36px', fontSize: '15px',
              fontWeight: '700', cursor: 'pointer',
              fontFamily: 'inherit', letterSpacing: '-0.2px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              transition: 'opacity var(--transition), transform var(--spring-fast)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.92' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
          >
            Create your account →
          </button>
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '13px', color: 'rgba(255,255,255,0.35)',
              }}
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────── */}
      <footer style={{
        background: 'var(--sand-200)', borderTop: '0.5px solid var(--sand-300)',
        padding: '20px 24px', textAlign: 'center',
      }}>
        <p style={{ fontSize: '11px', color: 'var(--sand-500)', margin: 0 }}>Your financial data is encrypted and never shared with third parties.</p>
      </footer>

    </div>
  )
}
