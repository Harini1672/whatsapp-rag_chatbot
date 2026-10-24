import { useState, useEffect } from 'react'
import { MessageSquare, User, Search, ChevronRight, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatRelativeTime, formatDate } from '@/lib/utils'
import api from '@/lib/api'
import type { Conversation, Message } from '@/types/database'

interface ConversationWithMessages extends Conversation {
  messages?: Message[]
  chatbot_name?: string
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<ConversationWithMessages[]>([])
  const [selected, setSelected] = useState<ConversationWithMessages | null>(null)
  const [loading, setLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/conversations?limit=50').then((res) => {
      setConversations(res.data.items || [])
    }).finally(() => setLoading(false))
  }, [])

  const openConversation = async (conv: ConversationWithMessages) => {
    if (selected?.id === conv.id) { setSelected(null); return }
    setSelected(conv)
    setMsgLoading(true)
    try {
      const res = await api.get(`/conversations/${conv.id}/messages`)
      setSelected({ ...conv, messages: res.data.items || [] })
    } finally {
      setMsgLoading(false)
    }
  }

  const filtered = conversations.filter((c) =>
    c.user_phone.includes(search) || (c.chatbot_name || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="flex gap-6 h-[calc(100vh-10rem)]">
      {/* Conversation list */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3">
        <Input
          placeholder="Search by phone or bot..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No conversations found</div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={`w-full text-left rounded-xl border p-4 transition-colors ${
                  selected?.id === conv.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{conv.user_phone}</p>
                    <p className="text-xs text-gray-400">{formatRelativeTime(conv.last_message_at)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={conv.status === 'active' ? 'success' : conv.status === 'human_takeover' ? 'warning' : 'default'} dot>
                    {conv.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-gray-400">{conv.message_count} msgs</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message thread */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <Card className="h-full flex items-center justify-center">
            <div className="text-center text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Select a conversation to view messages</p>
            </div>
          </Card>
        ) : (
          <Card padding="none" className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{selected.user_phone}</p>
                <p className="text-xs text-gray-500">{selected.chatbot_name} · {formatDate(selected.created_at)}</p>
              </div>
              <Badge variant={selected.status === 'active' ? 'success' : selected.status === 'human_takeover' ? 'warning' : 'default'} dot className="ml-auto">
                {selected.status.replace('_', ' ')}
              </Badge>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              {msgLoading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : selected.messages?.length === 0 ? (
                <div className="text-center text-gray-400 py-10 text-sm">No messages</div>
              ) : (
                selected.messages?.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.source_documents && Array.isArray(msg.source_documents) && msg.source_documents.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-indigo-500/30">
                          <p className="text-xs opacity-70 mb-1">Sources:</p>
                          {(msg.source_documents as { document_name: string; score: number }[]).map((src, i) => (
                            <p key={i} className="text-xs opacity-60">
                              📄 {src.document_name} ({(src.score * 100).toFixed(0)}% match)
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs opacity-50">{formatRelativeTime(msg.created_at)}</p>
                        {msg.role === 'assistant' && (
                          <div className="flex gap-1">
                            <button className="opacity-50 hover:opacity-100 transition-opacity"><ThumbsUp className="w-3 h-3" /></button>
                            <button className="opacity-50 hover:opacity-100 transition-opacity"><ThumbsDown className="w-3 h-3" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reply (admin manual reply for human takeover) */}
            {selected.status === 'human_takeover' && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <AdminReplyBox conversationId={selected.id} userPhone={selected.user_phone} />
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

function AdminReplyBox({ conversationId, userPhone }: { conversationId: string; userPhone: string }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      await api.post(`/conversations/${conversationId}/reply`, { message: text, user_phone: userPhone })
      setText('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex gap-2">
      <input
        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Type your manual reply..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
      />
      <Button size="sm" onClick={send} loading={sending}>Send</Button>
    </div>
  )
}
