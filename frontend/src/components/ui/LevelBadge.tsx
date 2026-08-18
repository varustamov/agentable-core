import { clsx } from 'clsx'

const LEVEL_CONFIG: Record<number, { label: string; color: string; bg: string; border: string }> = {
  0: { label: 'L0', color: 'text-red-400',           bg: 'bg-red-500/10',          border: 'border-red-500/40' },
  1: { label: 'L1', color: 'text-orange-400',        bg: 'bg-orange-500/10',       border: 'border-orange-500/40' },
  2: { label: 'L2', color: 'text-brand-yellow',      bg: 'bg-brand-yellow/10',     border: 'border-brand-yellow/40' },
  3: { label: 'L3', color: 'text-emerald-400',       bg: 'bg-emerald-500/10',      border: 'border-emerald-500/40' },
  4: { label: 'L4', color: 'text-brand-purple-light',bg: 'bg-brand-purple/10',     border: 'border-brand-purple/40' },
  5: { label: 'L5', color: 'text-white',             bg: 'bg-gradient-to-br from-brand-purple/20 to-brand-yellow/10', border: 'border-brand-yellow/60' },
}

const LEVEL_NAMES: Record<number, string> = {
  0: 'Hostile',
  1: 'Readable',
  2: 'Discoverable',
  3: 'Interactive',
  4: 'Integrated',
  5: 'Autonomous',
}

interface Props {
  level: number
  size?: 'sm' | 'md' | 'lg'
  showName?: boolean
  animate?: boolean
}

export function LevelBadge({ level, size = 'md', showName = false, animate = false }: Props) {
  const cfg = LEVEL_CONFIG[Math.min(level, 5)] ?? LEVEL_CONFIG[0]

  return (
    <div className={clsx('inline-flex items-center gap-2', animate && 'animate-level-in')}>
      <span className={clsx(
        'level-badge font-mono',
        cfg.color, cfg.bg, cfg.border,
        {
          'w-7 h-7 text-xs': size === 'sm',
          'w-10 h-10 text-sm': size === 'md',
          'w-16 h-16 text-xl': size === 'lg',
        }
      )}>
        {cfg.label}
      </span>
      {showName && (
        <span className={clsx('font-medium', cfg.color, {
          'text-xs': size === 'sm',
          'text-sm': size === 'md',
          'text-base': size === 'lg',
        })}>
          {LEVEL_NAMES[Math.min(level, 5)]}
        </span>
      )}
    </div>
  )
}

export { LEVEL_NAMES }
