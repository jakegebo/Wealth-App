import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export default async function handler(req: any, res: any) {
  const { method } = req

  if (method === 'POST') {
    const { userId, netWorth, totalAssets, totalLiabilities } = req.body
    if (!userId) return res.status(400).json({ error: 'Missing userId' })

    // Only save if value has changed from last entry
    const { data: last } = await supabase
      .from('net_worth_history')
      .select('net_worth')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single()

    if (last && Math.abs(last.net_worth - netWorth) < 1) {
      return res.json({ message: 'No change' })
    }

    const { error } = await supabase.from('net_worth_history').insert({
      user_id: userId,
      net_worth: netWorth,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities
    })

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ message: 'Saved' })
  }

  if (method === 'GET') {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'Missing userId' })

    const { data, error } = await supabase
      .from('net_worth_history')
      .select('net_worth, total_assets, total_liabilities, recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: true })
      .limit(90)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ history: data || [] })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
