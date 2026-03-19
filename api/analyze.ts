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
    if (a.category !== 'retirement' || !a.yearlyContributions?.length) continue
    const thisYear = a.yearlyContributions.find((c: any) => c.year === year)
    if (!thisYear) continue
    const det = detectLimit(a.name, age)
    if (!det) continue
    const contributed = thisYear.amount || 0
    const pct = Math.min(100, Math.round((contributed / det.limit) * 100))
    const maxed = contributed >= det.limit
    const remaining = Math.max(0, det.limit - contributed)
    items.push(`${a.name} (${det.accountType}): $${contributed.toLocaleString()} of $${det.limit.toLocaleString()} — ${pct}%${maxed ? ' MAXED ✓' : ` ($${remaining.toLocaleString()} remaining)`}`)
  }
  return items.length ? items.join('; ') : 'none recorded'
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const profile = req.body

    const totalAssets = profile.assets?.reduce((sum: number, a: any) => sum + (a.value || 0), 0) ?? 0
    const totalLiabilities = profile.debts?.reduce((sum: number, d: any) => sum + (d.balance || 0), 0) ?? 0
    const netWorth = totalAssets - totalLiabilities
    const totalDebtPayments = profile.debts?.reduce((sum: number, d: any) => sum + (d.minimum_payment || 0), 0) ?? 0
    const availableToSave = (profile.monthly_income || 0) - (profile.monthly_expenses || 0) - totalDebtPayments
    const savingsRate = profile.monthly_income > 0 ? (availableToSave / profile.monthly_income) * 100 : 0
    const existingAssets = profile.assets?.map((a: any) => `${a.name} (${a.category}${a.holdings ? `, holds: ${a.holdings}` : ''})`).join(', ') || 'none'
    const contributionSummary = buildContributionSummary(profile.assets, profile.age)

    const systemPrompt = `You are a personal financial coach. Analyze this person's finances and return ONLY a valid JSON object with no markdown, no code blocks, no extra text.

Return exactly this structure:
{
  "netWorth": number,
  "totalAssets": number,
  "totalLiabilities": number,
  "monthlyIncome": number,
  "monthlyExpenses": number,
  "availableToSave": number,
  "savingsRate": number,
  "budgetHealth": "healthy" | "tight" | "over_budget",
  "overallSummary": "2-3 warm personal sentences",
  "nextActions": [{"priority": 1, "title": "string", "description": "string", "impact": "high", "timeframe": "string"}],
  "goals": [{"name": "string", "targetAmount": 0, "currentAmount": 0, "percentage": 0, "monthlyNeeded": 0, "feasibility": "achievable"}],
  "debts": [{"name": "string", "balance": 0, "interestRate": 0, "recommendedPayment": 0, "monthsToPayoff": 0, "strategy": "string"}],
  "incomeIdeas": ["idea1", "idea2", "idea3", "idea4", "idea5"]
}

Use these exact numbers:
totalAssets: ${totalAssets}
totalLiabilities: ${totalLiabilities}
netWorth: ${netWorth}
monthlyIncome: ${profile.monthly_income}
monthlyExpenses: ${profile.monthly_expenses}
availableToSave: ${availableToSave}
savingsRate: ${savingsRate.toFixed(1)}

User already has these assets: ${existingAssets}
NEVER suggest opening accounts they already have.
Reference their actual account names and holdings when giving advice.
Give 5-7 prioritized next actions.
Income ideas must be specific to their situation and skills.

CRITICAL — Retirement account contribution status for ${new Date().getFullYear()}:
${contributionSummary}
If an account shows MAXED ✓, do NOT suggest contributing more to it — redirect that money elsewhere.
If ALL tracked retirement accounts are maxed, explicitly celebrate this in overallSummary and focus next actions on taxable investing, paying down debt, or other goals instead.`

    const userMsg = `Monthly Income: $${profile.monthly_income}
Monthly Expenses: $${profile.monthly_expenses}
Assets: ${profile.assets?.map((a: any) => `${a.name} (${a.category}): $${a.value}${a.holdings ? ` — holds ${a.holdings}` : ''}`).join(', ') || 'none'}
Debts: ${profile.debts?.map((d: any) => `${d.name}: $${d.balance} at ${d.interest_rate}%`).join(', ') || 'none'}
Goals: ${profile.goals?.map((g: any) => `${g.name}: target $${g.target_amount}, saved $${g.current_amount}`).join(', ') || 'none'}
Retirement contributions (${new Date().getFullYear()}): ${contributionSummary}
Context: ${profile.additional_context || 'none'}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }]
    })

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    const analysis = JSON.parse(raw)
    res.json(analysis)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to analyze finances' })
  }
}
