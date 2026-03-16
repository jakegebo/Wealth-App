export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const avKey = process.env.ALPHA_VANTAGE_KEY
  const { symbols, symbol, period } = req.query

  try {
    // Historical data for a single stock
    if (symbol && period) {
      const sym = (symbol as string).toUpperCase()

      let url = ''
      let dataKey = ''

      if (period === '1D') {
        url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${sym}&interval=5min&apikey=${avKey}`
        dataKey = 'Time Series (5min)'
      } else if (period === '1W' || period === '1M') {
        url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${sym}&apikey=${avKey}`
        dataKey = 'Time Series (Daily)'
      } else {
        url = `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=${sym}&apikey=${avKey}`
        dataKey = 'Weekly Time Series'
      }

      const response = await fetch(url)
      const data = await response.json()
      const series = data[dataKey]

      if (!series) return res.json({ labels: [], prices: [] })

      const entries = Object.entries(series)
        .slice(0, period === '1D' ? 78 : period === '1W' ? 7 : period === '1M' ? 30 : period === '1Y' ? 52 : period === '5Y' ? 260 : period === '10Y' ? 520 : 1000)
        .reverse()

      const labels = entries.map(([date]) =>
        period === '1D' ? date.split(' ')[1].slice(0, 5) : date
      )
      const prices = entries.map(([, val]: any) => parseFloat(val['4. close']))

      return res.json({ labels, prices })
    }

    // Quote data for watchlist
    if (symbols) {
      const symbolList = (symbols as string).split(',').slice(0, 15)

      const quotes = await Promise.all(
        symbolList.map(async (sym: string) => {
          const response = await fetch(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym.trim()}&apikey=${avKey}`
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
      return res.json({ quotes: quotes.filter(Boolean) })
    }

    return res.status(400).json({ error: 'Missing parameters' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch stock data' })
  }
}
