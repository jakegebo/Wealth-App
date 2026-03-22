import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { action, profile, messages, topic, prompt, selectedIdeas, refinement, excludedIdeas } = req.body

    if (action === 'generate_ideas') {
      const p = profile || {}
      const surplus = (p.monthly_income || 0) - (p.monthly_expenses || 0)

      const assetSummary = p.assets?.length
        ? p.assets.map((a: any) => {
            const type = a.account_type || a.category || 'asset'
            const details = [
              a.holdings ? `invested in ${a.holdings}` : '',
              a.coins ? `coins: ${a.coins}` : '',
              a.monthly_rental ? `rents for $${a.monthly_rental}/mo` : '',
              a.apy ? `${a.apy}% APY` : '',
            ].filter(Boolean).join(', ')
            return `${type} "${a.name}" ($${(a.value || 0).toLocaleString()})${details ? ` — ${details}` : ''}`
          }).join('; ')
        : 'none listed'

      const debtSummary = p.debts?.length
        ? `total ~$${p.debts.reduce((s: number, d: any) => s + (d.balance || 0), 0).toLocaleString()} — ${p.debts.map((d: any) => `${d.type || d.name} at ${d.interest_rate}%`).join(', ')}`
        : 'no debts'

      const goalSummary = p.goals?.length
        ? p.goals.map((g: any) => `${g.name} (${g.priority || 'medium'} priority, target $${(g.target_amount || 0).toLocaleString()})`).join('; ')
        : 'none listed'

      const existingSources = p.income_sources?.length
        ? p.income_sources.map((s: any) => `${s.type}: $${s.amount}/${s.frequency}`).join(', ')
        : 'none besides primary income'

      const excludedContext = excludedIdeas?.length
        ? `\nDO NOT REPEAT OR CLOSELY RESEMBLE THESE PREVIOUS IDEAS — generate completely different ones:\n${excludedIdeas.map((s: any) => `- ${typeof s === 'string' ? s : s.title}`).join('\n')}`
        : ''

      const selectedContext = selectedIdeas?.length
        ? `\nUSER SELECTED THESE IDEAS THEY LIKED:\n${selectedIdeas.map((s: any) => `- ${s.title}: ${s.description || ''}`).join('\n')}\nGenerate 6 new ideas that are similar in spirit, effort level, or type to the ones they selected.`
        : ''

      const promptContext = prompt
        ? `\nUSER PREFERENCE: ${prompt}`
        : ''

      const refinementContext = refinement
        ? `\nADDITIONAL CONTEXT: ${refinement}`
        : ''

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'system',
          content: `You generate modern, creative income ideas for people who want to build wealth outside their day job. Return ONLY valid JSON:
{
  "ideas": [
    {
      "title": "3-5 word name",
      "description": "2 sentences: what this is AND why it fits this person's life stage, financial position, free time, or goals — NOT their career. Be specific and exciting.",
      "monthly_range": "$X – $Y/mo",
      "timeline": "specific timeframe, e.g. 'First sale in 2–3 weeks' or 'Cash flowing in 3–4 months'",
      "effort": "low" | "medium" | "high",
      "category": "skill" | "passive" | "digital" | "investing" | "business"
    }
  ]
}

Effort: low = <5 hrs/week ongoing, medium = 5–15 hrs/week, high = 15+ hrs/week.
monthly_range: CONSERVATIVE — what a typical person earns in months 1–6, not best-case maximums.
timeline: must be specific. Never say "quickly" or "soon".`
        }, {
          role: 'user',
          content: `Generate 6 income ideas for this person that are OUTSIDE their current career path.${promptContext}${excludedContext}${selectedContext}${refinementContext}

PROFILE:
- Age: ${p.age || 'not specified'}
- State: ${p.state || 'not specified'}
- Employment: ${p.employment_type?.replace(/_/g, ' ') || 'not specified'}
- Life stage: ${p.life_stage?.replace(/_/g, ' ') || 'not specified'}
- Risk tolerance: ${p.risk_tolerance || 'moderate'}
- Annual gross income: $${(p.annual_gross_income || 0).toLocaleString()}
- Monthly take-home: $${(p.monthly_income || 0).toLocaleString()}
- Monthly expenses: $${(p.monthly_expenses || 0).toLocaleString()}
- Monthly surplus: $${surplus.toLocaleString()}
- Monthly savings/invested: $${(p.monthly_savings || 0).toLocaleString()}
- Emergency fund: ${p.emergency_fund_months || 0} months covered
- Assets: ${assetSummary}
- Debts: ${debtSummary}
- Goals: ${goalSummary}
- Financial concerns: ${p.concerns?.join(', ') || 'not specified'}
- Existing income sources: ${existingSources}
- About them: ${p.additional_context || 'not specified'}

RULES:
- NEVER suggest ideas that are extensions of their day job or profession. People want to escape their career, not repeat it on the side.
- Think like a Gen Z entrepreneur: digital-first, asset-light, leverage platforms, build audiences, monetize content, rent assets, flip things, automate income.
- Draw on their FINANCIAL SITUATION (surplus, assets, debt level, goals) to tailor — not their job title.
- Prioritize modern opportunities: newsletters, digital products, AI tools, niche communities, short-term rentals, reselling, creator monetization, micro-SaaS, etc.
- If they have investable assets, include at least 1 idea that puts that capital to work passively.
- If they have high debt, lean toward high-ROI-per-hour ideas with no startup capital required.
- NO outdated or overplayed ideas (Uber/DoorDash, surveys, Amazon reviews, MLM, drop shipping with no twist).
- Be creative and specific. No vague descriptions like "start a blog" — say exactly what niche, format, and monetization path.
- Mix: 1 digital/content, 1 passive/investing, 1 business/product, 1 community/platform, and 2 wild cards that are genuinely unexpected.
- monthly_range must be realistic for the first 6 months — not theoretical maximums.
${excludedIdeas?.length ? `- CRITICAL: Every idea must be completely different from the excluded list above — different industry, different mechanism, different effort type. Do not produce variations or rewordings of those ideas.` : ''}`
        }],
        temperature: excludedIdeas?.length ? 1.1 : 0.95,
        max_tokens: 1400,
        response_format: { type: 'json_object' }
      })

      const raw = completion.choices[0]?.message?.content ?? '{"ideas":[]}'
      try {
        const parsed = JSON.parse(raw)
        let ideas: any[] = []
        if (Array.isArray(parsed)) {
          ideas = parsed
        } else if (Array.isArray(parsed.ideas)) {
          ideas = parsed.ideas
        } else {
          const vals = Object.values(parsed)
          for (const v of vals) {
            if (Array.isArray(v)) { ideas = v; break }
          }
        }

        ideas = ideas.map((idea: any) => {
          if (typeof idea === 'string') {
            return { title: idea, description: idea, monthly_range: '', timeline: '', effort: 'medium', category: 'skill' }
          }
          return {
            title: idea.title || idea.name || 'Income idea',
            description: idea.description || idea.summary || '',
            monthly_range: idea.monthly_range || idea.income_range || idea.income || '',
            timeline: idea.timeline || idea.time_to_income || idea.timeframe || '',
            effort: idea.effort || 'medium',
            category: idea.category || 'skill',
          }
        }).filter((idea: any) => idea.title)

        return res.json({ ideas })
      } catch {
        return res.json({ ideas: [] })
      }
    }

    if (action === 'chat') {
      const p = profile || {}
      const surplus = (p.monthly_income || 0) - (p.monthly_expenses || 0)

      const assetSummary = p.assets?.map((a: any) =>
        `${a.account_type || a.category} "${a.name}" ($${(a.value || 0).toLocaleString()})`
      ).join(', ') || 'none'

      const profileSummary = `PERSON'S FINANCIAL PROFILE:
- Age: ${p.age || 'unknown'} | State: ${p.state || 'unknown'} | Employment: ${p.employment_type?.replace(/_/g, ' ') || 'unknown'}
- Life stage: ${p.life_stage?.replace(/_/g, ' ') || 'unknown'} | Risk tolerance: ${p.risk_tolerance || 'moderate'}
- Annual gross: $${(p.annual_gross_income || 0).toLocaleString()} | Monthly take-home: $${(p.monthly_income || 0).toLocaleString()}
- Monthly expenses: $${(p.monthly_expenses || 0).toLocaleString()} | Monthly surplus: $${surplus.toLocaleString()}/mo
- Monthly savings/invested: $${(p.monthly_savings || 0).toLocaleString()}
- Assets: ${assetSummary}
- Goals: ${p.goals?.map((g: any) => g.name).join(', ') || 'none'}
- Concerns: ${p.concerns?.join(', ') || 'none'}
- About them: ${p.additional_context || 'none'}`

      const topicPrompts: Record<string, string> = {
        surplus: `Focus on the best ways to deploy their monthly surplus of $${surplus.toLocaleString()}/mo to build wealth faster. Be specific about accounts, instruments, and allocation given their situation.`,
        sidehustle: `Focus on modern, creative side hustles that are OUTSIDE their career path — people want to try something new, not do their job again on the side. Think digital products, platforms, communities, flipping, content, AI tools. Give a concrete 30-day launch plan for the best fit. Be honest about how long it actually takes to earn.`,
        passive: `Focus on building passive income streams suited to their asset level and risk tolerance. Be upfront that most passive income takes 6–24 months to build — give realistic timelines and capital requirements.`,
        ideas: `Help them explore and develop specific income ideas. Be a strategic thinking partner who gives concrete, actionable advice tailored to their exact situation.`
      }

      const systemPrompt = `You are a wealth building strategist — direct, creative, and deeply practical. Your only focus is helping this person make more money.

${profileSummary}

TOPIC FOCUS: ${topicPrompts[topic] || topicPrompts.ideas}

YOUR STYLE:
- Give advice tailored to THIS person's exact situation — always reference their actual numbers, assets, and background
- Never be generic. If they ask about an idea, give specifics for their situation
- When discussing an income idea in depth: cover (1) why it fits them specifically, (2) realistic income by month 1/3/6/12, (3) barriers to entry and how to overcome them, (4) startup costs/capital needed, (5) exact first steps this week, (6) what separates people who succeed vs fail, (7) common pitfalls
- Be honest about timelines — don't oversell how fast money comes
- Think like a smart entrepreneur: prioritize highest ROI on their time and capital
- Format with line breaks and numbered steps where helpful
- End with one specific action they can take TODAY`

      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 1400
      })

      return res.json({ message: completion.choices[0]?.message?.content || 'Something went wrong.' })
    }

    return res.status(400).json({ error: 'Invalid action' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to process request' })
  }
}
