import { useState } from 'react'
import { MessageCircle, Phone, Bot } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { isValidPhoneNumber } from '@/lib/utils'
import toast from 'react-hot-toast'

// Country codes list (subset — commonly used)
const COUNTRY_CODES = [
  { name: 'India', code: 'IN', dial: '+91', flag: '🇮🇳' },
  { name: 'United States', code: 'US', dial: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: 'GB', dial: '+44', flag: '🇬🇧' },
  { name: 'United Arab Emirates', code: 'AE', dial: '+971', flag: '🇦🇪' },
  { name: 'Australia', code: 'AU', dial: '+61', flag: '🇦🇺' },
  { name: 'Canada', code: 'CA', dial: '+1', flag: '🇨🇦' },
  { name: 'Germany', code: 'DE', dial: '+49', flag: '🇩🇪' },
  { name: 'Singapore', code: 'SG', dial: '+65', flag: '🇸🇬' },
  { name: 'Malaysia', code: 'MY', dial: '+60', flag: '🇲🇾' },
  { name: 'Sri Lanka', code: 'LK', dial: '+94', flag: '🇱🇰' },
]

interface ChatAccessPageProps {
  botName?: string
  botPhone?: string
  welcomeMessage?: string
}

export default function ChatAccessPage({ botName = 'AI Assistant', botPhone, welcomeMessage = 'Hello! How can I help you today?' }: ChatAccessPageProps) {
  const [dialCode, setDialCode] = useState('+91')
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')

  const fullNumber = `${dialCode}${number.replace(/^0+/, '')}`

  const validate = () => {
    if (!number.trim()) { setError('Please enter your mobile number'); return false }
    if (!isValidPhoneNumber(fullNumber)) { setError('Enter a valid mobile number (7–15 digits)'); return false }
    setError('')
    return true
  }

  const startChat = () => {
    if (!validate()) return
    if (!botPhone) {
      toast.error('This chatbot does not have a WhatsApp number connected yet.')
      return
    }
    const cleanBot = botPhone.replace(/\D/g, '')
    const waUrl = `https://wa.me/${cleanBot}?text=${encodeURIComponent(welcomeMessage)}`
    window.open(waUrl, '_blank')
    toast.success('Opening WhatsApp...')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Bot header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Bot className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{botName}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">AI-powered assistant — respond instantly, 24/7</p>
        </div>

        {/* Phone input card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Start a conversation</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Enter your WhatsApp number to begin chatting. The bot will reply to your messages.
          </p>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Mobile number
              </label>
              <div className="flex gap-2">
                {/* Country code selector */}
                <div className="relative">
                  <select
                    className="appearance-none bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-7 text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
                    value={dialCode}
                    onChange={(e) => setDialCode(e.target.value)}
                    aria-label="Country code"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={`${c.code}-${c.dial}`} value={c.dial}>
                        {c.flag} {c.dial}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Number input */}
                <div className="flex-1 relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    className="block w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="9876543210"
                    value={number}
                    onChange={(e) => { setNumber(e.target.value.replace(/\D/g, '')); setError('') }}
                    onKeyDown={(e) => e.key === 'Enter' && startChat()}
                    maxLength={15}
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
              {number && !error && isValidPhoneNumber(fullNumber) && (
                <p className="text-xs text-green-600 dark:text-green-400">✓ {fullNumber}</p>
              )}
            </div>

            <Button
              onClick={startChat}
              className="w-full bg-green-600 hover:bg-green-700 focus:ring-green-500"
              size="lg"
              icon={<MessageCircle className="w-5 h-5" />}
            >
              Start WhatsApp Chat
            </Button>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">
            By starting a chat, you consent to receiving messages on WhatsApp.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by RAG ChatBot AI
        </p>
      </div>
    </div>
  )
}
