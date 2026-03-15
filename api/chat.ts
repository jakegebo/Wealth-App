import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { messages, profile, topic } = req.body

    const profileSummary = profile ? `
USER'S FINANCIAL PROFILE:
- Monthly Income: $${profile.monthly_income}
- Monthly Expenses: $${profile.monthly_expenses}
- Available to save/mo: $${(profile.monthly_income - profile.monthly_expenses).toLocaleString()}
- Assets: ${profile.assets?.map((a: any) => `${a.name} ($${a.value.toLocaleString()})`).join(', ') || 'none'}
- Debts: ${profile.debts?.map((d: any) => `${d.name}: $${d.balance.toLocaleString()} at ${d.interest_rate}%`).join(', ') || 'none'}
- Goals: ${profile.goals?.map((g: any) => `${g.name}: target $${g.target_amount.toLocaleString()}, saved $${g.current_amount.toLocaleString()}`).join(', ') || 'none'}
- Additional context: ${profile.additional_context || 'none'}
` : ''

    const topicContext: Record<string, string> = {
      debt: 'Focus on debt elimination strategies, interest rates, payoff timelines, and balancing debt payoff with investing.',
      retirement: 'Focus on retirement planning, projected retirement age, Roth IRA and 401k strategies, compound growth, and passive income.',
      investment: 'Focus on investment strategies, asset allocation, index funds, risk tolerance, and growing wealth over time.',
      general: 'Cover any financial topic the user asks about.'
    }

    const systemPrompt = `You are a personal financial advisor — honest, clear, and genuinely helpful. You know this person's exact financial situation and give them specific, actionable advice.

${profileSummary}

TOPIC FOCUS: ${topicContext[topic] || topicContext.general}

YOUR COMMUNICATION STYLE:
- Always explain financial terms in plain, simple language
- Be honest and unbiased — give real opinions
- Be encouraging but realistic
- Format responses clearly using line breaks and short paragraphs
- When giving steps or options, number them clearly
- Keep responses focused and digestible
- Always tie advice back to THEIR specific numbers

CHART GENERATION:
When it would help to visualize data, you can include a chart in your response.
To include a chart, add a JSON block at the END of your response in this exact format:

CHART_DATA:{"type":"bar","title":"Chart Title","labels":["Label1","Label2"],"datasets":[{"label":"Series Name","data":[100,200],"color":"#34d399"}]}

Chart types available: "bar", "line", "doughnut"
Use charts for: debt payoff timelines, goal progress, net worth projections, income breakdowns, savings rate over time.
Only include a chart when it genuinely adds value. Never include multiple charts in one response.

FORMATTING RULES:
- Use short paragraphs with line breaks
- Number steps when giving a plan
- End with one clear next step they can take today`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1500
    })

    const raw = completion.choices[0]?.message?.content ?? 'Something went wrong.'

    // Extract chart data if present
    let message = raw
    let chartData = null

    const chartMatch = raw.match(/CHART_DATA:(\{.*\})/s)
    if (chartMatch) {
      try {
        chartData = JSON.parse(chartMatch[1])
        message = raw.replace(/CHART_DATA:(\{.*\})/s, '').trim()
      } catch {
        // If chart parsing fails just show the text
      }
    }

    res.json({ message, chartData })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to get response' })
  }
}
