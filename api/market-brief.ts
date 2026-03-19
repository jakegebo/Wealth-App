import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { snapshot, news, period, fromDate, toDate } = req.body

  try {
    const periodLabel =
      period === '1D' ? 'the last 24 hours' :
      period === '1W' ? 'the last 7 days' :
      period === '1M' ? 'the last 30 days' :
      fromDate && toDate ? `${fromDate} to ${toDate}` : 'recent period'

    const snapText = snapshot?.length
      ? snapshot.map((s: any) =>
          `${s.symbol}: $${s.price} (${parseFloat(s.changePercent) >= 0 ? '+' : ''}${parseFloat(s.changePercent).toFixed(2)}%)`
        ).join(' | ')
      : 'Market data unavailable'

    const headlineText = news?.length
      ? news.slice(0, 10).map((n: any, i: number) => `${i + 1}. ${n.title}${n.description ? ' — ' + n.description.slice(0, 100) : ''}`).join('\n')
      : 'No headlines available'

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a sharp, concise market analyst writing for retail investors. Write a structured recap for ${periodLabel}.

FORMAT YOUR RESPONSE EXACTLY LIKE THIS (use these exact bold headers):

**Market Overview**
One clear sentence on the overall market direction and tone for this period.

**Key Moves**
- [Item 1]: brief explanation with % or $ move if available
- [Item 2]: brief explanation
- [Item 3]: brief explanation

**What's Driving It**
2 sentences on the macro forces, catalysts, or news themes behind the moves.

**Investor Takeaway**
1-2 sentences on what this means for a typical long-term retail investor.

Rules:
- Use real numbers from the snapshot and headlines
- Be specific, not vague. Say "SPY fell 1.2%" not "markets declined"
- Total response under 200 words
- No disclaimers, no "please consult a financial advisor"
- Never recommend specific buy/sell actions`
        },
        {
          role: 'user',
          content: `Period: ${periodLabel}

Market snapshot: ${snapText}

Top headlines:
${headlineText}

Write the market recap.`
        }
      ],
      temperature: 0.3,
      max_tokens: 400
    })

    res.json({ brief: completion.choices[0]?.message?.content || '' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to generate brief' })
  }
}
