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

  const FINANCE_ANCHOR = 'stock OR shares OR earnings OR revenue OR investor OR "stock market" OR SEC OR dividend OR IPO OR trading OR portfolio OR ETF OR financial OR fiscal OR "hedge fund" OR "mutual fund" OR "interest rate" OR inflation OR "earnings per share"'

  // For portfolio queries, AND the company terms with finance terms so entertainment noise is filtered out
  const rawQuery = (customQuery as string) || queries[category as string] || queries.markets
  const finalQuery = customQuery
    ? `(${rawQuery}) AND (${FINANCE_ANCHOR})`
    : rawQuery

  const query = encodeURIComponent(finalQuery)

  // Financial news domains — restricts portfolio/custom queries to reputable finance sources only
  const FINANCE_DOMAINS = [
    'reuters.com', 'bloomberg.com', 'wsj.com', 'cnbc.com', 'ft.com',
    'marketwatch.com', 'barrons.com', 'seekingalpha.com', 'fool.com',
    'thestreet.com', 'forbes.com', 'businessinsider.com', 'investing.com',
    'finance.yahoo.com', 'benzinga.com', 'kiplinger.com'
  ].join(',')

  try {
    const today = new Date().toISOString().split('T')[0]
    const fromDate = (fromParam as string) || today
    const toDate = (toParam as string) || today

    const domainsParam = customQuery ? `&domains=${FINANCE_DOMAINS}` : ''

    let response = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=15&page=${page}&from=${fromDate}&to=${toDate}${domainsParam}&apiKey=${newsKey}`
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

    // Strong financial terms — at least one must appear in the TITLE for custom/portfolio queries
    const STRONG_FINANCE_TERMS = [
      'stock', 'share', 'earn', 'revenue', 'invest', 'dividend', 'ipo', 'etf',
      'financial', 'fiscal', 'quarter', 'profit', 'loss', 'valuat', 'analyst',
      'forecast', 'guidance', 'rally', 'selloff', 'nasdaq', 's&p', 'dow', 'nyse',
      'fed', 'interest rate', 'inflation', 'gdp', 'hedge fund', 'mutual fund',
      'market cap', 'portfolio', 'trading', 'equit',
    ]

    const isFinanceRelevant = (a: any) => {
      if (!customQuery) return true // category queries are already finance-focused
      const title = (a.title || '').toLowerCase()
      const body = (a.description || '').toLowerCase()
      // Title must contain at least one strong finance term
      const titleMatch = STRONG_FINANCE_TERMS.some(kw => title.includes(kw))
      // Body needs at least two matches total (catches edge cases where title is ambiguous)
      const bodyMatches = STRONG_FINANCE_TERMS.filter(kw => body.includes(kw)).length
      return titleMatch || bodyMatches >= 2
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
        `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=15&page=${page}&from=${weekAgo}${domainsParam}&apiKey=${newsKey}`
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
