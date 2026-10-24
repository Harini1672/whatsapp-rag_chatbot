import { Bell, Sun, Moon, Menu } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'

interface TopBarProps {
  title: string
  subtitle?: string
  onMenuToggle?: () => void
}

export function TopBar({ title, subtitle, onMenuToggle }: TopBarProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-6 gap-4">
      {onMenuToggle && (
        <Button variant="ghost" size="sm" onClick={onMenuToggle} className="md:hidden">
          <Menu className="w-5 h-5" />
        </Button>
      )}

      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="sm" aria-label="Notifications">
          <Bell className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}
