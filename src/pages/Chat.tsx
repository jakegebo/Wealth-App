import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function Chat() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (data) {
      setProfile(data.profile_data)
      setMessages([{
        role: 'assistant',
        content: `Hey — I've reviewed your finances. Net worth of $${(data.profile_data.assets?.reduce((s: number, a: any) => s + a.value, 0) || 0) - (data.profile_data.debts?.reduce((s: number, d: any) => s + d.balance, 0) || 0)} with $${data.profile_data.monthly_income}/mo coming in. I'm your financial analyst — I'll be straight with you, no sugarcoating. What do you want to know?`
      }])
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
          profile
        })
      })
      const data = await response.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-900 px-4 py-4 flex items-center justify-between max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white transition-colors">
            ←
          </button>
          <div className="w-8 h-8 bg-emerald-400 rounded-xl flex items-center justify-center">
            <span className="text-black font-bold text-sm">AI</span>
          </div>
          <div>
            <p className="font-semibold text-sm">Financial Analyst</p>
            <p className="text-xs text-emerald-400">Knows your finances</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-emerald-400 text-black font-medium'
                : 'bg-zinc-900 text-gray-100 border border-zinc-800'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 max-w-2xl mx-auto w-full">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              "Should I pay off my debt or invest?",
              "Am I on track to retire early?",
              "What should I do with my extra $4,500/mo?",
              "Be brutally honest about my finances"
            ].map((prompt, i) => (
              <button key={i} onClick={() => setInput(prompt)}
                className="shrink-0 text-xs bg-zinc-900 border border-zinc-800 rounded-full px-3 py-2 text-gray-300 hover:border-emerald-400 hover:text-emerald-400 transition-colors">
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-zinc-900 px-4 py-4 max-w-2xl mx-auto w-full">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask anything about your finances..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-400 text-sm"
          />
          <button onClick={sendMessage} disabled={loading || !input.trim()}
            className="bg-emerald-400 text-black font-semibold px-4 rounded-xl hover:bg-emerald-300 transition-colors disabled:opacity-50">
            →
          </button>
        </div>
      </div>
    </div>
  )
}
