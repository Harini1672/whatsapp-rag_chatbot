export type UserRole = 'admin' | 'member'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  org_id: string | null
  org_name: string | null
}

export interface ApiResponse<T = unknown> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface AnalyticsSummary {
  total_messages: number
  total_conversations: number
  active_conversations: number
  answered_questions: number
  unanswered_questions: number
  support_requests: number
  positive_feedback: number
  negative_feedback: number
  daily_messages: { date: string; count: number }[]
  top_questions: { question: string; count: number }[]
}

export interface CountryCode {
  name: string
  code: string
  dial_code: string
  flag: string
}
