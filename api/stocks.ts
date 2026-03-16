export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { symbols, symbol, period, search } = req.query

  try {
    // Search for any stock, ETF, or mutual fund
    if (search) {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search as string)}&lang=en-US&region=US&quotesCount=8&newsCount=0`
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const data = await response.json()

      const results = (data.quotes || [])
        .filter((q: any) => q.symbol && (q.shortname || q.longname))
        .slice(0, 8)
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol
        }))

      return res.json({ results })
    }

    // Historical chart data
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

      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
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
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: period === '5Y' || period === '10Y' || period === 'ALL' ? 'numeric' : undefined
        })
      })

      const prices = closes
        .map((p: number | null) => p ? parseFloat(p.toFixed(2)) : null)
        .filter((p: any) => p !== null)

      return res.json({ labels: labels.slice(0, prices.length), prices })
    }

    // Watchlist quotes
    if (symbols) {
      const symbolList = (symbols as string).split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20)

      const quotes = await Promise.all(
        symbolList.map(async (sym: string) => {
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
            const data = await response.json()
            const result = data?.chart?.result?.[0]
            if (!result) return null

            const meta = result.meta
            const price = meta.regularMarketPrice
            const prevClose = meta.previousClose || meta.chartPreviousClose
            const change = price - prevClose

            return {
              symbol: sym,
              name: meta.shortName || sym,
              price: parseFloat(price?.toFixed(2)),
              change: parseFloat(change?.toFixed(2)),
              changePercent: ((change / prevClose) * 100).toFixed(2),
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

    return res.status(400).json({ error: 'Missing parameters' })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch stock data' })
  }
}
