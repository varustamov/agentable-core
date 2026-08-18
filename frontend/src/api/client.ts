import axios from 'axios'

export const api = axios.create({
  baseURL: '/',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agentable_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('agentable_token')
      localStorage.removeItem('agentable_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  email: string
  name: string | null
  is_admin: boolean
  is_pro: boolean
  has_telegram: boolean
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export const authApi = {
  register: (email: string, password: string, name?: string, job_title?: string, company?: string, social_url?: string) =>
    api.post<AuthResponse>('/auth/register', { email, password, name, job_title, company, social_url }),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  me: () => api.get<User>('/auth/me'),
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface Check {
  check_id: string
  level: number
  name: string
  passed: boolean
  message: string
  recommendation: string | null
}

export interface AuditResult {
  id: number
  url: string
  level: number | null
  score: number | null
  max_score: number | null
  results: Check[]
  created_at: string
}

export const auditApi = {
  history: () => api.get<AuditResult[]>('/audit/history'),
  getById: (id: number) => api.get<AuditResult>(`/audit/${id}`),
  compare: (urls: string[]) => api.post<AuditResult[]>('/audit/compare', { urls }),
}

// ── Monitor ───────────────────────────────────────────────────────────────────

export interface WatchedDomain {
  id: number
  url: string
  last_level: number | null
  last_score: number | null
  last_max: number | null
  last_audit_at: string | null
  created_at: string
}

export const monitorApi = {
  list: () => api.get<WatchedDomain[]>('/monitor/watchlist'),
  add: (url: string) => api.post<WatchedDomain>('/monitor/watchlist', { url }),
  remove: (id: number) => api.delete(`/monitor/watchlist/${id}`),
  audit: (id: number) => api.post(`/monitor/watchlist/${id}/audit`),
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number
  email: string
  name: string | null
  job_title: string | null
  company: string | null
  social_url: string | null
  is_active: boolean
  is_admin: boolean
  is_pro: boolean
  created_at: string
  audit_count: number
  last_audit_at: string | null
  avg_level: number | null
}

export interface DayStats { date: string; audits: number; new_users: number }

export interface AdminStats {
  total_users: number
  active_users: number
  total_audits: number
  audits_today: number
  audits_this_week: number
  avg_level: number | null
  level_distribution: Record<string, number>
  daily: DayStats[]
  pro_users: number
  mrr_usd: number
  x402_payments: number
  x402_revenue_usd: number
  feature_usage: Record<string, number>
}

export interface AdminAudit {
  id: number
  url: string
  level: number | null
  score: number | null
  max_score: number | null
  created_at: string
}

export const adminApi = {
  stats: () => api.get<AdminStats>('/admin/stats'),
  users: (search = '') => api.get<AdminUser[]>(`/admin/users?search=${encodeURIComponent(search)}`),
  userAudits: (userId: number) => api.get<AdminAudit[]>(`/admin/users/${userId}/audits`),
  toggleAdmin: (userId: number) => api.post(`/admin/users/${userId}/toggle-admin`),
  toggleActive: (userId: number) => api.post(`/admin/users/${userId}/toggle-active`),
  togglePro: (userId: number) => api.post(`/admin/users/${userId}/toggle-pro`),
}

export function streamAudit(url: string, token: string, onCheck: (e: any) => void, onComplete: (e: any) => void, onError: (e: any) => void) {
  const ctrl = new AbortController()

  fetch('/audit/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
    signal: ctrl.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      onError({ message: `HTTP ${res.status}` })
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() ?? ''
      for (const block of lines) {
        const dataLine = block.trim().replace(/^data: /, '')
        if (!dataLine) continue
        try {
          const evt = JSON.parse(dataLine)
          if (evt.type === 'check') onCheck(evt)
          else if (evt.type === 'complete') onComplete(evt)
          else if (evt.type === 'error') onError(evt)
        } catch {}
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onError({ message: err.message })
  })

  return () => ctrl.abort()
}
