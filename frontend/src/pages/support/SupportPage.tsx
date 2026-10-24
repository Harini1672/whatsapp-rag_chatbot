import { useState, useEffect } from 'react'
import { HeadphonesIcon, CheckCircle, Clock, AlertCircle, MessageSquare } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatRelativeTime } from '@/lib/utils'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import type { SupportRequest } from '@/types/database'

const statusConfig = {
  pending: { variant: 'warning' as const, icon: Clock },
  in_progress: { variant: 'info' as const, icon: AlertCircle },
  resolved: { variant: 'success' as const, icon: CheckCircle },
}

export default function SupportPage() {
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all')

  const fetchRequests = () => {
    api.get('/support').then((res) => setRequests(res.data.items || [])).finally(() => setLoading(false))
  }

  useEffect(() => { fetchRequests() }, [])

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/support/${id}`, { status })
      toast.success('Status updated')
      fetchRequests()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const resolveAndResume = async (req: SupportRequest) => {
    try {
      await api.post(`/support/${req.id}/resolve`)
      toast.success('Resolved and AI responses resumed')
      fetchRequests()
    } catch {
      toast.error('Failed to resolve')
    }
  }

  const filtered = requests.filter((r) => filter === 'all' || r.status === filter)

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['pending', 'in_progress', 'resolved'] as const).map((s) => {
          const count = requests.filter((r) => r.status === s).length
          const cfg = statusConfig[s]
          const Icon = cfg.icon
          return (
            <div key={s} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                  <p className="text-sm text-gray-500 capitalize">{s.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'in_progress', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-300'
            }`}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Request list */}
      {filtered.length === 0 ? (
        <Card className="text-center py-16">
          <HeadphonesIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No support requests</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((req) => {
            const cfg = statusConfig[req.status]
            const StatusIcon = cfg.icon
            return (
              <Card key={req.id}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <HeadphonesIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{req.user_phone}</p>
                      <Badge variant={cfg.variant}>
                        <StatusIcon className="w-3 h-3" />
                        {req.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{req.reason}</p>
                    {req.admin_notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">Note: {req.admin_notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(req.created_at)}</p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {req.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(req.id, 'in_progress')} icon={<MessageSquare className="w-3.5 h-3.5" />}>
                        Take Over
                      </Button>
                    )}
                    {req.status === 'in_progress' && (
                      <Button size="sm" onClick={() => resolveAndResume(req)} icon={<CheckCircle className="w-3.5 h-3.5" />}>
                        Resolve & Resume AI
                      </Button>
                    )}
                    {req.status !== 'resolved' && (
                      <Button size="sm" variant="ghost" onClick={() => updateStatus(req.id, 'resolved')} className="text-green-600">
                        Mark Resolved
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
