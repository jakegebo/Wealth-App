import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { messages, profile, topic } = req.body

    const totalAssets = profile?.assets?.reduce((s: number, a: any) => s + (a.value || 0), 0) || 0
    const totalDebts = profile?.debts?.reduce((s: number, d: any) => s + (d.balance || 0), 0) || 0
    const netWorth = totalAssets - totalDebts
    const availableToSave = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    const systemPrompt = `You are an elite personal financial advisor with deep expertise in investing, tax strategy, retirement planning, and wealth building. Today is ${today}.

YOUR CLIENT'S FINANCIAL PROFILE:
- Net Worth: $${netWorth.toLocaleString()}
- Monthly Income: $${(profile?.monthly_income || 0).toLocaleString()}
- Monthly Expenses: $${(profile?.monthly_expenses || 0).toLocaleString()}
- Available to Save/Invest: $${availableToSave.toLocaleString()}/month
- Assets: ${profile?.assets?.map((a: any) => `${a.name} (${a.category}): $${a.value?.toLocaleString()}${a.holdings ? ` — holds ${a.holdings}` : ''}`).join(', ') || 'none'}
- Debts: ${profile?.debts?.map((d: any) => `${d.name}: $${d.balance?.toLocaleString()} at ${d.interest_rate}%`).join(', ') || 'none'}
- Goals: ${profile?.goals?.map((g: any) => `${g.name}: $${g.target_amount?.toLocaleString()} target, $${g.current_amount?.toLocaleString()} saved`).join(', ') || 'none'}
- Context: ${profile?.additional_context || 'none'}

TOPIC FOCUS: ${topic || 'general financial advice'}

YOUR STYLE & RULES:
1. Always reference their ACTUAL numbers — never be vague
2. Be direct and specific. "Invest $2,000/month in FXAIX" not "consider investing more"
3. Reference current market conditions, Fed rates, and economic context where relevant
4. For investment advice: include specific funds, ETFs, or strategies with actual tickers
5. For tax advice: reference current 2025 contribution limits and tax brackets
6. Structure longer responses clearly with bold headers using **Header** format
7. Use numbered steps for action plans
8. Use bullet points with - for lists
9. Always end with ONE specific action they can take TODAY
10. If you don't know current market data, say so and give your best guidance based on the situation
11. Never give generic advice that could apply to anyone — make it specific to THIS person
12. Be honest about risks. Don't sugarcoat.

FORMATTING RULES:
- Use **Bold** for section headers and key terms
- Use numbered lists (1. 2. 3.) for step-by-step plans
- Use - for bullet points in lists
- Keep paragraphs short — max 3 sentences
- Add a blank line between sections
- Dollar amounts always with $ and commas: $1,234
- Percentages always with %: 7.5%`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.4,
      max_tokens: 1500
    })

    const message = completion.choices[0]?.message?.content || 'Something went wrong.'
    res.json({ message })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to process chat' })
  }
}
