import { useState, useEffect } from 'react'
import { Search, Database, FileText, Hash, CheckCircle, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface KBSearchResult {
  document_name: string
  chunk_text: string
  score: number
  document_id: string
}

interface KBStats {
  total_documents: number
  total_chunks: number
  indexed_documents: number
  last_updated: string | null
}

export default function KnowledgeBasePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<KBSearchResult[]>([])
  const [stats, setStats] = useState<KBStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [selectedChatbot, setSelectedChatbot] = useState('')
  const [chatbots, setChatbots] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    Promise.all([
      api.get('/knowledge-base/stats'),
      api.get('/chatbots'),
    ]).then(([statsRes, botsRes]) => {
      setStats(statsRes.data)
      const bots = botsRes.data.items || []
      setChatbots(bots)
      if (bots.length > 0) setSelectedChatbot(bots[0].id)
    }).finally(() => setLoading(false))
  }, [])

  const search = async () => {
    if (!query.trim() || !selectedChatbot) return
    setSearching(true)
    try {
      const res = await api.post('/knowledge-base/search', { query, chatbot_id: selectedChatbot, top_k: 5 })
      setResults(res.data.results || [])
      if (res.data.results.length === 0) toast('No relevant chunks found for that query', { icon: '🔍' })
    } catch {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const reindexAll = async () => {
    if (!selectedChatbot) return
    if (!confirm('Reindex all documents for this chatbot? This may take a few minutes.')) return
    try {
      await api.post(`/knowledge-base/reindex-all/${selectedChatbot}`)
      toast.success('Reindexing started in background')
    } catch {
      toast.error('Failed to start reindexing')
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-4xl space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Documents', value: stats.total_documents, icon: FileText, color: 'text-indigo-600' },
            { label: 'Indexed Chunks', value: stats.total_chunks, icon: Hash, color: 'text-green-600' },
            { label: 'Indexed Docs', value: stats.indexed_documents, icon: CheckCircle, color: 'text-blue-600' },
            { label: 'Vector DB', value: 'Pinecone', icon: Database, color: 'text-purple-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <Icon className={`w-5 h-5 ${color} mb-2`} />
              <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Semantic Search</CardTitle>
          <CardDescription>Test what your chatbot will retrieve for a given question — exactly as the RAG system works.</CardDescription>
        </CardHeader>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <select
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
              value={selectedChatbot}
              onChange={(e) => setSelectedChatbot(e.target.value)}
            >
              {chatbots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <Input
              placeholder="e.g. What is the admission fee for B.Tech?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex gap-2 items-end">
            <Button onClick={search} loading={searching} icon={<Search className="w-4 h-4" />}>
              Search
            </Button>
            <Button variant="outline" onClick={reindexAll} icon={<RefreshCw className="w-4 h-4" />}>
              Reindex All
            </Button>
          </div>
        </div>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            Top {results.length} retrieved chunks:
          </p>
          {results.map((r, i) => (
            <Card key={i} className="border-l-4 border-l-indigo-500">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{r.document_name}</span>
                </div>
                <Badge variant={r.score > 0.8 ? 'success' : r.score > 0.6 ? 'info' : 'warning'}>
                  {(r.score * 100).toFixed(1)}% match
                </Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                {r.chunk_text}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
