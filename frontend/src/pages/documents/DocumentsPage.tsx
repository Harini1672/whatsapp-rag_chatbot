import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Trash2, RefreshCw, Search, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Input } from '@/components/ui/Input'
import { bytesToSize, formatDate } from '@/lib/utils'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import type { Document } from '@/types/database'

const statusConfig = {
  pending: { label: 'Pending', variant: 'default' as const, icon: Clock },
  processing: { label: 'Processing', variant: 'info' as const, icon: RefreshCw },
  indexed: { label: 'Indexed', variant: 'success' as const, icon: CheckCircle },
  error: { label: 'Error', variant: 'danger' as const, icon: XCircle },
}

interface DocumentWithChatbot extends Document {
  chatbot_name?: string
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentWithChatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChatbot, setSelectedChatbot] = useState('')
  const [chatbots, setChatbots] = useState<{ id: string; name: string }[]>([])

  const fetchDocuments = useCallback(() => {
    api.get('/documents').then((res) => setDocuments(res.data.items || [])).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    api.get('/chatbots').then((res) => setChatbots(res.data.items || []))
    fetchDocuments()
  }, [fetchDocuments])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!selectedChatbot) {
      toast.error('Please select a chatbot first')
      return
    }
    setUploading(true)
    let successCount = 0
    for (const file of acceptedFiles) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('chatbot_id', selectedChatbot)
        await api.post('/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        successCount++
      } catch (err) {
        toast.error(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded and queued for indexing`)
      fetchDocuments()
    }
    setUploading(false)
  }, [selectedChatbot, fetchDocuments])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
  })

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.name}"? This will remove the document and all its embeddings.`)) return
    try {
      await api.delete(`/documents/${doc.id}`)
      toast.success('Document deleted')
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const handleReindex = async (doc: Document) => {
    try {
      await api.post(`/documents/${doc.id}/reindex`)
      toast.success('Reindexing started')
      fetchDocuments()
    } catch {
      toast.error('Failed to start reindexing')
    }
  }

  const filtered = documents.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-4xl space-y-6">
      {/* Upload area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>Upload PDF, DOCX, or TXT files to build your knowledge base. Max 10MB per file.</CardDescription>
        </CardHeader>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select chatbot to associate documents with
          </label>
          <select
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={selectedChatbot}
            onChange={(e) => setSelectedChatbot(e.target.value)}
          >
            <option value="">Choose a chatbot...</option>
            {chatbots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Spinner size="md" />
              <p className="text-sm text-gray-500">Uploading files...</p>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {isDragActive ? 'Drop files here' : 'Drag & drop files here, or click to browse'}
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT — up to 10MB each</p>
            </>
          )}
        </div>
      </Card>

      {/* Document list */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
          <CardTitle className="flex-1">Uploaded Documents</CardTitle>
          <div className="w-64">
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchDocuments} icon={<RefreshCw className="w-4 h-4" />}>
            Refresh
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">{searchQuery ? 'No documents match your search' : 'No documents uploaded yet'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((doc) => {
              const cfg = statusConfig[doc.status]
              const StatusIcon = cfg.icon
              return (
                <div key={doc.id} className="px-6 py-4 flex items-start gap-4">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{doc.name}</p>
                      <Badge variant={cfg.variant}>
                        <StatusIcon className={`w-3 h-3 ${doc.status === 'processing' ? 'animate-spin' : ''}`} />
                        {cfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400">{bytesToSize(doc.file_size)}</span>
                      <span className="text-xs text-gray-400">{doc.chunk_count} chunks</span>
                      <span className="text-xs text-gray-400">{formatDate(doc.created_at)}</span>
                    </div>
                    {doc.status === 'error' && doc.error_message && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-600 dark:text-red-400">
                        <AlertCircle className="w-3 h-3" />
                        {doc.error_message}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(doc.status === 'error' || doc.status === 'indexed') && (
                      <Button variant="outline" size="sm" onClick={() => handleReindex(doc)} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                        Reindex
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(doc)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
