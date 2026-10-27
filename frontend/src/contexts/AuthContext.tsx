import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (currentUser: User) => {
    try {
      // Use .maybeSingle() instead of .single() — no error if row missing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: member, error } = await (supabase as any)
        .from('organization_members')
        .select('role, org_id')
        .eq('user_id', currentUser.id)
        .maybeSingle()

      if (error) {
        console.warn('fetchProfile error:', error.message)
        return
      }

      if (!member) {
        // No org yet — set minimal profile so app still works
        setProfile({
          id: currentUser.id,
          email: currentUser.email || '',
          role: 'admin',
          org_id: null,
          org_name: null,
        })
        return
      }

      // Fetch org name separately to avoid join RLS issues
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: org } = await (supabase as any)
        .from('organizations')
        .select('id, name')
        .eq('id', member.org_id)
        .maybeSingle()

      setProfile({
        id: currentUser.id,
        email: currentUser.email || '',
        role: member.role as 'admin' | 'member',
        org_id: member.org_id,
        org_name: org?.name || null,
      })
    } catch (err) {
      console.warn('fetchProfile exception:', err)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user)
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

    // Small delay to ensure Supabase auth session is ready before DB inserts
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Create organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org, error: orgError } = await (supabase as any)
      .from('organizations')
      .insert({ name: orgName, owner_id: data.user.id })
      .select()
      .single()
    if (orgError) throw new Error(`Organization creation failed: ${orgError.message}`)

    // Create membership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: memberError } = await (supabase as any)
      .from('organization_members')
      .insert({ org_id: org.id, user_id: data.user.id, role: 'admin' })
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
