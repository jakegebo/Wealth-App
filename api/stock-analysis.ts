import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { symbol, price, change, changePercent, high, low, volume } = req.body

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a professional stock analyst. Give clear, honest analysis of stocks. 
Format your response with these exact sections:
**Overview**
2-3 sentences about what this company/asset does and its market position.

**Recent Performance**
2-3 sentences analyzing the current price movement and what's driving it.

**Key Risks**
2-3 bullet points of main risks to be aware of.

**Outlook**
2-3 sentences on short to medium term outlook. Be honest about uncertainty.

Keep each section concise. Never give specific buy/sell recommendations. Always note this is not financial advice.`
        },
        {
          role: 'user',
          content: `Analyze ${symbol}:
Current Price: $${price}
Change today: ${change > 0 ? '+' : ''}${change} (${changePercent}%)
Today's High: $${high}
Today's Low: $${low}
Volume: ${volume?.toLocaleString()}

Give me a professional analysis of this stock's current situation and near term outlook.`
        }
      ],
      temperature: 0.5,
      max_tokens: 600
    })

    res.json({ analysis: completion.choices[0]?.message?.content || 'Analysis unavailable.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to generate analysis' })
  }
}
