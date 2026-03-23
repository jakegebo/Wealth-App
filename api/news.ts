export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const newsKey = process.env.NEWS_API_KEY
  const { category = 'markets', page = '1', from: fromParam, to: toParam, q: customQuery } = req.query

  const queries: Record<string, string> = {
    markets: 'stock market investing Wall Street S&P 500',
    economy: 'federal reserve interest rates inflation economy',
    crypto: 'cryptocurrency bitcoin ethereum crypto',
    realestate: 'real estate housing market mortgage rates',
    ai: 'artificial intelligence AI investing OpenAI technology'
  }

  const FINANCE_ANCHOR = 'stock OR shares OR earnings OR revenue OR investor OR market OR SEC OR dividend OR IPO OR trading OR portfolio OR fund OR ETF OR financial OR fiscal'

  // For portfolio queries, AND the company terms with finance terms so WWE-style noise is filtered out
  const rawQuery = (customQuery as string) || queries[category as string] || queries.markets
  const finalQuery = customQuery
    ? `(${rawQuery}) AND (${FINANCE_ANCHOR})`
    : rawQuery

  const query = encodeURIComponent(finalQuery)

  try {
    const today = new Date().toISOString().split('T')[0]
    const fromDate = (fromParam as string) || today
    const toDate = (toParam as string) || today

    let response = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=15&page=${page}&from=${fromDate}&to=${toDate}&apiKey=${newsKey}`
    )
    let data = await response.json()
    const EXCLUDED_SOURCES = [
      'Times of India',
      'Hindustan Times',
      'Zero Hedge',
      'InvestorPlace',
      'Daily Mail',
      'The Sun',
    ]

    const FINANCE_KEYWORDS = [
      'stock', 'share', 'earn', 'revenue', 'invest', 'market', 'sec', 'dividend',
      'ipo', 'trad', 'portfolio', 'fund', 'etf', 'financial', 'fiscal', 'quarter',
      'profit', 'loss', 'valuat', 'analyst', 'forecast', 'guidance', 'rally',
      'selloff', 'bull', 'bear', 'nasdaq', 's&p', 'dow', 'nyse', 'fed', 'rate',
    ]

    const isFinanceRelevant = (a: any) => {
      if (!customQuery) return true // category queries are already finance-focused
      const text = ((a.title || '') + ' ' + (a.description || '')).toLowerCase()
      return FINANCE_KEYWORDS.some(kw => text.includes(kw))
    }

    const filterArticles = (list: any[]) => list.filter((a: any) =>
      a.title && !a.title.includes('[Removed]') && a.description &&
      !EXCLUDED_SOURCES.includes(a.source?.name) &&
      isFinanceRelevant(a)
    )

    let articles = filterArticles(data.articles || [])

    // Fall back to last 7 days if sparse
    if (articles.length < 3) {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      response = await fetch(
        `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=15&page=${page}&from=${weekAgo}&apiKey=${newsKey}`
      )
      data = await response.json()
      articles = filterArticles(data.articles || [])
    }

    const clean = articles.map((a: any) => ({
      title: a.title,
      description: a.description,
      url: a.url,
      image: a.urlToImage,
      source: a.source?.name,
      publishedAt: a.publishedAt
    }))

    res.json({ articles: clean, totalResults: data.totalResults || 0 })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch news' })
  }
}
