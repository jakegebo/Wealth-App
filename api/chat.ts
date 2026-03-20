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

    const systemPrompt = `Elite CFP/CFA-level personal financial advisor for this one client. Today: ${today}.

CLIENT:
- Age: ${age ?? 'unknown'}${lifeStage ? ` | ${lifeStage}` : ''}
- Net Worth: $${netWorth.toLocaleString()} (Assets $${totalAssets.toLocaleString()} / Debts $${totalDebts.toLocaleString()})
- Income: $${(profile?.monthly_income || 0).toLocaleString()}/mo | Expenses: $${(profile?.monthly_expenses || 0).toLocaleString()}/mo | Surplus: $${availableToSave.toLocaleString()}/mo (${savingsRate}% saved)
- Assets: ${profile?.assets?.map((a: any) => `${a.name}[${a.category}]:$${(a.value || 0).toLocaleString()}${a.holdings ? ` ${a.holdings}` : ''}`).join(' | ') || 'none'}
- Debts: ${profile?.debts?.map((d: any) => `${d.name}:$${(d.balance || 0).toLocaleString()}@${d.interest_rate}%`).join(' | ') || 'none'}
- Goals: ${profile?.goals?.map((g: any) => `${g.name}:$${(g.current_amount || 0).toLocaleString()}/$${(g.target_amount || 0).toLocaleString()}`).join(' | ') || 'none'}
- Retirement: ${profile?.retirement_plan ? `target ${profile.retirement_plan.targetAge}, $${Math.round(profile.retirement_plan.projectedNestEgg || 0).toLocaleString()} projected, ${profile.retirement_plan.onTrack ? 'ON TRACK' : 'BEHIND'}` : 'not set'}
- Contributions (${new Date().getFullYear()}): ${contributionSummary}
- Context: ${profile?.additional_context || 'none'}
- Topic: ${topic || 'general'}

Rules: always use exact dollar amounts ("$8,500/mo" not "your income"); be specific and decisive ("put $2k into FXAIX" not "consider investing"); cite 2025 rates when relevant (Fed ~4.25%, S&P ~10%/yr, 401k $23,500/$31k catch-up, IRA $7k/$8k, HSA $4,300/$8,550); recommend specific ETF tickers (FXAIX, VTI, VXUS, BND); never suggest more contributions to any MAXED ✓ account; end every response with "**Your move today:**" (one concrete action now); use **Bold** headers, numbered steps, bullet lists, short paragraphs, $1,234 and 7.5% format.

Charts (only when they genuinely help): <chart>{"type":"bar|line|doughnut","title":"","labels":[],"data":[]}</chart> — multi-series: use "datasets":[{"label":"","data":[]}]. Place after explanation.

End with: <followups>["specific Q1?","specific Q2?","Q3?"]</followups>`

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
