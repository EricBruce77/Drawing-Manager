import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email, password, fullName) => {
    // Check if email is allowed to sign up
    try {
      const { data: isAllowed, error: checkError } = await supabase.rpc(
        'is_email_allowed',
        { user_email: email.toLowerCase().trim() }
      )

      if (checkError) {
        console.error('Error checking email permission:', checkError)
        return {
          data: null,
          error: { message: 'Unable to verify email permission. Please contact your administrator.' }
        }
      }

      if (!isAllowed) {
        return {
          data: null,
          error: { message: 'This email is not authorized to access the system. Please contact your administrator to request access.' }
        }
      }
    } catch (err) {
      console.error('Error during email validation:', err)
      return {
        data: null,
        error: { message: 'Unable to validate email. Please try again later.' }
      }
    }

    // If email is allowed, proceed with signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    return { data, error }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const hasRole = (roles) => {
    if (!profile) return false
    if (Array.isArray(roles)) {
      return roles.includes(profile.role)
    }
    return profile.role === roles
  }

  const isAdmin = () => hasRole('admin')
  const canEdit = () => hasRole(['admin', 'engineer'])
  const canView = () => hasRole(['admin', 'engineer', 'viewer'])

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    hasRole,
    isAdmin,
    canEdit,
    canView,
    setProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}