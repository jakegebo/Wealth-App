import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { snapshot, news, period, fromDate, toDate, messages, holdings } = req.body

  try {
    const periodLabel =
      period === '1D' ? 'the last 24 hours' :
      period === '1W' ? 'the last 7 days' :
      period === '1M' ? 'the last 30 days' :
      fromDate && toDate ? `${fromDate} to ${toDate}` : 'recent period'

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    const snapText = snapshot?.length
      ? snapshot.map((s: any) => {
          const pct = parseFloat(s.changePercent)
          const sign = pct >= 0 ? '+' : ''
          const endPrice = s.endPrice != null ? `$${parseFloat(s.endPrice).toFixed(2)}` : (s.price != null ? `$${parseFloat(s.price).toFixed(2)}` : '')
          return `${s.symbol}: ${endPrice} (${sign}${pct.toFixed(2)}% over period)`
        }).join(' | ')
      : 'Market data unavailable'

    const headlineText = news?.length
      ? news.slice(0, 8).map((n: any, i: number) =>
          `${i + 1}. ${n.title}${n.description ? ' — ' + n.description.slice(0, 80) : ''}`
        ).join('\n')
      : 'No headlines available'

    const holdingsLine = holdings?.length
      ? `\nThis user's holdings: ${holdings.join(', ')} — prioritize news and analysis relevant to these positions.`
      : ''

    const systemPrompt = `You are a sharp, accurate, and unbiased market analyst writing concise recaps for a specific investor. Today is ${today}.

Period being analyzed: ${periodLabel}

Market performance data for this period:
${snapText}

Recent relevant headlines:
${headlineText}
${holdingsLine}

Guidelines:
- Be accurate and unbiased — report what happened, not what should have happened
- Use the real numbers from the data above. Be specific: say "SPY fell 2.1%" not "markets declined"
- When the user holds specific tickers, call them out directly (e.g. "Your FXAIX position…")
- Cover what actually moved and why, based on the headlines and data
- Keep language clear and accessible — no jargon without explanation
- No disclaimers, no "please consult a financial advisor"
- Never recommend specific buy/sell actions`

    // Follow-up conversation mode
    if (messages && messages.length > 0) {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: systemPrompt,
        messages: messages.slice(-8).map((m: any) => ({ role: m.role, content: m.content })),
      })
      return res.json({ reply: response.content[0]?.type === 'text' ? response.content[0].text : '' })
    }

    // Initial recap
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Write a structured market recap for ${periodLabel} focused on what matters to this specific investor's portfolio. Use this exact format:

**Market Overview**
One clear sentence on the overall market direction and tone for this period.

**What Moved (and Why)**
- [Asset or holding]: specific % move and brief reason — call out the user's own tickers where relevant
- [Asset or holding]: specific % move and brief reason
- [Asset or holding]: specific % move and brief reason

**What's Driving It**
2 sentences on the macro forces, catalysts, or news themes behind the moves.

**What It Means for Your Portfolio**
1-2 sentences specifically about how these moves affect the user's holdings. Reference their actual positions by ticker.

Keep the total response under 220 words. Use the actual numbers from the data provided.`
      }]
    })

    res.json({ brief: response.content[0]?.type === 'text' ? response.content[0].text : '' })
  } catch (err: any) {
    console.error('market-brief error:', err?.message || err)
    res.status(500).json({ error: 'Failed to generate brief' })
  }
}
