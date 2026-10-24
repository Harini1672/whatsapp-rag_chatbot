import { useEffect, useState } from 'react'
import { MessageSquare, Users, CheckCircle, XCircle, HeadphonesIcon, ThumbsUp, Wifi, TrendingUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { formatRelativeTime } from '@/lib/utils'
import api from '@/lib/api'

interface DashboardData {
  stats: {
    total_messages: number
    total_conversations: number
    active_conversations: number
    answered: number
    unanswered: number
    support_requests: number
    positive_feedback: number
  }
  daily_messages: { date: string; count: number }[]
  top_questions: { question: string; count: number }[]
  recent_conversations: {
    id: string
    user_phone: string
    last_message: string
    status: string
    last_message_at: string
  }[]
  whatsapp_connected: boolean
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analytics/dashboard')
      .then((res) => setData(res.data))
      .catch(() => {
        // Provide skeleton structure on error so UI still renders
        setData({
          stats: { total_messages: 0, total_conversations: 0, active_conversations: 0, answered: 0, unanswered: 0, support_requests: 0, positive_feedback: 0 },
          daily_messages: [],
          top_questions: [],
          recent_conversations: [],
          whatsapp_connected: false,
        })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!data) return null

  const { stats } = data

  return (
    <div className="space-y-6">
      {/* WhatsApp status banner */}
      {!data.whatsapp_connected && (
        <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-5 py-3">
          <Wifi className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300 flex-1">
            WhatsApp is not connected. Go to the <a href="/whatsapp" className="font-semibold underline">WhatsApp page</a> to connect your number.
          </p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Messages" value={stats.total_messages.toLocaleString()} icon={<MessageSquare className="w-5 h-5" />} color="indigo" />
        <StatCard title="Active Conversations" value={stats.active_conversations.toLocaleString()} icon={<Users className="w-5 h-5" />} color="green" />
        <StatCard title="Answered Questions" value={stats.answered.toLocaleString()} icon={<CheckCircle className="w-5 h-5" />} color="blue" />
        <StatCard title="Unanswered Questions" value={stats.unanswered.toLocaleString()} icon={<XCircle className="w-5 h-5" />} color="yellow" />
        <StatCard title="Support Requests" value={stats.support_requests.toLocaleString()} icon={<HeadphonesIcon className="w-5 h-5" />} color="red" />
        <StatCard title="Positive Feedback" value={`${stats.positive_feedback}%`} icon={<ThumbsUp className="w-5 h-5" />} color="purple" />
        <StatCard title="Total Conversations" value={stats.total_conversations.toLocaleString()} icon={<TrendingUp className="w-5 h-5" />} color="indigo" />
        <StatCard
          title="WhatsApp Status"
          value={data.whatsapp_connected ? 'Connected' : 'Disconnected'}
          icon={<Wifi className="w-5 h-5" />}
          color={data.whatsapp_connected ? 'green' : 'red'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daily Messages (Last 14 Days)</CardTitle>
          </CardHeader>
          {data.daily_messages.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.daily_messages} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#msgGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
              No message data yet
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Questions</CardTitle>
          </CardHeader>
          {data.top_questions.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.top_questions.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="question" type="category" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
              No question data yet
            </div>
          )}
        </Card>
      </div>

      {/* Recent conversations */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <CardTitle>Recent Conversations</CardTitle>
        </div>
        {data.recent_conversations.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No conversations yet</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.recent_conversations.map((conv) => (
              <div key={conv.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{conv.user_phone}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{conv.last_message}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={conv.status === 'active' ? 'success' : conv.status === 'human_takeover' ? 'warning' : 'default'}>
                    {conv.status}
                  </Badge>
                  <span className="text-xs text-gray-400">{formatRelativeTime(conv.last_message_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
