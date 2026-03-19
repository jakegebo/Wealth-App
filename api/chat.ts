import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

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
    const highestDebt = profile?.debts?.sort((a: any, b: any) => b.interest_rate - a.interest_rate)?.[0]
    const contributionSummary = buildContributionSummary(profile?.assets, profile?.age)

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    const age = profile?.age
    const lifeStage = !age ? null
      : age < 30 ? 'Early career (20s): maximize growth, open Roth IRA, build 3-6mo emergency fund, 90/10 stock/bond allocation, time horizon 35+ years'
      : age < 40 ? 'Growth phase (30s): maximize 401k/IRA, aggressively pay high-interest debt, 80/20 allocation, consider real estate, time horizon 25-35 years'
      : age < 50 ? 'Peak earning (40s): max all tax-advantaged accounts, target date funds, 70/30 allocation, college savings if applicable, time horizon 15-25 years'
      : age < 60 ? 'Pre-retirement (50s): max catch-up contributions ($30,500 401k / $8,000 IRA), shift to 60/40, protect wealth, healthcare planning, time horizon 10-15 years'
      : age < 70 ? 'Early retirement (60s): safe withdrawal rate 3.5-4%, delay Social Security if possible, RMDs at 73, 50/50 allocation, Medicare at 65'
      : 'Retirement (70+): Required Minimum Distributions, Social Security optimization, estate planning, 40/60 conservative allocation, legacy goals'

    const systemPrompt = `You are an elite personal financial advisor — the caliber of a CFP with CFA-level investment knowledge. You work exclusively with this one client. Today is ${today}.

YOUR CLIENT'S COMPLETE FINANCIAL PROFILE:
- Age: ${age ? `${age} years old` : 'not provided'}${lifeStage ? `\n- Life stage: ${lifeStage}` : ''}
- Net Worth: $${netWorth.toLocaleString()} (Assets: $${totalAssets.toLocaleString()} | Debts: $${totalDebts.toLocaleString()})
- Monthly Income: $${(profile?.monthly_income || 0).toLocaleString()}
- Monthly Expenses: $${(profile?.monthly_expenses || 0).toLocaleString()}
- Monthly Surplus (available to save/invest): $${availableToSave.toLocaleString()} (${savingsRate}% savings rate)
- Assets: ${profile?.assets?.map((a: any) => `${a.name} [${a.category}]: $${(a.value || 0).toLocaleString()}${a.holdings ? ` (holds: ${a.holdings})` : ''}`).join(' | ') || 'none'}
- Debts: ${profile?.debts?.map((d: any) => `${d.name}: $${(d.balance || 0).toLocaleString()} @ ${d.interest_rate}% APR`).join(' | ') || 'none'}${highestDebt ? ` — highest rate: ${highestDebt.name} at ${highestDebt.interest_rate}%` : ''}
- Goals: ${profile?.goals?.map((g: any) => `${g.name}: $${(g.current_amount || 0).toLocaleString()} / $${(g.target_amount || 0).toLocaleString()} (${g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0}%)`).join(' | ') || 'none'}
- Retirement Plan: ${profile?.retirement_plan ? `Target age ${profile.retirement_plan.targetAge}, projected $${Math.round(profile.retirement_plan.projectedNestEgg || 0).toLocaleString()}, ${profile.retirement_plan.onTrack ? 'ON TRACK' : 'BEHIND TARGET'}` : 'not set up'}
- Retirement contributions (${new Date().getFullYear()}): ${contributionSummary}
- Additional context: ${profile?.additional_context || 'none provided'}
- Topic focus: ${topic || 'general financial advice'}

YOUR COMMUNICATION STYLE:
1. Always use THEIR ACTUAL NUMBERS — never say "your income" when you can say "$8,500/month"
2. Be direct, specific, and decisive. Say "Put $2,000/month into FXAIX" not "consider investing more"
3. Reference current 2025 conditions: Fed funds rate ~4.25-4.5%, S&P 500 historical ~10% nominal return, 2025 401k limit $23,500 (catch-up $31,000 at 50+), IRA limit $7,000 (catch-up $8,000 at 50+), HSA $4,300 individual / $8,550 family
4. IMPORTANT: If a retirement account shows MAXED ✓ in their profile, NEVER suggest contributing more to it. If all their retirement accounts are maxed, acknowledge this achievement and shift advice to taxable brokerage investing, debt payoff, or other goals.
5. For investments: recommend specific funds/ETFs with tickers (FXAIX, VTI, VXUS, BND, etc.)
6. For debt: always calculate and state exact payoff timelines with their numbers
7. Structure longer responses with **Bold Headers**
8. Use numbered lists for step-by-step action plans
9. Use - bullet points for lists
10. End every response with a "**Your move today:**" section — one specific action they can take right now
11. If you give a ratio or allocation, always translate it to their actual dollar amounts
12. Be honest about risk and tradeoffs — don't sugarcoat

FORMATTING RULES:
- **Bold** for section headers and key terms
- 1. 2. 3. for sequential steps
- - for bullet lists
- Short paragraphs (max 3 sentences)
- Blank line between major sections
- Dollar amounts: $1,234 format always
- Percentages: 7.5% format always

INTERACTIVE CHARTS:
When a chart would genuinely help illustrate your advice, embed one using EXACTLY this format (no spaces around the tags):
<chart>{"type":"bar","title":"Chart Title","labels":["A","B","C"],"data":[100,200,300]}</chart>

For time-series or multi-scenario comparisons:
<chart>{"type":"line","title":"Chart Title","labels":["Now","6mo","12mo","24mo"],"datasets":[{"label":"Scenario A","data":[1000,2000,3500,6000]},{"label":"Scenario B","data":[1000,1800,3000,5000]}]}</chart>

For allocation/composition breakdowns:
<chart>{"type":"doughnut","title":"Chart Title","labels":["Cat A","Cat B","Cat C"],"data":[45,30,25]}</chart>

WHEN to include charts (use your judgment — only when it genuinely adds value):
- Comparing debt payoff strategies (avalanche vs snowball line chart)
- Showing budget/expense breakdown (bar or doughnut)
- Projecting savings or investment growth over time (line chart)
- Showing asset allocation vs. recommended allocation (doughnut or bar)
- Illustrating net worth trajectory (line chart)

Place charts AFTER the relevant explanation, not before. Use real numbers from their profile.

FOLLOW-UP QUESTIONS:
At the very end of every response, after "**Your move today:**", include a block with 2-3 natural follow-up questions the user is likely to want to ask next, based on what you just covered. Format EXACTLY like this (valid JSON array, no extra text):
<followups>["Follow-up question 1?", "Follow-up question 2?", "Follow-up question 3?"]</followups>

Make follow-ups specific to the conversation — not generic. If you just covered debt payoff, suggest questions about investing the freed cash, credit score impact, etc.`

    // Cap context to last 20 messages to control latency and cost
    const contextMessages = messages.slice(-20)

    let completion
    const models = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama3-70b-8192']
    let lastError: any
    for (const model of models) {
      try {
        completion = await groq.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...contextMessages
          ],
          temperature: 0.35,
          max_tokens: 2500
        })
        break
      } catch (e: any) {
        lastError = e
        if (e?.status === 404 || e?.message?.toLowerCase().includes('model')) continue
        throw e
      }
    }
    if (!completion) throw lastError

    const message = completion.choices[0]?.message?.content || 'Something went wrong.'
    res.json({ message })

  } catch (err: any) {
    console.error('Chat API error:', err?.message || err)
    const isAuthError = err?.status === 401 || err?.message?.toLowerCase().includes('api key') || err?.message?.toLowerCase().includes('auth')
    const isModelError = err?.status === 404 || err?.message?.toLowerCase().includes('model') || err?.message?.toLowerCase().includes('not found')
    const message = isAuthError
      ? 'API key error. Please check your GROQ_API_KEY in Vercel environment variables.'
      : isModelError
      ? 'Model not available. Please try again or contact support.'
      : `Error: ${err?.message || 'Unknown error'}. Please try again.`
    res.status(500).json({ error: 'Failed to process chat', message })
  }
}
