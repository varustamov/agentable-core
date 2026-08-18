import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Users, Activity, BarChart2, Shield, Search,
  ArrowLeft, ChevronRight, ToggleLeft, ToggleRight, ExternalLink,
  Zap, DollarSign, Globe, Layers, GitCompare, Cpu
} from 'lucide-react'
import { adminApi, type AdminStats, type AdminUser, type AdminAudit } from '../api/client'
import { useAuthStore } from '../store/auth'
import { LevelBadge } from '../components/ui/LevelBadge'
import { formatDistanceToNow, format } from 'date-fns'
import { clsx } from 'clsx'

// ── Mini bar chart (SVG, no lib) ──────────────────────────────────────────────
function MiniBarChart({ data, color = '#7C3AED', label }: {
  data: { date: string; value: number }[]
  color?: string
  label: string
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  const W = 600, H = 80, BAR_W = Math.floor(W / data.length) - 2

  return (
    <div>
      <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-2">{label}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
        {data.map((d, i) => {
          const barH = max > 0 ? Math.max((d.value / max) * (H - 10), d.value > 0 ? 3 : 0) : 0
          const x = i * (W / data.length)
          return (
            <g key={d.date}>
              <rect
                x={x + 1}
                y={H - barH}
                width={BAR_W}
                height={barH}
                rx={2}
                fill={color}
                opacity={0.8}
              />
              {d.value > 0 && (
                <text x={x + BAR_W / 2} y={H - barH - 3} textAnchor="middle" fill="white" fontSize={8} opacity={0.6}>
                  {d.value}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between text-xs text-brand-muted mt-1">
        <span>{data[0]?.date.slice(5)}</span>
        <span>today</span>
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="p-5 rounded-2xl border border-brand-border bg-brand-surface flex flex-col gap-1">
      <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider">{label}</p>
      <p className={clsx('text-3xl font-extrabold', color ?? 'text-white')}>{value}</p>
      {sub && <p className="text-xs text-brand-muted">{sub}</p>}
    </div>
  )
}

// ── Level distribution bar ────────────────────────────────────────────────────
const LEVEL_COLORS = ['#EF4444', '#F97316', '#F0C33C', '#10B981', '#A78BFA', '#FFFFFF']

function LevelDist({ dist, total }: { dist: Record<string, number>; total: number }) {
  return (
    <div className="p-5 rounded-2xl border border-brand-border bg-brand-surface">
      <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-4">Level Distribution</p>
      <div className="space-y-2">
        {[0,1,2,3,4,5].map(l => {
          const cnt = dist[String(l)] ?? 0
          const pct = total > 0 ? (cnt / total) * 100 : 0
          return (
            <div key={l} className="flex items-center gap-3">
              <span className="text-xs font-mono w-5 text-brand-muted">L{l}</span>
              <div className="flex-1 h-2 rounded-full bg-brand-surface-3">
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: LEVEL_COLORS[l] }}
                />
              </div>
              <span className="text-xs text-brand-muted w-10 text-right">{cnt}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── User drawer ───────────────────────────────────────────────────────────────
function UserDrawer({ user, onClose, onToggleAdmin, onToggleActive, onTogglePro }: {
  user: AdminUser | null
  onClose: () => void
  onToggleAdmin: (id: number) => void
  onToggleActive: (id: number) => void
  onTogglePro: (id: number) => void
}) {
  const [audits, setAudits] = useState<AdminAudit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    adminApi.userAudits(user.id)
      .then(r => setAudits(r.data))
      .finally(() => setLoading(false))
  }, [user?.id])

  const visible = !!user

  return (
    <>
      <div
        className={clsx('fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300',
          visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}
        onClick={onClose}
      />
      <div className={clsx(
        'fixed top-0 right-0 h-full w-full max-w-lg bg-brand-surface border-l border-brand-border z-50 flex flex-col',
        'transition-transform duration-300 ease-out',
        visible ? 'translate-x-0' : 'translate-x-full'
      )}>
        {user && (
          <>
            <div className="p-5 border-b border-brand-border flex items-start justify-between gap-4">
              <div>
                <p className="text-white font-bold">{user.name ?? user.email}</p>
                {user.name && <p className="text-brand-muted text-xs">{user.email}</p>}
                {(user.job_title || user.company) && (
                  <p className="text-brand-muted text-xs mt-0.5">
                    {[user.job_title, user.company].filter(Boolean).join(' · ')}
                  </p>
                )}
                {user.social_url && (
                  <a href={user.social_url} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-brand-purple-light hover:underline mt-0.5 inline-block truncate max-w-xs">
                    {user.social_url.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {user.is_pro && (
                    <span className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">⚡ Pro</span>
                  )}
                  {user.is_admin && (
                    <span className="text-xs bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/30 px-2 py-0.5 rounded-full">Admin</span>
                  )}
                  {!user.is_active && (
                    <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">Blocked</span>
                  )}
                  <span className="text-xs text-brand-muted">
                    Joined {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <button onClick={onClose} className="text-brand-muted hover:text-white transition-colors text-xl leading-none">×</button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 p-5 border-b border-brand-border">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{user.audit_count}</p>
                <p className="text-xs text-brand-muted">audits</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-brand-purple-light">
                  {user.avg_level !== null ? `L${user.avg_level.toFixed(1)}` : '—'}
                </p>
                <p className="text-xs text-brand-muted">avg level</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-brand-muted mt-1">last audit</p>
                <p className="text-xs text-white">
                  {user.last_audit_at ? formatDistanceToNow(new Date(user.last_audit_at), { addSuffix: true }) : '—'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-brand-border">
              <button
                onClick={() => onTogglePro(user.id)}
                className={clsx(
                  'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
                  user.is_pro
                    ? 'border-yellow-500/40 text-yellow-400 hover:border-red-500/40 hover:text-red-400'
                    : 'border-brand-border text-brand-muted hover:border-yellow-500/40 hover:text-yellow-400'
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                {user.is_pro ? 'Revoke Pro' : 'Grant Pro'}
              </button>
              <button
                onClick={() => onToggleAdmin(user.id)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-brand-border hover:border-brand-yellow/40 text-brand-muted hover:text-brand-yellow transition-colors"
              >
                {user.is_admin ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                {user.is_admin ? 'Revoke admin' : 'Make admin'}
              </button>
              <button
                onClick={() => onToggleActive(user.id)}
                className={clsx(
                  'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
                  user.is_active
                    ? 'border-brand-border text-brand-muted hover:border-red-500/40 hover:text-red-400'
                    : 'border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60'
                )}
              >
                {user.is_active ? 'Block user' : 'Unblock user'}
              </button>
            </div>

            {/* Audits list */}
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Audit history</p>
              {loading ? (
                <p className="text-xs text-brand-muted">Loading...</p>
              ) : audits.length === 0 ? (
                <p className="text-xs text-brand-muted">No audits yet</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {audits.map(a => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface-2 border border-brand-border">
                      {a.level !== null && <LevelBadge level={a.level} size="sm" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-brand-text truncate">{a.url.replace(/^https?:\/\//, '')}</p>
                        <p className="text-xs text-brand-muted">
                          {a.score}/{a.max_score} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-brand-muted hover:text-brand-yellow transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Main Admin page ───────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.is_admin) { navigate('/dashboard'); return }
    Promise.all([
      adminApi.stats().then(r => setStats(r.data)),
      adminApi.users().then(r => setUsers(r.data)),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      adminApi.users(search).then(r => setUsers(r.data))
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const handleToggleAdmin = async (id: number) => {
    await adminApi.toggleAdmin(id)
    adminApi.users(search).then(r => setUsers(r.data))
    if (selectedUser?.id === id) setSelectedUser(u => u ? { ...u, is_admin: !u.is_admin } : u)
  }

  const handleToggleActive = async (id: number) => {
    await adminApi.toggleActive(id)
    adminApi.users(search).then(r => setUsers(r.data))
    if (selectedUser?.id === id) setSelectedUser(u => u ? { ...u, is_active: !u.is_active } : u)
  }

  const handleTogglePro = async (id: number) => {
    await adminApi.togglePro(id)
    adminApi.users(search).then(r => setUsers(r.data))
    if (selectedUser?.id === id) setSelectedUser(u => u ? { ...u, is_pro: !u.is_pro } : u)
  }

  if (loading) return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center text-brand-muted text-sm">
      Loading admin panel...
    </div>
  )

  const auditsByDay = stats?.daily.slice(-14).map(d => ({ date: d.date, value: d.audits })) ?? []
  const usersByDay  = stats?.daily.slice(-14).map(d => ({ date: d.date, value: d.new_users })) ?? []

  return (
    <div className="min-h-screen bg-brand-black">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-brand-border/50 bg-brand-black/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link to="/dashboard" className="text-brand-muted hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-yellow" />
            <span className="font-bold text-white text-sm">Agentable? Admin</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total users"    value={stats.total_users}     color="text-white" />
            <StatCard label="Active users"   value={stats.active_users}    color="text-emerald-400" />
            <StatCard label="Total audits"   value={stats.total_audits}    color="text-brand-yellow" />
            <StatCard label="Audits today"   value={stats.audits_today}    color="text-brand-purple-light" />
            <StatCard label="This week"      value={stats.audits_this_week} />
            <StatCard
              label="Avg level"
              value={stats.avg_level !== null ? `L${stats.avg_level.toFixed(1)}` : '—'}
              color="text-brand-purple-light"
            />
          </div>
        )}

        {/* Revenue + Feature Usage */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
            <StatCard label="Pro users" value={stats.pro_users} color="text-yellow-400" sub={`paid: ${(stats as any).pro_paid_users ?? stats.pro_users} · promo: ${(stats as any).pro_promo_users ?? 0}`} />
            <StatCard label="MRR" value={`$${stats.mrr_usd.toFixed(0)}`} color="text-yellow-400" sub="paid only (excl. promo)" />
            <StatCard label="Web audits" value={stats.feature_usage.web ?? 0} color="text-blue-400" sub="via seo4agent.com" />
            <StatCard label="MCP audits" value={stats.feature_usage.mcp ?? 0} color="text-purple-400" sub="via Claude/Cursor" />
            <StatCard label="Bulk audits" value={stats.feature_usage.bulk ?? 0} color="text-emerald-400" sub="Pro feature" />
            <StatCard label="Compares" value={stats.feature_usage.compare ?? 0} color="text-pink-400" sub="side-by-side" />
            <StatCard label="x402 payments" value={stats.x402_payments} color="text-orange-400" sub={`$${stats.x402_revenue_usd.toFixed(2)} USDC`} />
          </div>
        )}

        {/* Promo codes */}
        {stats && (stats as any).promo_codes?.length > 0 && (
          <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b border-brand-border">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="font-semibold text-white text-sm">Promo Codes</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-brand-muted border-b border-brand-border">
                  <th className="text-left px-5 py-3">Code</th>
                  <th className="text-left px-5 py-3">Description</th>
                  <th className="text-right px-5 py-3">Used</th>
                  <th className="text-right px-5 py-3">Limit</th>
                </tr>
              </thead>
              <tbody>
                {(stats as any).promo_codes.map((p: any) => (
                  <tr key={p.code} className="border-b border-brand-border/50 hover:bg-brand-surface-2">
                    <td className="px-5 py-3 font-mono text-yellow-400 font-semibold">{p.code}</td>
                    <td className="px-5 py-3 text-gray-400">{p.description || '—'}</td>
                    <td className="px-5 py-3 text-right text-white font-semibold">{p.use_count}</td>
                    <td className="px-5 py-3 text-right text-gray-500">{p.max_uses ?? '∞'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Charts + Level dist */}
        {stats && (
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 p-5 rounded-2xl border border-brand-border bg-brand-surface">
              <MiniBarChart data={auditsByDay} color="#7C3AED" label="Audits — last 14 days" />
            </div>
            <div className="lg:col-span-1 p-5 rounded-2xl border border-brand-border bg-brand-surface">
              <MiniBarChart data={usersByDay} color="#F0C33C" label="New users — last 14 days" />
            </div>
            <LevelDist dist={stats.level_distribution} total={stats.total_audits} />
          </div>
        )}

        {/* Users table */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
          <div className="flex items-center justify-between gap-4 p-5 border-b border-brand-border">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-muted" />
              <span className="font-semibold text-white text-sm">Users ({users.length})</span>
            </div>
            <div className="flex items-center gap-2 bg-brand-surface-2 border border-brand-border rounded-xl px-3 py-2 w-64">
              <Search className="w-3.5 h-3.5 text-brand-muted flex-shrink-0" />
              <input
                type="text"
                placeholder="Search by email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm text-white placeholder-brand-muted flex-1 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border bg-brand-surface-2/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-brand-muted uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-brand-muted uppercase tracking-wider">Joined</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-brand-muted uppercase tracking-wider">Audits</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-brand-muted uppercase tracking-wider">Avg L</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-brand-muted uppercase tracking-wider">Last active</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-brand-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr
                    key={u.id}
                    className={clsx(
                      'border-b border-brand-border/50 hover:bg-brand-surface-2/50 transition-colors cursor-pointer',
                      i % 2 === 0 ? '' : 'bg-brand-surface-2/20'
                    )}
                    onClick={() => setSelectedUser(u)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-purple/20 border border-brand-purple/30 flex items-center justify-center text-xs font-bold text-brand-purple-light flex-shrink-0">
                          {(u.name ?? u.email)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate max-w-[180px]">{u.name ?? u.email}</p>
                          <p className="text-brand-muted text-xs truncate max-w-[180px]">
                            {u.name ? u.email : ''}
                            {u.company ? (u.name ? ` · ${u.company}` : u.company) : ''}
                          </p>
                        </div>
                        {u.is_pro && (
                          <span className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">Pro</span>
                        )}
                        {u.is_admin && (
                          <span className="text-xs bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/30 px-1.5 py-0.5 rounded-full">admin</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-muted text-xs whitespace-nowrap">
                      {format(new Date(u.created_at), 'MMM d, yy')}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-white">
                      {u.audit_count}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.avg_level !== null
                        ? <span className="font-mono text-brand-purple-light font-bold">L{u.avg_level}</span>
                        : <span className="text-brand-muted">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-brand-muted text-xs whitespace-nowrap">
                      {u.last_audit_at
                        ? formatDistanceToNow(new Date(u.last_audit_at), { addSuffix: true })
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full border',
                        u.is_active
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                          : 'text-red-400 bg-red-500/10 border-red-500/30'
                      )}>
                        {u.is_active ? 'active' : 'blocked'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-muted">
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="text-center py-12 text-brand-muted text-sm">No users found</div>
            )}
          </div>
        </div>
      </div>

      <UserDrawer
        user={selectedUser}
        onClose={() => setSelectedUser(null)}
        onToggleAdmin={handleToggleAdmin}
        onToggleActive={handleToggleActive}
        onTogglePro={handleTogglePro}
      />
    </div>
  )
}
