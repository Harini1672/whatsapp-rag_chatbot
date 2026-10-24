import { useState } from 'react'
import { User, Bell, Shield, Save } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { user, profile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Account info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-gray-400" />
            <CardTitle>Account</CardTitle>
          </div>
          <CardDescription>Your account details and organization</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500">Organization</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile?.org_name || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-500">Role</span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{profile?.role || 'admin'}</span>
          </div>
        </div>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-gray-400" />
            <CardTitle>Appearance</CardTitle>
          </div>
        </CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark mode</p>
            <p className="text-xs text-gray-400">Currently: {theme}</p>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-gray-400" />
            <CardTitle>Security</CardTitle>
          </div>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <div className="space-y-4">
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min. 8 characters"
            helperText="Must be at least 8 characters"
          />
          <Button onClick={changePassword} loading={changingPassword} icon={<Save className="w-4 h-4" />}>
            Update Password
          </Button>
        </div>
      </Card>

      {/* API info */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys & Integrations</CardTitle>
          <CardDescription>External service credentials are stored securely in your backend environment variables. Never enter them here.</CardDescription>
        </CardHeader>
        <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
          <p>✓ OpenAI API key — set in backend <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-xs">OPENAI_API_KEY</code></p>
          <p>✓ Pinecone API key — set in backend <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-xs">PINECONE_API_KEY</code></p>
          <p>✓ WasenderAPI keys — stored per chatbot connection in the database (encrypted)</p>
          <p>✓ Supabase credentials — set in frontend <code className="bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-xs">.env</code></p>
        </div>
      </Card>
    </div>
  )
}
