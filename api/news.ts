export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const newsKey = process.env.NEWS_API_KEY
  const { category = 'markets', page = '1' } = req.query

  const queries: Record<string, string> = {
    markets: 'stock market investing Wall Street S&P 500',
    economy: 'federal reserve interest rates inflation economy',
    crypto: 'cryptocurrency bitcoin ethereum crypto',
    realestate: 'real estate housing market mortgage rates',
    ai: 'artificial intelligence AI investing OpenAI technology'
  }

  const query = encodeURIComponent(queries[category as string] || queries.markets)

  try {
    // Try today first
    const today = new Date().toISOString().split('T')[0]
    let response = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=10&page=${page}&from=${today}&apiKey=${newsKey}`
    )
    let data = await response.json()
    let articles = (data.articles || []).filter((a: any) =>
      a.title && a.urlToImage && !a.title.includes('[Removed]') && a.description
    )

    // Fall back to last 7 days if nothing today
    if (articles.length < 3) {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      response = await fetch(
        `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=10&page=${page}&from=${weekAgo}&apiKey=${newsKey}`
      )
      data = await response.json()
      articles = (data.articles || []).filter((a: any) =>
        a.title && a.urlToImage && !a.title.includes('[Removed]') && a.description
      )
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
