import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard, MessageSquare, FileText, Database, BarChart3,
  Settings, HeadphonesIcon, QrCode, Wifi, Bot, LogOut, ChevronLeft,
  ChevronRight, Building2
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/chatbot', label: 'Chatbot Config', icon: Bot },
  { to: '/whatsapp', label: 'WhatsApp', icon: Wifi },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/knowledge-base', label: 'Knowledge Base', icon: Database },
  { to: '/conversations', label: 'Conversations', icon: MessageSquare },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/support', label: 'Support', icon: HeadphonesIcon },
  { to: '/qr-code', label: 'QR Code', icon: QrCode },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { profile, signOut } = useAuth()

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-gray-900 text-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-gray-800', collapsed && 'justify-center px-2')}>
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-semibold text-sm leading-tight">RAG ChatBot</p>
            <p className="text-xs text-gray-400 leading-tight">Admin Panel</p>
          </div>
        )}
      </div>

      {/* Org info */}
      {!collapsed && profile?.org_name && (
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-300 truncate">{profile.org_name}</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-800 p-2">
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-white truncate">{profile?.email || '...'}</p>
            <p className="text-xs text-gray-400 capitalize">{profile?.role || 'admin'}</p>
          </div>
        )}
        <button
          onClick={() => signOut()}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium',
            'text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors mt-1"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  )
}
