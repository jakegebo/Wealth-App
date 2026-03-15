import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Chat {
  id: string
  title: string
  topic: string
  messages: any[]
  updated_at: string
}

const PRESET_TOPICS = [
  { id: 'general', label: 'General', emoji: '💬', description: 'Ask anything about your finances' },
  { id: 'debt', label: 'Debt Plan', emoji: '💳', description: 'Strategy to eliminate your debt' },
  { id: 'retirement', label: 'Retirement', emoji: '🏖️', description: 'Plan your path to early retirement' },
  { id: 'investment', label: 'Investments', emoji: '📈', description: 'Grow your wealth strategically' },
]

export default function Chats() {
  const navigate = useNavigate()
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChats()
  }, [])

  const loadChats = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    setChats(data || [])
    setLoading(false)
  }

  const createChat = async (topic: string, title: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('chats')
      .insert({ user_id: user.id, title, topic, messages: [] })
      .select()
      .single()

    if (data) navigate(`/chat/${data.id}`)
  }

  const formatTime = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-zinc-900 px-4 py-4 flex items-center justify-between max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white transition-colors text-lg">
            ←
          </button>
          <h1 className="font-semibold">AI Financial Advisor</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Start a new chat */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Start a conversation</h2>
          <div className="grid grid-cols-2 gap-3">
            {PRESET_TOPICS.map(topic => (
              <button
                key={topic.id}
                onClick={() => createChat(topic.id, topic.label)}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-left hover:border-emerald-400/50 transition-colors"
              >
                <span className="text-2xl mb-2 block">{topic.emoji}</span>
                <p className="font-semibold text-sm">{topic.label}</p>
                <p className="text-xs text-gray-400 mt-1">{topic.description}</p>
              </button>
            ))}
          </div>

          <button
            onClick={() => createChat('general', 'New Chat')}
            className="w-full mt-3 border border-dashed border-zinc-700 rounded-2xl py-3 text-gray-400 hover:border-emerald-400 hover:text-emerald-400 transition-colors text-sm"
          >
            + Start a custom chat
          </button>
        </div>

        {/* Previous chats */}
        {chats.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Previous conversations</h2>
            <div className="space-y-2">
              {chats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => navigate(`/chat/${chat.id}`)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-left hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{PRESET_TOPICS.find(t => t.id === chat.topic)?.emoji ?? '💬'}</span>
                      <p className="font-semibold text-sm">{chat.title}</p>
                    </div>
                    <span className="text-xs text-gray-500">{formatTime(chat.updated_at)}</span>
                  </div>
                  {chat.messages.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {chat.messages[chat.messages.length - 1]?.content?.slice(0, 60)}...
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">{chat.messages.length} messages</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && chats.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-8">No conversations yet. Start one above!</p>
        )}
      </div>
    </div>
  )
}
