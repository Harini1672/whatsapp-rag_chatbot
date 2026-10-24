import { useState, useEffect, useRef } from 'react'
import QRCodeLib from 'qrcode'
import { Download, Copy, ExternalLink, QrCode, RefreshCw } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface Chatbot { id: string; name: string; phone_number?: string }

export default function QRCodePage() {
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [waLink, setWaLink] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    api.get('/chatbots').then((res) => {
      const bots = res.data.items || []
      setChatbots(bots)
      if (bots.length > 0) setSelectedId(bots[0].id)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedId) generateQR()
  }, [selectedId])  // eslint-disable-line

  const generateQR = async () => {
    if (!selectedId) return
    setGenerating(true)
    try {
      const res = await api.get(`/whatsapp/qr-data/${selectedId}`)
      const { whatsapp_link, phone_number, welcome_message } = res.data
      const link = whatsapp_link || `https://wa.me/${phone_number?.replace(/\D/g, '')}?text=${encodeURIComponent(welcome_message || 'Hello!')}`
      setWaLink(link)

      const dataUrl = await QRCodeLib.toDataURL(link, {
        width: 300,
        margin: 2,
        color: { dark: '#1e1b4b', light: '#ffffff' },
      })
      setQrDataUrl(dataUrl)
    } catch {
      toast.error('Could not generate QR code — ensure WhatsApp is connected')
    } finally {
      setGenerating(false)
    }
  }

  const downloadQR = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = 'chatbot-qr.png'
    a.click()
    toast.success('QR code downloaded')
  }

  const copyLink = () => {
    navigator.clipboard.writeText(waLink)
    toast.success('Link copied to clipboard')
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate QR Code</CardTitle>
          <CardDescription>
            Create a QR code that opens a WhatsApp conversation with your chatbot. Share it on websites, printed materials, or presentations.
          </CardDescription>
        </CardHeader>

        <div className="space-y-4">
          <Select
            label="Select chatbot"
            options={chatbots.map((b) => ({ value: b.id, label: b.name }))}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          />

          <Button variant="outline" onClick={generateQR} loading={generating} icon={<RefreshCw className="w-4 h-4" />}>
            Regenerate QR
          </Button>
        </div>
      </Card>

      {/* QR Display */}
      {qrDataUrl ? (
        <Card className="text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-200">
              <img src={qrDataUrl} alt="WhatsApp QR Code" className="w-56 h-56" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Scan with any phone camera to start chatting</p>

            {waLink && (
              <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 overflow-x-auto text-left">
                {waLink}
              </div>
            )}

            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={downloadQR} icon={<Download className="w-4 h-4" />}>
                Download QR
              </Button>
              <Button variant="outline" onClick={copyLink} icon={<Copy className="w-4 h-4" />}>
                Copy Link
              </Button>
              {waLink && (
                <Button variant="outline" onClick={() => window.open(waLink, '_blank')} icon={<ExternalLink className="w-4 h-4" />}>
                  Open WhatsApp
                </Button>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="text-center py-16">
          <QrCode className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Select a chatbot with a connected WhatsApp number to generate a QR code</p>
        </Card>
      )}
    </div>
  )
}
