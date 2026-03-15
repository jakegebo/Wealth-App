import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const TOPIC_STARTERS: Record<string, string> = {
  debt: "I've looked at your debt situation. Let's build a real plan to eliminate it. What's your biggest concern — the total amount, the interest, or figuring out where to start?",
  retirement: "Let's talk retirement. Based on your income and savings rate, I can help you figure out when you can actually retire and what needs to change to get there faster. What's your target retirement age?",
  investment: "Let's talk about growing your wealth. I can see what you're working with — let's make sure your money is working as hard as possible. What aspect of investing do you want to tackle first?",
  general: "I've reviewed your finances. I give honest, unbiased advice based on your actual numbers — no generic tips. What do you want to know?"
}

export default function Chat() {
  const navigate = useNavigate()
  const { id } = useParams()
  const location = useLocation()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [chatTitle, setChatTitle] = useState('New Chat')
  const [editingTitle, setEditingTitle] = useState(false)
  const [topic, setTopic] = useState('general')
  const bottomRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadData()
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus()
  }, [editingTitle])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileData) setProfile(profileData.profile_data)

    if (id) {
      const { data: chatData } = await supabase
        .from('chats')
        .select('*')
        .eq('id', id)
        .single()

      if (chatData) {
        setChatTitle(chatData.title)
        setTopic(chatData.topic)

        if (chatData.messages.length > 0) {
          setMessages(chatData.messages)
        } else if (!initialized.current) {
          initialized.current = true
          const welcome = TOPIC_STARTERS[chatData.topic] || TOPIC_STARTERS.general
          const welcomeMsg: Message = { role: 'assistant', content: welcome }
          setMessages([welcomeMsg])
          await saveMessages([welcomeMsg])

          const prompt = location.state?.prompt
          if (prompt) {
            setTimeout(() => sendMessageWithText(prompt, [welcomeMsg], profileData?.profile_data), 100)
          }
        }
      }
    }
  }

  const saveMessages = async (msgs: Message[]) => {
    if (!id) return
    await supabase
      .from('chats')
      .update({ messages: msgs, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  const saveTitle = async (title: string) => {
    if (!id) return
    setChatTitle(title)
    setEditingTitle(false)
    await supabase.from('chats').update({ title }).eq('id', id)
  }

  const sendMessageWithText = async (text: string, currentMessages: Message[], profileData: any) => {
    const newMessages = [...currentMessages, { role: 'user' as const, content: text }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, profile: profileData, topic })
      })
      const data = await response.json()
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: data.message }]
      setMessages(finalMessages)
      await saveMessages(finalMessages)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setLoading(false)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMessage = input.trim()
    setInput('')
    await sendMessageWithText(userMessage, messages, profile)
  }

  const QUICK_PROMPTS: Record<string, string[]> = {
    debt: ["What's the fastest way to pay off my debt?", "Should I use avalanche or snowball method?", "Can I invest while paying off debt?"],
    retirement: ["When can I realistically retire?", "How much do I need to retire?", "Should I max my Roth IRA first?"],
    investment: ["Where should I put my extra money?", "What's the right asset allocation for my age?", "Should I invest in index funds or individual stocks?"],
    general: ["Give me an honest assessment of my finances", "What's my biggest financial mistake right now?", "What should I focus on this month?"]
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="border-b border-zinc-900 px-4 py-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/chats')} className="text-gray-400 hover:text-white transition-colors text-lg">
            ←
          </button>
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                defaultValue={chatTitle}
                onBlur={e => saveTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveTitle((e.target as HTMLInputElement).value)}
                className="bg-zinc-800 text-white rounded-lg px-2 py-1 text-sm font-semibold w-full focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            ) : (
              <button onClick={() => setEditingTitle(true)} className="text-left">
                <p className="font-semibold text-sm truncate hover:text-emerald-400 transition-colors">{chatTitle}</p>
                <p className="text-xs text-gray-500">Tap to rename</p>
              </button>
            )}
          </div>
          <div className="w-8 h-8 bg-emerald-400 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-black font-bold text-xs">AI</span>
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
              {msg.content.split('\n').map((line, j) => (
                <p key={j} className={line === '' ? 'h-2' : ''}>{line}</p>
              ))}
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
      {messages.length <= 1 && (
        <div className="px-4 pb-2 max-w-2xl mx-auto w-full">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(QUICK_PROMPTS[topic] || QUICK_PROMPTS.general).map((prompt, i) => (
              <button key={i} onClick={() => sendMessageWithText(prompt, messages, profile)}
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
