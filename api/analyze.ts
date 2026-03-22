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
    const contributionSummary = buildContributionSummary(profile.assets, profile.age)

    const experience = profile.financial_experience || 'intermediate'
    const experienceInstruction = experience === 'beginner'
      ? 'Write all titles and descriptions in plain, simple language. Define any financial term used. Keep descriptions friendly and encouraging — no jargon.'
      : experience === 'intermediate'
      ? 'Use standard financial language. Briefly clarify complex terms when used.'
      : experience === 'advanced'
      ? 'Use full financial terminology. Be direct and specific — skip basic explanations.'
      : 'Use precise, technical financial language. Treat the user as a knowledgeable peer.'

    const completedItems: any[] = profile.completed_focus_items || []
    const completedSummary = completedItems.length
      ? `\nUser has already completed these focus actions — do NOT suggest them again, and build the next actions on top of this progress: ${completedItems.map((c: any) => `"${c.title}" (completed ${c.completedAt?.slice(0, 10)})`).join('; ')}.`
      : ''

    const systemPrompt = `Return ONLY valid JSON, no markdown. Fields: netWorth, totalAssets, totalLiabilities, monthlyIncome, monthlyExpenses, availableToSave, savingsRate, budgetHealth("healthy"|"tight"|"over_budget"), overallSummary(2-3 sentences), nextActions[{priority,title,description,impact,timeframe}], goals[{name,targetAmount,currentAmount,percentage,monthlyNeeded,feasibility}], debts[{name,balance,interestRate,recommendedPayment,monthsToPayoff,strategy}], incomeIdeas[5 strings].
Use exactly: netWorth=${netWorth} totalAssets=${totalAssets} totalLiabilities=${totalLiabilities} monthlyIncome=${profile.monthly_income || 0} monthlyExpenses=${profile.monthly_expenses || 0} availableToSave=${availableToSave} savingsRate=${savingsRate.toFixed(1)}
5-7 next actions. Income ideas specific to their skills. Do not suggest accounts they already have.${contributionSummary !== 'none recorded' ? `\nRetirement (${new Date().getFullYear()}): ${contributionSummary}. Never suggest more contributions to a MAXED ✓ account; redirect elsewhere.` : ''}${completedSummary}
Language style: ${experienceInstruction}`

    const userMsg = `Income: $${profile.monthly_income || 0}/mo | Expenses: $${profile.monthly_expenses || 0}/mo
Assets: ${profile.assets?.map((a: any) => `${a.name}(${a.category}):$${a.value}${a.holdings ? ` ${a.holdings}` : ''}`).join(', ') || 'none'}
Debts: ${profile.debts?.map((d: any) => `${d.name}:$${d.balance}@${d.interest_rate}%`).join(', ') || 'none'}
Goals: ${profile.goals?.map((g: any) => `${g.name}:target $${g.target_amount} saved $${g.current_amount}`).join(', ') || 'none'}
Context: ${profile.additional_context || 'none'}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }]
    })

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    // Strip markdown code fences the model sometimes wraps around JSON
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const analysis = JSON.parse(cleaned)
    // Ensure all numeric fields are actually numbers, not strings or undefined
    const safeNum = (v: any, fallback = 0) => (typeof v === 'number' && isFinite(v) ? v : parseFloat(v) || fallback)
    analysis.netWorth = safeNum(analysis.netWorth, netWorth)
    analysis.totalAssets = safeNum(analysis.totalAssets, totalAssets)
    analysis.totalLiabilities = safeNum(analysis.totalLiabilities, totalLiabilities)
    analysis.monthlyIncome = safeNum(analysis.monthlyIncome, profile.monthly_income || 0)
    analysis.monthlyExpenses = safeNum(analysis.monthlyExpenses, profile.monthly_expenses || 0)
    analysis.availableToSave = safeNum(analysis.availableToSave, availableToSave)
    analysis.savingsRate = safeNum(analysis.savingsRate, parseFloat(savingsRate.toFixed(1)))
    ;(analysis.goals || []).forEach((g: any) => {
      g.targetAmount = safeNum(g.targetAmount)
      g.currentAmount = safeNum(g.currentAmount)
      g.percentage = safeNum(g.percentage)
      g.monthlyNeeded = safeNum(g.monthlyNeeded)
    })
    ;(analysis.debts || []).forEach((d: any) => {
      d.balance = safeNum(d.balance)
      d.interestRate = safeNum(d.interestRate)
      d.recommendedPayment = safeNum(d.recommendedPayment)
      d.monthsToPayoff = safeNum(d.monthsToPayoff)
    })
    res.json(analysis)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to analyze finances' })
  }
}
