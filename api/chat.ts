import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function calcDebtPayoff(balance: number, monthlyPayment: number, annualRate: number) {
  const labels: string[] = []
  const data: number[] = []
  let remaining = balance
  const monthlyRate = annualRate / 100 / 12

  if (monthlyPayment <= 0) monthlyPayment = balance / 12

  let month = 0
  data.push(Math.round(remaining))
  labels.push('Now')

  while (remaining > 0 && month < 120) {
    month++
    const interest = remaining * monthlyRate
    remaining = Math.max(0, remaining + interest - monthlyPayment)
    const interval = balance / monthlyPayment > 24 ? 2 : 1
    if (month % interval === 0 || remaining === 0) {
      labels.push(`Mo ${month}`)
      data.push(Math.round(remaining))
    }
    if (remaining === 0) break
  }
  return { labels, data }
}

function calcRetirementProjection(currentSavings: number, monthlySavings: number, years: number = 30) {
  const labels: string[] = []
  const optimisticData: number[] = []
  const conservativeData: number[] = []

  let optimistic = currentSavings
  let conservative = currentSavings

  for (let y = 1; y <= years; y++) {
    optimistic = optimistic * 1.07 + monthlySavings * 12
    conservative = conservative * 1.04 + monthlySavings * 0.7 * 12
    if (y % 5 === 0 || y === 1 || y === years) {
      labels.push(`Year ${y}`)
      optimisticData.push(Math.round(optimistic))
      conservativeData.push(Math.round(conservative))
    }
  }
  return { labels, optimisticData, conservativeData }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { messages, profile, topic } = req.body

    const totalAssets = profile?.assets?.reduce((s: number, a: any) => s + (a.value || 0), 0) || 0
    const totalDebts = profile?.debts?.reduce((s: number, d: any) => s + (d.balance || 0), 0) || 0
    const totalDebtPayments = profile?.debts?.reduce((s: number, d: any) => s + (d.minimum_payment || 0), 0) || 0
    const availableToSave = (profile?.monthly_income || 0) - (profile?.monthly_expenses || 0) - totalDebtPayments
    const retirementAssets = profile?.assets?.filter((a: any) => a.category === 'retirement')?.reduce((s: number, a: any) => s + (a.value || 0), 0) || 0

    const profileSummary = profile ? `
USER'S FINANCIAL PROFILE:
- Monthly Income: $${profile.monthly_income}
- Monthly Expenses: $${profile.monthly_expenses}
- Available to save/mo: $${availableToSave}
- Total Assets: $${totalAssets}
- Total Debts: $${totalDebts}
- Assets: ${profile.assets?.map((a: any) => `${a.name} ($${a.value}${a.holdings ? `, holds: ${a.holdings}` : ''})`).join(', ') || 'none'}
- Debts: ${profile.debts?.map((d: any) => `${d.name}: $${d.balance} at ${d.interest_rate}%, min payment $${d.minimum_payment}`).join(', ') || 'none'}
- Goals: ${profile.goals?.map((g: any) => `${g.name}: target $${g.target_amount}, saved $${g.current_amount}`).join(', ') || 'none'}
- Additional context: ${profile.additional_context || 'none'}
` : ''

    const topicContext: Record<string, string> = {
      debt: 'Focus on debt elimination strategies, interest rates, payoff timelines, and balancing debt payoff with investing.',
      retirement: 'Focus on retirement planning, projected retirement age, Roth IRA and 401k strategies, compound growth, and passive income.',
      investment: 'Focus on investment strategies, asset allocation, index funds, risk tolerance, and growing wealth over time.',
      general: 'Cover any financial topic the user asks about.'
    }

    const systemPrompt = `You are a personal financial advisor — honest, clear, and genuinely helpful. You know this person's exact financial situation.

${profileSummary}

TOPIC FOCUS: ${topicContext[topic] || topicContext.general}

COMMUNICATION STYLE:
- Explain financial terms in plain simple language
- Be honest and unbiased — give real opinions
- Format responses with line breaks and short paragraphs
- Number steps when giving a plan (1. 2. 3.)
- Keep responses focused and digestible
- Always reference their actual numbers
- End with one clear next step

CHART INSTRUCTIONS:
When the user asks for a chart or when a chart would genuinely help, include one of these exact tags at the END of your response.
For debt payoff, include the exact monthly payment you recommend:

For debt payoff chart: [CHART:debt_payoff:PAYMENT_AMOUNT] (replace PAYMENT_AMOUNT with exact dollar amount)
For retirement projection: [CHART:retirement]
For goal progress: [CHART:goals]
For income vs expenses breakdown: [CHART:budget]
For asset allocation: [CHART:assets]

Only use a chart tag when it adds real value. Never include more than one chart per response.`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1200
    })

    let message = completion.choices[0]?.message?.content ?? 'Something went wrong.'
    let chartData = null

    const chartMatch = message.match(/\[CHART:(\w+)(?::(\d+))?\]/)
    if (chartMatch) {
      message = message.replace(/\[CHART:[\w:]+\]/, '').trim()
      const chartType = chartMatch[1]
      const chartParam = chartMatch[2] ? parseFloat(chartMatch[2]) : null

      if (chartType === 'debt_payoff' && profile?.debts?.length > 0) {
        const debt = profile.debts[0]
        const payment = chartParam || Math.min(availableToSave * 0.8, debt.balance)
        const { labels, data } = calcDebtPayoff(debt.balance, payment, debt.interest_rate)
        chartData = {
          type: 'line',
          title: `${debt.name} Payoff at $${payment.toLocaleString()}/mo`,
          labels,
          datasets: [{ label: 'Remaining Balance', data, color: '#f87171' }]
        }
      }

      else if (chartType === 'retirement') {
        const monthlySavings = Math.max(availableToSave * 0.5, 500)
        const { labels, optimisticData, conservativeData } = calcRetirementProjection(retirementAssets, monthlySavings)
        chartData = {
          type: 'line',
          title: 'Retirement Projection',
          labels,
          datasets: [
            { label: 'Optimistic (7% return)', data: optimisticData, color: '#34d399' },
            { label: 'Conservative (4% return)', data: conservativeData, color: '#fbbf24' }
          ]
        }
      }

      else if (chartType === 'goals' && profile?.goals?.length > 0) {
        chartData = {
          type: 'bar',
          title: 'Goal Progress',
          labels: profile.goals.map((g: any) => g.name.slice(0, 20)),
          datasets: [
            { label: 'Saved So Far', data: profile.goals.map((g: any) => g.current_amount), color: '#34d399' },
            { label: 'Target Amount', data: profile.goals.map((g: any) => g.target_amount), color: '#6366f1' }
          ]
        }
      }

      else if (chartType === 'budget') {
        chartData = {
          type: 'doughnut',
          title: 'Monthly Budget Breakdown',
          labels: ['Living Expenses', 'Debt Payments', 'Available to Save'],
          datasets: [{
            label: 'Monthly Budget',
            data: [
              profile.monthly_expenses || 0,
              totalDebtPayments,
              Math.max(0, availableToSave)
            ],
            color: '#34d399'
          }]
        }
      }

      else if (chartType === 'assets' && profile?.assets?.length > 0) {
        chartData = {
          type: 'doughnut',
          title: 'Asset Allocation',
          labels: profile.assets.map((a: any) => a.name.slice(0, 20)),
          datasets: [{
            label: 'Value',
            data: profile.assets.map((a: any) => a.value),
            color: '#34d399'
          }]
        }
      }
    }

    res.json({ message, chartData })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to analyze finances' })
  }
}
