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

    const systemPrompt = `You are a personal financial coach. Analyze the user's finances and return ONLY a JSON object with no markdown or extra text.

Return this exact structure:
{
  "netWorth": number,
  "totalAssets": number,
  "totalLiabilities": number,
  "monthlyIncome": number,
  "monthlyExpenses": number,
  "availableToSave": number,
  "savingsRate": number,
  "budgetHealth": "healthy" | "tight" | "over_budget",
  "overallSummary": "2-3 warm personal sentences about their situation and the most important thing they can do",
  "nextActions": [
    {
      "priority": number,
      "title": "string",
      "description": "specific actionable advice personalized to this person",
      "impact": "high" | "medium" | "low",
      "timeframe": "string"
    }
  ],
  "goals": [
    {
      "name": "string",
      "targetAmount": number,
      "currentAmount": number,
      "percentage": number,
      "monthlyNeeded": number,
      "feasibility": "achievable" | "stretch" | "challenging"
    }
  ],
  "debts": [
    {
      "name": "string",
      "balance": number,
      "interestRate": number,
      "recommendedPayment": number,
      "monthsToPayoff": number,
      "strategy": "string"
    }
  ],
  "incomeIdeas": ["5 specific income ideas tailored to this person's situation"]
}

Pre-computed values — use these exact numbers:
- totalAssets: ${totalAssets}
- totalLiabilities: ${totalLiabilities}
- netWorth: ${netWorth}
- monthlyIncome: ${profile.monthly_income}
- monthlyExpenses: ${profile.monthly_expenses}
- availableToSave: ${availableToSave}
- savingsRate: ${savingsRate.toFixed(1)}

CRITICAL RULES:
- User already has these assets: ${existingAssets}
- NEVER suggest opening accounts they already have
- Reference their actual account names
- Income ideas must be specific to their situation
- Provide 5-7 prioritized nex
