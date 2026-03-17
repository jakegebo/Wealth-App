import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../contexts/ThemeContext'

interface Analysis {
  netWorth: number
  totalAssets: number
  totalLiabilities: number
  monthlyIncome: number
  monthlyExpenses: number
  availableToSave: number
  savingsRate: number
  overallSummary: string
  nextActions: { priority: number; title: string; description: string; impact: string; timeframe: string }[]
  goals: { name: string; targetAmount: number; currentAmount: number; percentage: number; monthlyNeeded: number; feasibility: string }[]
  debts: { name: string; balance: number; interestRate: number; recommendedPayment: number; monthsToPayoff: number; strategy: string }[]
  incomeIdeas: string[]
}

interface StockQuote {
  symbol: string
  price: number
  change: number
  changePercent: string
}

interface Article {
  title: string
  url: string
  image: string
  source: string
  publishedAt: string
}

function CountUp({ value, prefix = '', duration = 1200 }: { value: number; prefix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef<number | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    if (!value) return
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp
      const progress = Math.min((timestamp - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(eased * value))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(display)
  return <span>{prefix}{formatted}</span>
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'good morning'
  if (h < 17) return 'good afternoon'
  return 'good evening'
}

export default function Home() {
  const navigate = useNavigate()
  const { preferences } = useTheme()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [news, setNews] = useState<Article[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [chatRefs, setChatRefs] = useState<Record<string, string>>({})
  const [firstName, setFirstName] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    setFirstName(user.email?.split('@')[0] || 'there')

    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (!data) { navigate('/onboarding'); return }

    setProfile(data.profile_data)
    setChatRefs(data.chat_refs || {})

    const wl = data.wa
