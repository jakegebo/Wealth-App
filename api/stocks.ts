export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { symbols, symbol, period } = req.query

  try {
    // Historical chart data for single stock
    if (symbol && period) {
      const sym = (symbol as string).toUpperCase()

      const rangeMap: Record<string, { range: string; interval: string }> = {
        '1D': { range: '1d', interval: '5m' },
        '1W': { range: '5d', interval: '15m' },
        '1M': { range: '1mo', interval: '1d' },
        '1Y': { range: '1y', interval: '1wk' },
        '5Y': { range: '5y', interval: '1mo' },
        '10Y': { range: '10y', interval: '3mo' },
        'ALL': { range: 'max', interval: '3mo' }
      }

      const { range, interval } = rangeMap[period as string] || rangeMap['1M']
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${range}&interval=${interval}`

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      const data = await response.json()

      const result = data?.chart?.result?.[0]
      if (!result) return res.json({ labels: [], prices: [] })

      const timestamps = result.timestamp || []
      const closes = result.indicators?.quote?.[0]?.close || []

      const labels = timestamps.map((ts: number) => {
        const d = new Date(ts * 1000)
        if (period === '1D' || period === '1W') {
          return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        }
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: period === '5Y' || period === '10Y' || period === 'ALL' ? 'numeric' : undefined })
      })

      const prices = closes.map((p: number | null) => p ? parseFloat(p.toFixed(2)) : null).filter(Boolean)

      return res.json({ labels: labels.slice(0, prices.length), prices })
    }

    // Watchlist quotes
    if (symbols) {
      const symbolList = (symbols as string).split(',').map((s: string) => s.trim().toUpperCase()).slice(0, 20)

      const quotes = await Promise.all(
        symbolList.map(async (sym: string) => {
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
            const data = await response.json()
            const result = data?.chart?.result?.[0]
            if (!result) return null

            const meta = result.meta
            return {
              symbol: sym,
              price: parseFloat(meta.regularMarketPrice?.toFixed(2)),
              change: parseFloat((meta.regularMarketPrice - meta.previousClose).toFixed(2)),
              changePercent: (((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100).toFixed(2),
              high: parseFloat(meta.regularMarketDayHigh?.toFixed(2)),
              low: parseFloat(meta.regularMarketDayLow?.toFixed(2)),
              volume: meta.regularMarketVolume || 0
            }
          } catch {
            return null
          }
        })
      )

      return res.json({ quotes: quotes.filter(Boolean) })
    }

    // Search for stocks
    if (req.query.search) {
      const query = req.query.search as string
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&lang=en-US&region=US&quotesCount=8&newsCount=0`
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const data = await response.json()

      const results = (data.quotes || [])
        .filter((q: any) => q.symbol && q.shortname && q.quoteType === 'EQUITY')
        .slice(0, 8)
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.shortname || q.longname
        }))

      return res.json({ results })
    }

    return res.status(400).json({ error: 'Missing parameters' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch stock data' })
  }
}
