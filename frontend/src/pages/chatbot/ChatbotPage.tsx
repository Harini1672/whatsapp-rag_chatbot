import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Bot, Save, Trash2, Settings } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import type { Chatbot } from '@/types/database'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  personality: z.string().min(10, 'Describe the chatbot personality (min 10 chars)'),
  welcome_message: z.string().min(5, 'Welcome message required'),
  language: z.string(),
  tone: z.string(),
  response_mode: z.enum(['text', 'audio', 'text_to_audio', 'audio_to_audio']),
  max_response_length: z.number().min(50).max(2000),
  human_support_enabled: z.boolean(),
  confidence_threshold: z.number().min(0).max(1),
})

type FormData = z.infer<typeof schema>

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'te', label: 'Telugu' },
  { value: 'hi', label: 'Hindi' },
  { value: 'auto', label: 'Auto-detect' },
]

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'educational', label: 'Educational' },
  { value: 'customer_support', label: 'Customer Support' },
]

const MODE_OPTIONS = [
  { value: 'text', label: 'Text → Text' },
  { value: 'audio', label: 'Audio → Text' },
  { value: 'text_to_audio', label: 'Text → Audio' },
  { value: 'audio_to_audio', label: 'Audio → Audio' },
]

export default function ChatbotPage() {
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [selected, setSelected] = useState<Chatbot | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      language: 'auto',
      tone: 'professional',
      response_mode: 'text',
      max_response_length: 500,
      human_support_enabled: true,
      confidence_threshold: 0.5,
    },
  })

  const fetchChatbots = () => {
    api.get('/chatbots').then((res) => setChatbots(res.data.items || [])).finally(() => setLoading(false))
  }

  useEffect(() => { fetchChatbots() }, [])

  const openEdit = (bot: Chatbot) => {
    setSelected(bot)
    reset({
      name: bot.name,
      personality: bot.personality,
      welcome_message: bot.welcome_message,
      language: bot.language,
      tone: bot.tone,
      response_mode: bot.response_mode,
      max_response_length: bot.max_response_length,
      human_support_enabled: bot.human_support_enabled,
      confidence_threshold: bot.confidence_threshold,
    })
    setModalOpen(true)
  }

  const openCreate = () => {
    setSelected(null)
    reset({ language: 'auto', tone: 'professional', response_mode: 'text', max_response_length: 500, human_support_enabled: true, confidence_threshold: 0.5, name: '', personality: '', welcome_message: '' })
    setModalOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      if (selected) {
        await api.put(`/chatbots/${selected.id}`, data)
        toast.success('Chatbot updated')
      } else {
        await api.post('/chatbots', data)
        toast.success('Chatbot created')
      }
      setModalOpen(false)
      fetchChatbots()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (bot: Chatbot) => {
    if (!confirm(`Delete chatbot "${bot.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/chatbots/${bot.id}`)
      toast.success('Chatbot deleted')
      setChatbots((prev) => prev.filter((b) => b.id !== bot.id))
    } catch {
      toast.error('Failed to delete')
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm text-gray-500 dark:text-gray-400">Manage your AI assistants</h2>
        </div>
        <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
          New Chatbot
        </Button>
      </div>

      {chatbots.length === 0 ? (
        <Card className="text-center py-16">
          <Bot className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No chatbots yet. Create your first one.</p>
          <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />}>Create Chatbot</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {chatbots.map((bot) => (
            <Card key={bot.id}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{bot.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{bot.personality}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant="info">{bot.language.toUpperCase()}</Badge>
                    <Badge variant="purple">{bot.tone}</Badge>
                    <Badge variant="default">{bot.response_mode.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => openEdit(bot)} icon={<Settings className="w-3.5 h-3.5" />} className="flex-1">
                  Configure
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(bot)} className="text-red-500 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? `Edit: ${selected.name}` : 'Create New Chatbot'}
        description="Configure your AI assistant's personality and behavior."
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Chatbot name" placeholder="e.g. College Admission Bot" error={errors.name?.message} {...register('name')} />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Personality</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={3}
              placeholder="You are a helpful admission assistant for ABC College. You answer questions about courses, fees, and admission procedures based on the provided documents."
              {...register('personality')}
            />
            {errors.personality && <p className="text-xs text-red-600">{errors.personality.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Welcome message</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={2}
              placeholder="Hello! I'm your admission assistant. Ask me anything about courses, fees, or the admission process."
              {...register('welcome_message')}
            />
            {errors.welcome_message && <p className="text-xs text-red-600">{errors.welcome_message.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select label="Language" options={LANGUAGE_OPTIONS} {...register('language')} />
            <Select label="Communication tone" options={TONE_OPTIONS} {...register('tone')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select label="Response mode" options={MODE_OPTIONS} {...register('response_mode')} />
            <Input
              label="Max response length (chars)"
              type="number"
              {...register('max_response_length', { valueAsNumber: true })}
              error={errors.max_response_length?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Confidence threshold (0–1)"
              type="number"
              step="0.05"
              {...register('confidence_threshold', { valueAsNumber: true })}
              helperText="Below this score, escalate to human"
              error={errors.confidence_threshold?.message}
            />
            <div className="flex items-center gap-3 pt-6">
              <input type="checkbox" id="human_support" className="rounded" {...register('human_support_enabled')} />
              <label htmlFor="human_support" className="text-sm text-gray-700 dark:text-gray-300">
                Enable human support escalation
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} icon={<Save className="w-4 h-4" />}>
              {selected ? 'Save Changes' : 'Create Chatbot'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
