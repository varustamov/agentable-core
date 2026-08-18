import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '../api/client'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useState } from 'react'

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6, 'At least 6 characters'),
  job_title: z.string().optional(),
  company: z.string().optional(),
  social_url: z.string().url('Enter a valid URL').optional().or(z.literal('')),
})
type Form = z.infer<typeof schema>

export default function Register() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')
  const prefilledUrl = (location.state as any)?.prefilledUrl ?? ''

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: Form) => {
    setError('')
    try {
      const res = await authApi.register(data.email, data.password, data.name, data.job_title, data.company, data.social_url || undefined)
      setAuth(res.data.user, res.data.access_token)
      navigate('/dashboard', { state: { prefilledUrl } })
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-brand-purple/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-1/3 left-1/4 w-64 h-64 bg-brand-yellow/8 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      <Link to="/" className="relative flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-brand-yellow flex items-center justify-center">
          <span className="text-brand-black text-sm font-black">AI</span>
        </div>
        <span className="font-bold text-white tracking-tight">Agentable?</span>
      </Link>

      <div className="relative w-full max-w-sm">
        <div className="glass rounded-2xl p-8">
          <h1 className="text-xl font-bold text-white mb-1">Create account</h1>
          <p className="text-brand-muted text-sm mb-6">Start auditing for free — no card needed</p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First name"
                type="text"
                placeholder="Alex"
                autoComplete="given-name"
                {...register('name')}
              />
              <Input
                label="Company"
                type="text"
                placeholder="Acme Inc."
                autoComplete="organization"
                {...register('company')}
              />
            </div>
            <Input
              label="Job title"
              type="text"
              placeholder="Head of Marketing, SEO Lead..."
              autoComplete="organization-title"
              {...register('job_title')}
            />
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
              placeholder="Min. 6 characters"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Social profile (optional)"
              type="url"
              placeholder="https://x.com/yourhandle or LinkedIn/Instagram"
              hint="X, LinkedIn, Instagram or any public profile URL"
              error={errors.social_url?.message}
              {...register('social_url')}
            />

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" loading={isSubmitting} className="mt-1 w-full">
              Create account
            </Button>
          </form>

          <p className="text-center text-brand-muted text-xs mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-yellow hover:text-brand-yellow-dim transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
