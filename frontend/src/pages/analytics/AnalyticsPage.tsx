import { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Spinner } from '@/components/ui/Spinner'
import { MessageSquare, Users, ThumbsUp, HelpCircle, HeadphonesIcon, TrendingUp } from 'lucide-react'
import api from '@/lib/api'
import type { AnalyticsSummary } from '@/types'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/analytics/summary').then((res) => setData(res.data)).catch(() => {
      setData({
        total_messages: 0, total_conversations: 0, active_conversations: 0,
        answered_questions: 0, unanswered_questions: 0, support_requests: 0,
        positive_feedback: 0, negative_feedback: 0, daily_messages: [], top_questions: [],
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!data) return null

  const feedbackData = [
    { name: 'Helpful', value: data.positive_feedback },
    { name: 'Not Helpful', value: data.negative_feedback },
  ]

  const resolutionData = [
    { name: 'Answered', value: data.answered_questions },
    { name: 'Unanswered', value: data.unanswered_questions },
    { name: 'Support', value: data.support_requests },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total Messages" value={data.total_messages.toLocaleString()} icon={<MessageSquare className="w-5 h-5" />} color="indigo" />
        <StatCard title="Conversations" value={data.total_conversations.toLocaleString()} icon={<Users className="w-5 h-5" />} color="blue" />
        <StatCard title="Answered" value={data.answered_questions.toLocaleString()} icon={<TrendingUp className="w-5 h-5" />} color="green" />
        <StatCard title="Unanswered" value={data.unanswered_questions.toLocaleString()} icon={<HelpCircle className="w-5 h-5" />} color="yellow" />
        <StatCard title="Support Requests" value={data.support_requests.toLocaleString()} icon={<HeadphonesIcon className="w-5 h-5" />} color="red" />
        <StatCard title="Positive Feedback" value={data.positive_feedback.toLocaleString()} icon={<ThumbsUp className="w-5 h-5" />} color="purple" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Daily Message Volume</CardTitle></CardHeader>
          {data.daily_messages.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.daily_messages} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Response Resolution</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={resolutionData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {resolutionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader><CardTitle>User Feedback</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={feedbackData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top 5 Questions</CardTitle></CardHeader>
          {data.top_questions.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.top_questions.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="question" type="category" width={130} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">No question data</div>
          )}
        </Card>
      </div>
    </div>
  )
}
