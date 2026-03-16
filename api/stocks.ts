export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const avKey = process.env.ALPHA_VANTAGE_KEY
  const { symbols } = req.query

  if (!symbols) return res.status(400).json({ error: 'Symbols required' })

  try {
    const symbolList = (symbols as string).split(',').slice(0, 10)

    const quotes = await Promise.all(
      symbolList.map(async (symbol: string) => {
        const response = await fetch(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol.trim()}&apikey=${avKey}`
        )
        const data = await response.json()
        const quote = data['Global Quote']

        if (!quote || !quote['05. price']) return null

        return {
          symbol: quote['01. symbol'],
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: quote['10. change percent']?.replace('%', ''),
          high: parseFloat(quote['03. high']),
          low: parseFloat(quote['04. low']),
          volume: parseInt(quote['06. volume'])
        }
      })
    )

    res.json({ quotes: quotes.filter(Boolean) })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch stocks' })
  }
}
