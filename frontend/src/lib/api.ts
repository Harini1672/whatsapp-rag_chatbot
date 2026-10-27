import axios, { AxiosError } from 'axios'
import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_BASE,
  // 90 seconds — Render free tier cold start takes up to 50s
  timeout: 90000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Normalise error messages
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ detail: string }>) => {
    const message =
      error.response?.data?.detail ||
      error.message ||
      'An unexpected error occurred'
    return Promise.reject(new Error(message))
  }
)

/**
 * Wake up the Render backend if it is sleeping.
 * Call this once on app start — fire and forget.
 * Render free tier sleeps after 15 min of inactivity.
 * First request after sleep takes 30–50 seconds.
 */
export async function wakeUpBackend(): Promise<void> {
  try {
    await axios.get(`${API_BASE.replace('/api', '')}/api/health`, { timeout: 90000 })
  } catch {
    // Silently ignore — if it fails, individual page requests will retry
  }
}

export default api
