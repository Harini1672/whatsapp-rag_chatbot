import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Wifi, WifiOff, RefreshCw, Save, AlertTriangle, CheckCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import api from '@/lib/api'
import toast from 'react-hot-toast'

const schema = z.object({
  session_id: z.string().min(1, 'Session ID is required'),
  api_key: z.string().min(1, 'API key is required'),
  phone_number: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Enter a valid phone number'),
  chatbot_id: z.string().min(1, 'Select a chatbot'),
})

type FormData = z.infer<typeof schema>

interface ConnectionStatus {
  connected: boolean
  phone_number?: string
  session_id?: string
  last_checked?: string
}

interface Chatbot { id: string; name: string }

export default function WhatsAppPage() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    Promise.all([
      api.get('/whatsapp/status'),
      api.get('/chatbots'),
      api.get('/whatsapp/webhook-url'),
    ]).then(([statusRes, botsRes, webhookRes]) => {
      setStatus(statusRes.data)
      setChatbots(botsRes.data.items || [])
      setWebhookUrl(webhookRes.data.url || '')
      if (statusRes.data.session_id) {
        reset({
          session_id: statusRes.data.session_id,
          phone_number: statusRes.data.phone_number || '',
          api_key: '',
          chatbot_id: statusRes.data.chatbot_id || '',
        })
      }
    }).catch(() => {
      setStatus({ connected: false })
    }).finally(() => setLoading(false))
  }, [reset])

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      await api.post('/whatsapp/connect', data)
      toast.success('WhatsApp connection saved!')
      const res = await api.get('/whatsapp/status')
      setStatus(res.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save connection')
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect WhatsApp? The bot will stop responding to messages.')) return
    try {
      await api.post('/whatsapp/disconnect')
      setStatus({ connected: false })
      toast.success('WhatsApp disconnected')
    } catch {
      toast.error('Failed to disconnect')
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-3xl space-y-6">
      {/* Status card */}
      <Card>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${status?.connected ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
            {status?.connected
              ? <Wifi className="w-6 h-6 text-green-600 dark:text-green-400" />
              : <WifiOff className="w-6 h-6 text-gray-400" />
            }
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">WhatsApp Status</h3>
              <Badge variant={status?.connected ? 'success' : 'default'} dot>
                {status?.connected ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
            {status?.connected && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {status.phone_number} — Session: {status.session_id}
              </p>
            )}
          </div>
          {status?.connected && (
            <Button variant="danger" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          )}
        </div>
      </Card>

      {/* WasenderAPI info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <CardTitle>WasenderAPI Configuration</CardTitle>
          </div>
          <CardDescription>
            WasenderAPI requires a paid plan starting at $6/month. You need an active WasenderAPI account to use real WhatsApp messaging. All other features work without it.
          </CardDescription>
        </CardHeader>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium mb-1">How to get your credentials:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-600 dark:text-blue-400">
            <li>Create an account at <a href="https://wasenderapi.com" target="_blank" rel="noreferrer" className="underline">wasenderapi.com</a></li>
            <li>Subscribe to a plan and create a WhatsApp session</li>
            <li>Copy your Session ID and API Key</li>
            <li>Set the webhook URL below in your WasenderAPI dashboard</li>
          </ol>
        </div>
      </Card>

      {/* Webhook URL */}
      {webhookUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Webhook URL</CardTitle>
            <CardDescription>Configure this URL in your WasenderAPI dashboard to receive messages.</CardDescription>
          </CardHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-100 dark:bg-gray-900 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-800 dark:text-gray-200 overflow-x-auto">
              {webhookUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('Copied!') }}
            >
              Copy
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-3 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>This URL must be HTTPS and publicly accessible</span>
          </div>
        </Card>
      )}

      {/* Connection form */}
      <Card>
        <CardHeader>
          <CardTitle>Connect WhatsApp</CardTitle>
          <CardDescription>Enter your WasenderAPI credentials to enable real WhatsApp messaging.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Session ID"
              placeholder="your-session-id"
              error={errors.session_id?.message}
              {...register('session_id')}
            />
            <Input
              label="API Key"
              type="password"
              placeholder="sk-••••••••"
              error={errors.api_key?.message}
              helperText="Your WasenderAPI secret key"
              {...register('api_key')}
            />
          </div>
          <Input
            label="WhatsApp Phone Number"
            placeholder="+919876543210"
            error={errors.phone_number?.message}
            helperText="International format with country code"
            {...register('phone_number')}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Chatbot</label>
            <select
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              {...register('chatbot_id')}
            >
              <option value="">Select a chatbot...</option>
              {chatbots.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {errors.chatbot_id && <p className="text-xs text-red-600">{errors.chatbot_id.message}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} icon={<Save className="w-4 h-4" />}>
              Save Connection
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.reload()} icon={<RefreshCw className="w-4 h-4" />}>
              Refresh Status
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
