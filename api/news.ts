export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const newsKey = process.env.NEWS_API_KEY
  const avKey = process.env.ALPHA_VANTAGE_KEY

  try {
    // Fetch all news categories in parallel
    const [markets, crypto, realestate, ai, economy] = await Promise.all([
      fetch(`https://newsapi.org/v2/everything?q=stock+market+investing&language=en&sortBy=publishedAt&pageSize=5&apiKey=${newsKey}`).then(r => r.json()),
      fetch(`https://newsapi.org/v2/everything?q=cryptocurrency+bitcoin+ethereum&language=en&sortBy=publishedAt&pageSize=5&apiKey=${newsKey}`).then(r => r.json()),
      fetch(`https://newsapi.org/v2/everything?q=real+estate+housing+market+mortgage&language=en&sortBy=publishedAt&pageSize=5&apiKey=${newsKey}`).then(r => r.json()),
      fetch(`https://newsapi.org/v2/everything?q=artificial+intelligence+AI+money+investing&language=en&sortBy=publishedAt&pageSize=5&apiKey=${newsKey}`).then(r => r.json()),
      fetch(`https://newsapi.org/v2/everything?q=federal+reserve+interest+rates+economy&language=en&sortBy=publishedAt&pageSize=5&apiKey=${newsKey}`).then(r => r.json()),
    ])

    const cleanArticles = (data: any) =>
      (data.articles || [])
        .filter((a: any) => a.title && a.urlToImage && !a.title.includes('[Removed]'))
        .map((a: any) => ({
          title: a.title,
          description: a.description,
          url: a.url,
          image: a.urlToImage,
          source: a.source?.name,
          publishedAt: a.publishedAt
        }))

    res.json({
      markets: cleanArticles(markets),
      crypto: cleanArticles(crypto),
      realestate: cleanArticles(realestate),
      ai: cleanArticles(ai),
      economy: cleanArticles(economy)
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch news' })
  }
}
