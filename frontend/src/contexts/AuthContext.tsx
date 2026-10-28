import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session, createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, orgName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Cache of authenticated Supabase clients keyed by access token.
 * Prevents creating multiple GoTrueClient instances per render.
 */
const _authClientCache = new Map<string, ReturnType<typeof createClient>>()

function getAuthClient(accessToken: string) {
  if (_authClientCache.has(accessToken)) {
    return _authClientCache.get(accessToken)!
  }
  const client = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )
  _authClientCache.set(accessToken, client)
  // Keep cache small — only keep last 2 tokens
  if (_authClientCache.size > 2) {
    const firstKey = _authClientCache.keys().next().value
    _authClientCache.delete(firstKey)
  }
  return client
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (currentUser: User, accessToken: string) => {
    try {
      // Use authenticated client so auth.uid() works in RLS
      const authClient = getAuthClient(accessToken)

      const { data: member, error } = await authClient
        .from('organization_members')
        .select('role, org_id')
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (error) {
        console.warn('fetchProfile member error:', error.message)
        // Set minimal profile so the app still works
        setProfile({
          id: currentUser.id,
          email: currentUser.email || '',
          role: 'admin',
          org_id: null,
          org_name: null,
        })
        return
      }

      if (!member) {
        setProfile({
          id: currentUser.id,
          email: currentUser.email || '',
          role: 'admin',
          org_id: null,
          org_name: null,
        })
        return
      }

      // Fetch org name
      const { data: org } = await authClient
        .from('organizations')
        .select('id, name')
        .eq('id', (member as { org_id: string; role: string }).org_id)
        .maybeSingle()

      setProfile({
        id: currentUser.id,
        email: currentUser.email || '',
        role: (member as { role: string }).role as 'admin' | 'member',
        org_id: (member as { org_id: string }).org_id,
        org_name: (org as { name: string } | null)?.name || null,
      })
    } catch (err) {
      console.warn('fetchProfile exception:', err)
      setProfile({
        id: currentUser.id,
        email: currentUser.email || '',
        role: 'admin',
        org_id: null,
        org_name: null,
      })
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user && session.access_token) {
        fetchProfile(session.user, session.access_token).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user && session.access_token) {
        fetchProfile(session.user, session.access_token)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  const signUp = async (email: string, password: string, orgName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
    if (!data.user) throw new Error('Sign up failed — no user returned')

    // Wait for session to be ready
    await new Promise((resolve) => setTimeout(resolve, 800))

    // Get fresh session with access token
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Session not ready — please try signing in manually')

    const authClient = getAuthClient(token)

    // Create organization
    const { data: org, error: orgError } = await authClient
      .from('organizations')
      .insert({ name: orgName, owner_id: data.user.id })
      .select()
      .single()
    if (orgError) throw new Error(`Organization creation failed: ${orgError.message}`)

    // Create membership
    const { error: memberError } = await authClient
      .from('organization_members')
      .insert({
        org_id: (org as { id: string }).id,
        user_id: data.user.id,
        role: 'admin',
      })
    if (memberError) throw new Error(`Membership creation failed: ${memberError.message}`)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
