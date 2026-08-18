import { create } from 'zustand'
import type { User } from '../api/client'

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

const storedUser = localStorage.getItem('agentable_user')
const storedToken = localStorage.getItem('agentable_token')

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken ?? null,

  setAuth: (user, token) => {
    localStorage.setItem('agentable_user', JSON.stringify(user))
    localStorage.setItem('agentable_token', token)
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('agentable_user')
    localStorage.removeItem('agentable_token')
    set({ user: null, token: null })
  },
}))
