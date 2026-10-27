import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { wakeUpBackend } from '@/lib/api'

// Pages
import LandingPage from '@/pages/LandingPage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import ChatbotPage from '@/pages/chatbot/ChatbotPage'
import WhatsAppPage from '@/pages/whatsapp/WhatsAppPage'
import DocumentsPage from '@/pages/documents/DocumentsPage'
import KnowledgeBasePage from '@/pages/knowledge/KnowledgeBasePage'
import ConversationsPage from '@/pages/conversations/ConversationsPage'
import AnalyticsPage from '@/pages/analytics/AnalyticsPage'
import SupportPage from '@/pages/support/SupportPage'
import QRCodePage from '@/pages/qrcode/QRCodePage'
import SettingsPage from '@/pages/settings/SettingsPage'
import ChatAccessPage from '@/pages/chat/ChatAccessPage'

export default function App() {
  // Wake up the Render backend on app start (free tier sleeps after 15 min)
  useEffect(() => {
    wakeUpBackend()
  }, [])
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/chat" element={<ChatAccessPage />} />

            {/* Protected Admin */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/chatbot" element={<ChatbotPage />} />
                <Route path="/whatsapp" element={<WhatsAppPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
                <Route path="/conversations" element={<ConversationsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/qr-code" element={<QRCodePage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--toast-bg, #fff)',
              color: 'var(--toast-color, #111827)',
              border: '1px solid var(--toast-border, #e5e7eb)',
              borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  )
}
