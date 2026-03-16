export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const newsKey = process.env.NEWS_API_KEY
  const { category = 'markets', page = '1' } = req.query

  const trustedSources = [
    'bloomberg', 'the-wall-street-journal', 'financial-times',
    'reuters', 'cnbc', 'fortune', 'business-insider',
    'the-economist', 'forbes', 'marketwatch', 'techcrunch',
    'wired', 'axios', 'the-verge'
  ].join(',')

  const queries: Record<string, string> = {
    markets: 'stock+market+investing+S%26P+500+Wall+Street',
    economy: 'federal+reserve+interest+rates+inflation+economy+GDP',
    crypto: 'cryptocurrency+bitcoin+ethereum+crypto+blockchain',
    realestate: 'real+estate+housing+market+mortgage+rates+property',
    ai: 'artificial+intelligence+AI+investing+opportunity+OpenAI+tech'
  }

  const query = queries[category as string] || queries.markets
  const today = new Date().toISOString().split('T')[0]

  try {
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=10&page=${page}&from=${today}&sources=${trustedSources}&apiKey=${newsKey}`
    )
    const data = await response.json()

    // If today returns no results fall back to last 3 days
    let articles = data.articles || []
    if (articles.length === 0) {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
      const fallback = await fetch(
        `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=10&page=${page}&from=${threeDaysAgo}&sources=${trustedSources}&apiKey=${newsKey}`
      )
      const fallbackData = await fallback.json()
      articles = fallbackData.articles || []
    }

    const clean = articles
      .filter((a: any) => a.title && a.urlToImage && !a.title.includes('[Removed]') && a.description)
      .map((a: any) => ({
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
