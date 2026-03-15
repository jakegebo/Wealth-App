import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { messages, profile, topic } = req.body

    const profileSummary = profile ? `
USER'S FINANCIAL PROFILE:
- Monthly Income: $${profile.monthly_income}
- Monthly Expenses: $${profile.monthly_expenses}
- Available to save/mo: $${(profile.monthly_income - profile.monthly_expenses).toLocaleString()}
- Assets: ${profile.assets?.map((a: any) => `${a.name} ($${a.value.toLocaleString()})`).join(', ') || 'none'}
- Debts: ${profile.debts?.map((d: any) => `${d.name}: $${d.balance.toLocaleString()} at ${d.interest_rate}%`).join(', ') || 'none'}
- Goals: ${profile.goals?.map((g: any) => `${g.name}: target $${g.target_amount.toLocaleString()}, saved $${g.current_amount.toLocaleString()}`).join(', ') || 'none'}
- Additional context: ${profile.additional_context || 'none'}
` : ''

    const topicContext: Record<string, string> = {
      debt: 'Focus on debt elimination strategies, interest rates, payoff timelines, and balancing debt payoff with investing.',
      retirement: 'Focus on retirement planning, projected retirement age, Roth IRA and 401k strategies, compound growth, and passive income.',
      investment: 'Focus on investment strategies, asset allocation, index funds, risk tolerance, and growing wealth over time.',
      general: 'Cover any financial topic the user asks about.'
    }

    const systemPrompt = `You are a personal financial advisor — honest, clear, and genuinely helpful. You know this person's exact financial situation and give them specific, actionable advice.

${profileSummary}

TOPIC FOCUS: ${topicContext[topic] || topicContext.general}

YOUR COMMUNICATION STYLE:
- Always explain financial terms in plain, simple language — assume the user is not a financial expert
- Be honest and unbiased — give real opinions, not vague "it depends" answers
- Be encouraging but realistic — acknowledge what they're doing well and what needs work
- Format responses clearly using line breaks and short paragraphs
- When giving steps or options, number them clearly
- Keep responses focused and digestible — not overwhelming walls of text
- Always tie advice back to THEIR specific numbers and situation
- Never use jargon without explaining it

FORMATTING RULES:
- Use short paragraphs with line breaks between them
- Number steps when giving a plan (1. 2. 3.)
- Bold key numbers by putting them in caps (e.g. YOUR MONTHLY SURPLUS IS $4,500)
- End responses with one clear next step they can take today

NEVER:
- Give generic advice that ignores their actual situation
- Be vague — always take a clear stance
- Use complicated financial jargon without explaining it
- Give overwhelmingly long responses — be concise and clear`

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
