import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const TOPICS = [
  { id: 'ideas', label: '💡 Income Ideas', description: 'Generate personalized money-making ideas' },
  { id: 'surplus', label: '💰 Deploy Surplus', description: 'Put your extra money to work' },
  { id: 'sidehustle', label: '⚡ Side Hustles', description: 'Fast ways to earn more income' },
  { id: 'passive', label: '📊 Passive Income', description: 'Build income that works while you sleep' },
]

function formatContent(content: string) {
  return content.split('\n').map((line, i) => {
    if (line.match(/^\d+\./)) return (
      <div key={i} className="flex gap-2 mt-1">
        <span className="text-emerald-400 font-bold shrink-0">{line.split('.')[0]}.</span>
        <span>{line.split('.').slice(1).join('.').trim()}</span>
      </div>
    )
    if (line.startsWith('- ') || line.startsWith('• ')) return (
      <div key={i} className="flex gap-2 mt-1">
        <span className="text-emerald-400 shrink-0">→</span>
        <span>{line.slice(2)}</span>
      </div>
    )
    if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-white mt-2">{line.slice(2, -2)}</p>
    if (line === '') return <div key={i} className="h-2" />
    return <p key={i}>{line}</p>
  })
}

export default function Money() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [ideas, setIdeas] = useState<string[]>([])
  const [savedIdeas, setSavedIdeas] = useState<string[]>([])
  const [chatRefs, setChatRefs] = useState<Record<string, string>>({})
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [activeTab, setActiveTab] = useState<'ideas' | 'saved' | 'chat'>('ideas')
  const [activeTopic, setActiveTopic] = useState('ideas')
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
    if (data) {
      setProfile(data.profile_data)
      setSavedIdeas(data.saved_income_ideas || [])
      setChatRefs(data.chat_refs || {})
      if (data.income_ideas?.length > 0) {
        setIdeas(data.income_ideas)
      } else {
        generateIdeas(data.profile_data)
      }
    }
  }

  const generateIdeas = async (profileData?: any) => {
    const p = profileData || profile
    if (!p) return
    setLoadingIdeas(true)
    try {
      const res = await fetch('/api/money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_ideas', profile: p })
      })
      const data = await res.json()
      const newIdeas = data.ideas || []
      setIdeas(newIdeas)
      if (userId) {
        await supabase.from('profiles').update({ income_ideas: newIdeas }).eq('user_id', userId)
      }
    } catch (err) { console.error(err) }
    setLoadingIdeas(false)
  }

  const toggleSaved = async (idea: string) => {
    const newSaved = savedIdeas.includes(idea)
      ? savedIdeas.filter(i => i !== idea)
      : [...savedIdeas, idea]
    setSavedIdeas(newSaved)
    if (userId) {
      await supabase.from('profiles').update({ saved_income_ideas: newSaved }).eq('user_id', userId)
    }
  }

  const openIdeaChat = async (idea: string) => {
    if (!userId) return
    const key = `money_idea_${idea.slice(0, 30)}`

    if (chatRefs[key]) {
      navigate(`/chat/${chatRefs[key]}`)
      return
    }

    const { data } = await supabase
      .from('chats')
      .insert({ user_id: userId, title: idea.slice(0, 40), topic: 'general', messages: [] })
      .select()
      .single()

    if (data) {
      const newRefs = { ...chatRefs, [key]: data.id }
      setChatRefs(newRefs)
      await supabase.from('profiles').update({ chat_refs: newRefs }).eq('user_id', userId)
      navigate(`/chat/${data.id}`, {
        state: {
          prompt: `I want to explore this income idea in detail: "${idea}". Tell me: 1) Average realistic income potential, 2) How long to start earning, 3) Exact steps to get started, 4) What skills or resources I need, 5) Whether this is active or passive income. Be specific to my financial situation.`
        }
      })
    }
  }

  const startTopicChat = async (topic: string) => {
    setActiveTopic(topic)
    setActiveTab('chat')
    setChatMessages([{
      role: 'assistant',
      content: topic === 'surplus'
        ? `You have $${((profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)).toLocaleString()}/mo available to deploy. Let's make sure every dollar is working as hard as possible for you. What's your priority — growing wealth faster, building passive income, or reducing risk?`
        : topic === 'sidehustle'
        ? `Let's find you a side hustle that fits your life. I'll be direct — most side hustles take real work to get going. What matters most to you: highest earning potential, fastest to start, or most aligned with your existing skills?`
        : topic === 'passive'
        ? `Passive income is real but takes either time or capital to build. You have $${((profile?.monthly_income || 0) - (profile?.monthly_expenses || 0)).toLocaleString()}/mo to work with. Let's figure out the best passive income strategy for your situation. What's your timeline?`
        : `I'm your make-money strategist. I'll give you specific, realistic ideas tailored to your situation. What kind of income are you most interested in — something you can start quickly, something that scales, or something that builds long-term wealth?`
    }])
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg: Message = { role: 'user', content: chatInput.trim() }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          profile,
          messages: newMessages,
          topic: activeTopic
        })
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setChatLoading(false)
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="border-b border-zinc-900 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white transition-colors">←</button>
            <div>
              <h1 className="font-semibold">Make Money</h1>
              <p className="text-xs text-gray-500">Income ideas & strategies tailored to you</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(['ideas', 'saved', 'chat'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors capitalize ${activeTab === tab ? 'bg-emerald-400 text-black' : 'bg-zinc-900 text-gray-400 hover:text-white border border-zinc-800'}`}>
                {tab === 'saved' ? `⭐ Saved (${savedIdeas.length})` : tab === 'chat' ? '💬 Strategist' : '💡 Ideas'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">

        {/* Ideas Tab */}
        {activeTab === 'ideas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-sm">Personalized for your situation</p>
              <button onClick={() => generateIdeas()} disabled={loadingIdeas}
                className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-gray-300 text-sm px-4 py-2 rounded-xl hover:border-emerald-400/50 transition-colors disabled:opacity-50">
                <span className={loadingIdeas ? 'animate-spin' : ''}>↻</span>
                {loadingIdeas ? 'Generating...' : 'Refresh Ideas'}
              </button>
            </div>

            {loadingIdeas ? (
              <div className="space-y-3">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800 animate-pulse">
                    <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-zinc-800 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {ideas.map((idea, i) => (
                  <div key={i} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                    <div className="p-5 flex items-start gap-4">
                      <div className="w-8 h-8 bg-emerald-400/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-emerald-400 font-bold text-sm">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium leading-relaxed">{idea}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => toggleSaved(idea)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${savedIdeas.includes(idea) ? 'bg-amber-400/20 text-amber-400' : 'bg-zinc-800 text-gray-500 hover:text-amber-400'}`}>
                          ⭐
                        </button>
                        <button onClick={() => openIdeaChat(idea)}
                          className="w-8 h-8 bg-emerald-400/10 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-400/20 transition-colors">
                          →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Saved Tab */}
        {activeTab === 'saved' && (
          <div className="space-y-4">
            {savedIdeas.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-4">⭐</p>
                <p className="text-white font-semibold mb-2">No saved ideas yet</p>
                <p className="text-gray-400 text-sm">Star ideas from the Ideas tab to save them here</p>
                <button onClick={() => setActiveTab('ideas')} className="mt-4 text-emerald-400 text-sm hover:underline">
                  Browse ideas →
                </button>
              </div>
            ) : (
              <>
                <p className="text-gray-400 text-sm">{savedIdeas.length} saved idea{savedIdeas.length !== 1 ? 's' : ''}</p>
                <div className="space-y-3">
                  {savedIdeas.map((idea, i) => (
                    <div key={i} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                      <div className="p-5 flex items-start gap-4">
                        <div className="w-8 h-8 bg-amber-400/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-amber-400">⭐</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium leading-relaxed">{idea}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => toggleSaved(idea)}
                            className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors text-xs">
                            ✕
                          </button>
                          <button onClick={() => openIdeaChat(idea)}
                            className="w-8 h-8 bg-emerald-400/10 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-emerald-400/20 transition-colors">
                            →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            {chatMessages.length === 0 && (
              <>
                <p className="text-gray-400 text-sm">Choose a focus area to get started</p>
                <div className="grid grid-cols-2 gap-3">
                  {TOPICS.map(topic => (
                    <button key={topic.id} onClick={() => startTopicChat(topic.id)}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-left hover:border-emerald-400/30 transition-colors">
                      <p className="text-lg mb-1">{topic.label}</p>
                      <p className="text-xs text-gray-400">{topic.description}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {chatMessages.length > 0 && (
              <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                  <p className="text-sm font-semibold">
                    {TOPICS.find(t => t.id === activeTopic)?.label || '💬 Strategist'}
                  </p>
                  <button onClick={() => setChatMessages([])} className="text-xs text-gray-500 hover:text-gray-300">
                    New topic
                  </button>
                </div>

                <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 bg-emerald-400 rounded-lg flex items-center justify-center shrink-0 mt-1">
                          <span className="text-black font-bold text-xs">$</span>
                        </div>
                      )}
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-emerald-400 text-black font-medium rounded-tr-sm' : 'bg-zinc-800 text-gray-100 rounded-tl-sm'}`}>
                        {msg.role === 'user' ? <p>{msg.content}</p> : <div className="space-y-0.5">{formatContent(msg.content)}</div>}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 bg-emerald-400 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-black font-bold text-xs">$</span>
                      </div>
                      <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex gap-1.5">
                          {[0,150,300].map(d => <div key={d} className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-zinc-800">
                  <div className="flex gap-2">
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                      placeholder="Ask about making money..."
                      className="flex-1 bg-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 text-sm" />
                    <button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}
                      className="w-10 h-10 bg-emerald-400 text-black rounded-xl font-bold hover:bg-emerald-300 transition-colors disabled:opacity-40 flex items-center justify-center">
                      ↑
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
