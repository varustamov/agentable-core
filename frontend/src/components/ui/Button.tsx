import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-black disabled:opacity-50 disabled:cursor-not-allowed select-none',
        {
          // variants
          'bg-brand-yellow text-brand-black hover:bg-brand-yellow-dim focus:ring-brand-yellow shadow-glow-yellow active:scale-[0.98]':
            variant === 'primary',
          'bg-brand-surface-3 text-brand-text border border-brand-border hover:bg-brand-surface-2 hover:border-brand-purple focus:ring-brand-purple':
            variant === 'secondary',
          'text-brand-muted hover:text-brand-text hover:bg-brand-surface-2 focus:ring-brand-border':
            variant === 'ghost',
          'bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 focus:ring-red-500':
            variant === 'danger',
          // sizes
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-5 py-2.5 text-sm': size === 'md',
          'px-7 py-3.5 text-base': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  )
}
