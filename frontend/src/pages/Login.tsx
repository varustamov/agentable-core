import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useState } from 'react'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Required'),
})
type Form = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    setError('')
    try {
      const res = await authApi.login(data.email, data.password)
      setAuth(res.data.user, res.data.access_token)
      navigate('/dashboard')
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-brand-purple/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-brand-yellow/8 rounded-full blur-3xl animate-blob animation-delay-2000" />
      </div>

      {/* Logo */}
      <Link to="/" className="relative flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-brand-yellow flex items-center justify-center">
          <span className="text-brand-black text-sm font-black">AI</span>
        </div>
        <span className="font-bold text-white tracking-tight">Agentable?</span>
      </Link>

      {/* Card */}
      <div className="relative w-full max-w-sm">
        <div className="glass rounded-2xl p-8">
          <h1 className="text-xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-brand-muted text-sm mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" loading={isSubmitting} className="mt-1 w-full">
              Sign in
            </Button>
          </form>

          <p className="text-center text-brand-muted text-xs mt-5">
            No account?{' '}
            <Link to="/register" className="text-brand-yellow hover:text-brand-yellow-dim transition-colors font-medium">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
