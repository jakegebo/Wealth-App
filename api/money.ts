import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { action, profile, messages, topic } = req.body

    if (action === 'generate_ideas') {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'system',
          content: `You generate income ideas. Return ONLY a JSON object with this exact structure:
{"ideas": ["idea one as a complete sentence", "idea two as a complete sentence", "idea three", "idea four", "idea five", "idea six"]}

Each idea must be a plain string sentence. NO objects, NO nested data, NO keys like name/description. Just plain sentences.`
        }, {
          role: 'user',
          content: `Generate 6 specific income ideas for this person:
- Monthly income: $${profile.monthly_income}
- Monthly expenses: $${profile.monthly_expenses}
- Available to invest: $${((profile.monthly_income || 0) - (profile.monthly_expenses || 0)).toLocaleString()}/mo
- Assets: ${profile.assets?.map((a: any) => `${a.name} ($${a.value})`).join(', ') || 'none'}
- Context: ${profile.additional_context || 'none'}

Rules:
- Each idea is a single descriptive sentence
- Be specific to their income level and situation
- No generic ideas like surveys or Uber
- Mix of: professional skills monetization, investing surplus, passive income, digital products
- Make them actionable and realistic`
        }],
        temperature: 0.9,
        max_tokens: 600,
        response_format: { type: 'json_object' }
      })

      const raw = completion.choices[0]?.message?.content ?? '{"ideas":[]}'
      try {
        const parsed = JSON.parse(raw)
        // Handle various response formats and ensure all items are strings
        let ideas: string[] = []
        if (Array.isArray(parsed)) {
          ideas = parsed
        } else if (Array.isArray(parsed.ideas)) {
          ideas = parsed.ideas
        } else {
          // Try to extract any array from the response
          const vals = Object.values(parsed)
          for (const v of vals) {
            if (Array.isArray(v)) { ideas = v; break }
          }
        }
        // Convert any objects to strings
        ideas = ideas.map((idea: any) => {
          if (typeof idea === 'string') return idea
          if (typeof idea === 'object' && idea !== null) {
            return idea.name || idea.title || idea.description || JSON.stringify(idea)
          }
          return String(idea)
        }).filter(Boolean)

        return res.json({ ideas })
      } catch {
        return res.json({ ideas: [] })
      }
    }

    if (action === 'chat') {
      const profileSummary = `
PERSON'S FINANCIAL PROFILE:
- Monthly Income: $${profile.monthly_income}
- Monthly Expenses: $${profile.monthly_expenses}
- Available to invest/save: $${((profile.monthly_income || 0) - (profile.monthly_expenses || 0)).toLocaleString()}/mo
- Assets: ${profile.assets?.map((a: any) => `${a.name} ($${a.value})`).join(', ') || 'none'}
- Context: ${profile.additional_context || 'none'}
`
      const topicPrompts: Record<string, string> = {
        surplus: `Focus on the best ways to deploy their monthly surplus of $${((profile.monthly_income || 0) - (profile.monthly_expenses || 0)).toLocaleString()} to build wealth faster.`,
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
- Explain HOW to actually execute each idea
- Be realistic about timelines and effort required
- Format responses with line breaks and numbered steps
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
