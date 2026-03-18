import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { snapshot } = req.body

  try {
    const snapText = snapshot?.map((s: any) =>
      `${s.symbol}: $${s.price} (${parseFloat(s.changePercent) >= 0 ? '+' : ''}${parseFloat(s.changePercent).toFixed(2)}%)`
    ).join(', ') || 'market data unavailable'

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a concise market analyst. Write a 2-3 sentence market brief for today based on the provided snapshot.
Be direct and informative. Note key trends, sentiment, and what it means for investors.
Never mention specific buy/sell actions. Keep it under 60 words total.`
        },
        {
          role: 'user',
          content: `Market snapshot: ${snapText}. Write a brief daily market summary.`
        }
      ],
      temperature: 0.4,
      max_tokens: 120
    })

    res.json({ brief: completion.choices[0]?.message?.content || '' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to generate brief' })
  }
}
