import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

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
    const existingAssets = profile.assets?.map((a: any) => `${a.name} (${a.category})`).join(', ') || 'none'

    const prompt = `You are a personal financial coach. Analyze this person's finances and return ONLY a valid JSON object with no markdown, no code blocks, no extra text.

Return exactly this structure:
{
  "netWorth": number,
  "totalAssets": number,
  "totalLiabilities": number,
  "monthlyIncome": number,
  "monthlyExpenses": number,
  "availableToSave": number,
  "savingsRate": number,
  "budgetHealth": "healthy",
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

User already has: ${existingAssets}
NEVER suggest opening accounts they already have.
Give 5-7 prioritized next actions.
Income ideas must be specific to their situation.`

    const userMsg = `Monthly Income: $${profile.monthly_income}
Monthly Expenses: $${profile.monthly_expenses}
Assets: ${profile.assets?.map((a: any) => `${a.name} (${a.category}): $${a.value}`).join(', ') || 'none'}
Debts: ${profile.debts?.map((d: any) => `${d.name}: $${d.balance} at ${d.interest_rate}%`).join(', ') || 'none'}
Goals: ${profile.goals?.map((g: any) => `${g.name}: target $${g.target_amount}, saved $${g.current_amount}`).join(', ') || 'none'}
Context: ${profile.additional_context || 'none'}`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userMsg }
      ],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const analysis = JSON.parse(raw)
    res.json(analysis)

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to analyze finances' })
  }
}
