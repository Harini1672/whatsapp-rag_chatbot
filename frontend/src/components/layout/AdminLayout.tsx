import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview of your chatbot activity' },
  '/chatbot': { title: 'Chatbot Configuration', subtitle: 'Customize your AI assistant' },
  '/whatsapp': { title: 'WhatsApp Connection', subtitle: 'Manage your WhatsApp session' },
  '/documents': { title: 'Document Upload', subtitle: 'Upload and manage knowledge base files' },
  '/knowledge-base': { title: 'Knowledge Base', subtitle: 'Manage indexed documents and embeddings' },
  '/conversations': { title: 'Conversations', subtitle: 'View all WhatsApp conversations' },
  '/analytics': { title: 'Analytics', subtitle: 'Performance metrics and insights' },
  '/support': { title: 'Human Support', subtitle: 'Manage customer support requests' },
  '/qr-code': { title: 'QR Code Generator', subtitle: 'Share your chatbot access link' },
  '/settings': { title: 'Settings', subtitle: 'Account and application settings' },
}

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const matchedKey = Object.keys(pageTitles).find((key) =>
    location.pathname.startsWith(key)
  )
  const pageInfo = matchedKey ? pageTitles[matchedKey] : { title: 'RAG ChatBot' }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar title={pageInfo.title} subtitle={pageInfo.subtitle} />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
