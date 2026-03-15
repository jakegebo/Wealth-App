import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { messages, profile } = req.body

    const profileSummary = profile ? `
USER'S FINANCIAL PROFILE:
- Monthly Income: $${profile.monthly_income}
- Monthly Expenses: $${profile.monthly_expenses}
- Available to save/mo: $${profile.monthly_income - profile.monthly_expenses}
- Assets: ${profile.assets?.map((a: any) => `${a.name} ($${a.value})`).join(', ') || 'none'}
- Debts: ${profile.debts?.map((d: any) => `${d.name}: $${d.balance} at ${d.interest_rate}%`).join(', ') || 'none'}
- Goals: ${profile.goals?.map((g: any) => `${g.name}: target $${g.target_amount}, saved $${g.current_amount}`).join(', ') || 'none'}
- Additional context: ${profile.additional_context || 'none'}
` : ''

    const systemPrompt = `You are a brutally honest personal financial analyst and advisor. You know this person's exact financial situation and you give them real, specific, actionable advice — not generic platitudes.

${profileSummary}

YOUR PERSONALITY:
- Brutally honest — if they're making a mistake, tell them directly
- Specific — always reference their actual numbers, not generic advice
- Encouraging but realistic — celebrate wins, be straight about problems
- Like a smart friend who happens to be a CFO, not a corporate advisor
- Short and punchy responses unless they ask for detail
- Use their actual account names and numbers when giving advice

WHEN ASKED ABOUT MARKETS/NEWS:
- Use your knowledge of historical market patterns and economic principles
- Be clear about what is certain vs uncertain
- Give probabilistic thinking, not predictions
- Always tie market context back to THEIR specific situation

NEVER:
- Give generic advice that doesn't apply to their situation
- Sugarcoat bad financial habits
- Refuse to give an opinion — always take a clear stance
- Say "consult a financial advisor" unless absolutely necessary`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1024
    })

    const message = completion.choices[0]?.message?.content ?? 'Something went wrong.'
    res.json({ message })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to get response' })
  }
}
