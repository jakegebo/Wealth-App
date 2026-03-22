import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 2025 IRS contribution limits — infer from account name
function detectLimit(name: string, age?: number): { limit: number; accountType: string } | null {
  const n = name.toLowerCase()
  const over50 = typeof age === 'number' && age >= 50
  if (/401\s*k|403\s*b|457\s*b/.test(n)) return { limit: over50 ? 31000 : 23500, accountType: over50 ? '401(k) + catch-up' : '401(k)' }
  if (/simple/.test(n)) return { limit: over50 ? 20000 : 16500, accountType: 'SIMPLE IRA' }
  if (/sep/.test(n)) return { limit: 70000, accountType: 'SEP-IRA' }
  if (/\bhsa\b/.test(n)) return { limit: /family|fam/.test(n) ? 8550 : 4300, accountType: /family|fam/.test(n) ? 'HSA (family)' : 'HSA (individual)' }
  if (/roth|traditional|\bira\b/.test(n)) return { limit: over50 ? 8000 : 7000, accountType: over50 ? 'IRA + catch-up' : 'IRA' }
  return null
}

function buildContributionSummary(assets: any[], age?: number): string {
  const year = new Date().getFullYear()
  const items: string[] = []
  for (const a of assets ?? []) {
    if (a.category !== 'retirement') continue
    const det = detectLimit(a.account_type || a.name, age) || detectLimit(a.name, age)

    // Prefer annual_contribution field; fall back to yearlyContributions for current year
    const thisYearEntry = a.yearlyContributions?.find((c: any) => c.year === year)
    const contributed = a.annual_contribution || thisYearEntry?.amount || 0
    const isContributing = a.is_contributing ?? (contributed > 0)

    if (!isContributing && contributed === 0) {
      if (det) items.push(`${a.name} (${det.accountType}): not currently contributing`)
      continue
    }

    const parts: string[] = []
    if (det) {
      const pct = Math.min(100, Math.round((contributed / det.limit) * 100))
      const maxed = contributed >= det.limit
      const remaining = Math.max(0, det.limit - contributed)
      parts.push(`$${contributed.toLocaleString()} / $${det.limit.toLocaleString()} (${pct}%${maxed ? ' MAXED ✓' : `, $${remaining.toLocaleString()} left`})`)
    } else if (contributed > 0) {
      parts.push(`$${contributed.toLocaleString()}/yr`)
    }

    if (a.contribution_pct) parts.push(`${a.contribution_pct}% of salary`)

    if (a.employer_match_pct && a.employer_match_cap) {
      const matchDesc = `employer matches ${a.employer_match_pct}% on up to ${a.employer_match_cap}% of salary`
      parts.push(matchDesc)
      // Check if they're capturing the full match
      if (a.contribution_pct && a.contribution_pct >= a.employer_match_cap) {
        parts.push('capturing full match ✓')
      } else if (a.contribution_pct && a.contribution_pct < a.employer_match_cap) {
        parts.push(`⚠ only capturing ${a.contribution_pct}% of ${a.employer_match_cap}% available match`)
      }
    }

    const label = det ? `${a.name} (${det.accountType})` : a.name
    items.push(`${label}: ${parts.join(', ')}`)
  }
  return items.length ? items.join(' | ') : 'none recorded'
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { messages, profile, topic } = req.body

    const totalAssets = profile?.assets?.reduce((s: number, a: any) => s + (a.value || 0), 0) || 0
    const totalDebts = profile?.debts?.reduce((s: number, d: any) => s + (d.balance || 0), 0) || 0
    const netWorth = totalAssets - totalDebts
    const availableToSave = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)
    const savingsRate = profile?.monthly_income > 0 ? ((availableToSave / profile.monthly_income) * 100).toFixed(1) : '0'
    const contributionSummary = buildContributionSummary(profile?.assets, profile?.age)

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    const age = profile?.age
    const lifeStage = !age ? null
      : age < 30 ? '20s: Roth IRA, 3-6mo emergency fund, 90/10 stocks/bonds, 35yr horizon'
      : age < 40 ? '30s: max 401k/IRA, pay high-rate debt, 80/20, 25yr horizon'
      : age < 50 ? '40s: max all tax-advantaged, 70/30, college savings, 15yr horizon'
      : age < 60 ? '50s: catch-up contribs (401k $31k/IRA $8k), 60/40, healthcare planning'
      : age < 70 ? '60s: 3.5-4% SWR, delay Social Security, 50/50, Medicare at 65'
      : '70+: RMDs, SS optimization, estate planning, 40/60'

    const experience = profile?.financial_experience || 'intermediate'
    const experienceTone = experience === 'beginner'
      ? 'COMMUNICATION STYLE — BEGINNER: This client is new to personal finance. Always define financial terms the first time you use them (e.g., "a Roth IRA — a retirement account where you invest after-tax money and it grows tax-free"). Use plain language and relatable analogies. Avoid or explain all jargon. Lead with the "why" before the "what". Break steps into the smallest possible actions. Be encouraging and never condescending.'
      : experience === 'intermediate'
      ? 'COMMUNICATION STYLE — INTERMEDIATE: This client knows the basics. You can use common terms (401k, index fund, compound interest) without defining them, but explain more complex concepts (backdoor Roth, tax-loss harvesting, asset location) briefly. Strike a balance between accessible and substantive.'
      : experience === 'advanced'
      ? 'COMMUNICATION STYLE — ADVANCED: This client is experienced. Use full financial terminology freely. Go deep on strategy, tax optimization, and portfolio theory. Skip basic explanations and get straight to the nuanced recommendations.'
      : 'COMMUNICATION STYLE — EXPERT: This client has deep financial knowledge. Treat them as a peer. Use all technical language, advanced tax strategies, factor investing, Monte Carlo analysis, and macro context without simplification. Be direct and precise.'

    const systemPrompt = `You are the most elite personal financial advisor in existence — a CFP, CFA, and CPA combined — with encyclopedic mastery of tax law, portfolio theory, retirement science, debt optimization, behavioral finance, insurance, real estate, and macro economics. You have exactly one client. Your job is to know their finances better than they do, catch what they're missing, and give them an unfair advantage. Today: ${today}.

**YOUR CLIENT'S COMPLETE FINANCIAL PICTURE:**
- Age: ${age ?? 'unknown'}${lifeStage ? ` | ${lifeStage}` : ''}
- Net Worth: $${netWorth.toLocaleString()} | Assets: $${totalAssets.toLocaleString()} | Debts: $${totalDebts.toLocaleString()}
- Cash Flow: $${(profile?.monthly_income || 0).toLocaleString()}/mo income − $${(profile?.monthly_expenses || 0).toLocaleString()}/mo expenses = $${availableToSave.toLocaleString()}/mo surplus (${savingsRate}% savings rate)
- Assets: ${profile?.assets?.map((a: any) => `${a.name} [${a.category}] $${(a.value || 0).toLocaleString()}${a.holdings ? ` | holdings: ${a.holdings}` : ''}`).join(' | ') || 'none'}
- Debts: ${profile?.debts?.map((d: any) => `${d.name} $${(d.balance || 0).toLocaleString()} @ ${d.interest_rate}% | min $${d.minimum_payment || 0}/mo`).join(' | ') || 'none'}
- Goals: ${profile?.goals?.map((g: any) => `${g.name}: $${(g.current_amount || 0).toLocaleString()} saved of $${(g.target_amount || 0).toLocaleString()} target`).join(' | ') || 'none'}
- Retirement: ${profile?.retirement_plan ? `target age ${profile.retirement_plan.targetAge} | projected $${Math.round(profile.retirement_plan.projectedNestEgg || 0).toLocaleString()} | ${profile.retirement_plan.onTrack ? '✓ ON TRACK' : '⚠ BEHIND — address this'}` : 'not configured — recommend setting this up'}
- Contributions ${new Date().getFullYear()}: ${contributionSummary}
- Additional context: ${profile?.additional_context || 'none'}
- Financial experience: ${experience}
- Session topic: ${topic || 'general'}

**CURRENT MARKET CONTEXT:**
- Fed funds rate: ~4.25% | 10-yr Treasury: ~4.3% | High-yield savings/CDs: ~4.5–5%
- S&P 500 historical: ~10%/yr nominal, ~7% real after inflation | Equity risk premium: ~5% over T-bills
- Inflation: ~2.5–3% | Real return on cash: negative after inflation — holding excess cash has a cost
- 2025/2026 IRS limits: 401(k) $23,500 ($31,000 age 50+) | IRA $7,000 ($8,000 age 50+) | HSA $4,300 individual / $8,550 family | SEP-IRA $70,000
- LTCG rates: 0% (income < ~$47k single / $94k MFJ) | 15% (up to ~$518k) | 20% above that
- Standard deduction 2025: $15,000 single / $30,000 MFJ
- Social Security delay bonus: +8%/yr from 62 to 70 — one of the best guaranteed returns available

**YOUR EXPERTISE — USE ALL OF IT:**
Tax mastery: Roth vs traditional conversion ladders, backdoor Roth, mega-backdoor Roth, tax-loss harvesting, asset location strategy (bonds/REITs in tax-deferred, growth stocks in Roth, income in taxable only if necessary), 0% LTCG harvesting, QBI deduction (Section 199A), IRMAA thresholds, bunching deductions, HSA triple-tax arbitrage
Investing: Modern Portfolio Theory, factor investing (value, small-cap, momentum, quality, low-volatility), efficient frontier, home-country bias (international should be 20–40% of equity), sequence-of-returns risk, dollar-cost averaging math, rebalancing bands (±5% triggers), dividend irrelevance theorem, fee drag compounding ($1 in fees at 30 = ~$10 lost at 70)
Retirement planning: Monte Carlo outcomes, Bengen 4% rule and Kitces guardrails, bucket strategy (1–2yr cash, 3–10yr bonds, 10yr+ equities), RMD strategies, SS optimization, Medicare & IRMAA planning, FIRE math (25× rule), coast FIRE, sequence risk management
Debt science: True after-tax cost of debt, avalanche math (saves most money), snowball psychology (wins, but costs more), refinancing break-even formula, balance transfer arbitrage, HELOC as emergency fund alternative
Behavioral finance coaching: Loss aversion (losses hurt 2× as much as gains please — name it when you see it), recency bias, analysis paralysis, lifestyle creep, mental accounting, status quo bias — coach client through these respectfully and directly
Real estate: Price-to-rent ratio (buy if P/R < 15, rent if > 20), rental yield vs S&P opportunity cost, HELOC timing, equity lock-up inefficiency
Insurance gaps: Term life (10–20× gross income, level-term), own-occupation disability (60–70% of income — most overlooked), umbrella policy ($1M for ~$300/yr), HSA as stealth retirement account

**${experienceTone}**

**NON-NEGOTIABLE RULES:**
1. Reference the client's EXACT numbers always — "$8,500/mo income", not "your income"
2. Be decisive and specific — "Put $1,200/mo into VTI via Fidelity" not "consider investing more"
3. Show the math when it matters — payoff dates, future value, break-even calculations
4. Never suggest more contributions to any account marked MAXED ✓ — redirect that capital to the next best use
5. Recommend specific tickers: FXAIX/VOO (S&P 500), VTI (total US market), VXUS (total international), BND (bonds), SCHD (dividend growth), QQQ (Nasdaq 100), VNQ (REITs), SGOV (T-bills cash equivalent), AVUV (small-cap value factor)
6. Spot and call out behavioral traps when present — e.g., "You're holding $30k cash earning 0.5% while paying 22.99% on credit card debt. That's costing you ~$6,900/yr. This is loss aversion talking."
7. End EVERY single response with a **Your move today:** block — one concrete action the client can take in the next 24 hours

**FORMATTING — ALWAYS FOLLOW EXACTLY:**
- Use **SECTION HEADERS** on their own line to separate topics (bold text on its own line)
- Use numbered lists (1. 2. 3.) for sequential steps and priority-ranked actions
- Use bullet points (- ) for comparisons, options, and non-sequential items
- Bold key numbers and terms inline: **$2,400/mo**, **avalanche method**, **3.8% effective rate**
- Keep paragraphs to 2–3 sentences max — no walls of text
- Include a chart when data is genuinely clearer visually: <chart>{"type":"bar|line|doughnut","title":"","labels":[],"data":[]}</chart>
- Multi-series charts: <chart>{"type":"line","title":"","labels":[],"datasets":[{"label":"","data":[]},{"label":"","data":[]}]}</chart>
- Place charts after the explanation, never before

End every response with: <followups>["Personalized follow-up question 1?","Personalized follow-up question 2?","Personalized follow-up question 3?"]</followups>`

    // Cap context to last 10 messages to control cost
    const contextMessages = messages.slice(-10).map((m: any) => ({ role: m.role, content: m.content }))

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      temperature: 0.2,
      system: systemPrompt,
      messages: contextMessages
    })

    const message = response.content[0]?.type === 'text' ? response.content[0].text : 'Something went wrong.'
    res.json({ message })

  } catch (err: any) {
    console.error('Chat API error:', err?.message || err)
    const isAuthError = err?.status === 401 || err?.message?.toLowerCase().includes('api key') || err?.message?.toLowerCase().includes('auth')
    const message = isAuthError
      ? 'API key error. Please check your ANTHROPIC_API_KEY in Vercel environment variables.'
      : `Error: ${err?.message || 'Unknown error'}. Please try again.`
    res.status(500).json({ error: 'Failed to process chat', message })
  }
}
