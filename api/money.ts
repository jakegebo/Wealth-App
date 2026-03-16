import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { action, profile, messages, topic } = req.body

    // Generate fresh income ideas
    if (action === 'generate_ideas') {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `Generate 6 specific income ideas for this person. Return ONLY a JSON array, no other text:
["idea1", "idea2", "idea3", "idea4", "idea5", "idea6"]

Person's profile:
- Monthly income: $${profile.monthly_income}
- Monthly expenses: $${profile.monthly_expenses}  
- Available to invest/save: $${(profile.monthly_income - profile.monthly_expenses).toLocaleString()}/mo
- Assets: ${profile.assets?.map((a: any) => `${a.name} ($${a.value})`).join(', ') || 'none'}
- Context: ${profile.additional_context || 'none'}

RULES:
- Be very specific to their situation and income level
- NO generic ideas like "take surveys" or "drive for Uber" 
- Focus on: leveraging their professional skills, investing their surplus, passive income, building assets
- Each idea should be actionable and realistic for their income level
- Mix of: immediate side hustles, medium term opportunities, long term passive income
- Make each idea different from the last batch they may have seen`
        }],
        temperature: 0.9,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      })

      const raw = completion.choices[0]?.message?.content ?? '{"ideas":[]}'
      try {
        const parsed = JSON.parse(raw)
        const ideas = Array.isArray(parsed) ? parsed : parsed.ideas || Object.values(parsed)[0] || []
        return res.json({ ideas })
      } catch {
        return res.json({ ideas: [] })
      }
    }

    // Make Money chat
    if (action === 'chat') {
      const profileSummary = `
PERSON'S FINANCIAL PROFILE:
- Monthly Income: $${profile.monthly_income}
- Monthly Expenses: $${profile.monthly_expenses}
- Available to invest/save: $${(profile.monthly_income - profile.monthly_expenses).toLocaleString()}/mo
- Assets: ${profile.assets?.map((a: any) => `${a.name} ($${a.value})`).join(', ') || 'none'}
- Context: ${profile.additional_context || 'none'}
`
      const topicPrompts: Record<string, string> = {
        surplus: `Focus on the best ways to deploy their monthly surplus of $${(profile.monthly_income - profile.monthly_expenses).toLocaleString()} to build wealth faster.`,
        sidehustle: 'Focus on realistic side hustles that leverage their existing skills and can generate income within 30-90 days.',
        passive: 'Focus on building passive income streams — dividends, real estate, digital products, etc. Be realistic about timelines and capital required.',
        ideas: 'Help them explore and develop specific income ideas. Be a strategic thinking partner.'
      }

      const systemPrompt = `You are a wealth building strategist — direct, creative, and deeply practical. Your only focus is helping people make more money.

${profileSummary}

TOPIC FOCUS: ${topicPrompts[topic] || topicPrompts.ideas}

YOUR STYLE:
- Think like a smart entrepreneur, not a cautious advisor
- Give specific, actionable ideas tailored to their exact situation
- Always reference their actual numbers
- Be direct about what has the highest ROI for their time and money
- Explain HOW to actually execute each idea, not just what to do
- Be realistic about timelines and effort required
- Format responses clearly with line breaks
- Number steps when giving a plan
- End with one specific action they can take TODAY`

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 1024
      })

      return res.json({ message: completion.choices[0]?.message?.content || 'Something went wrong.' })
    }

    return res.status(400).json({ error: 'Invalid action' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to process request' })
  }
}
