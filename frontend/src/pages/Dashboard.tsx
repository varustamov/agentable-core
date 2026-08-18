import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Search, LogOut, ExternalLink, ChevronRight, Zap, User, BookOpen, Shield, Trophy, Bell, BellOff, Eye, RefreshCw, Trash2, Settings, Menu, X } from 'lucide-react'
import { api, auditApi, monitorApi, streamAudit, type AuditResult, type Check, type WatchedDomain } from '../api/client'
import { useAuthStore } from '../store/auth'
import { Button } from '../components/ui/Button'
import { LevelBadge, LEVEL_NAMES } from '../components/ui/LevelBadge'
import { FixGuideDrawer } from '../components/ui/FixGuideDrawer'
import { getGuide, type Guide } from '../data/guides'
import { formatDistanceToNow } from 'date-fns'
import { clsx } from 'clsx'

type AuditState = 'idle' | 'running' | 'done' | 'error'

function CheckRow({ check, index, onGuide }: { check: Check; index: number; onGuide: (c: Check) => void }) {
  const hasGuide = !check.passed && !!getGuide(check.check_id)
  return (
    <div
      className={clsx('check-row', hasGuide && 'cursor-pointer hover:border-brand-yellow/30 hover:bg-brand-surface-2/80 transition-colors group')}
      style={{ animationDelay: `${index * 0.04}s`, opacity: 0 }}
      onClick={() => hasGuide && onGuide(check)}
    >
      <div className="mt-0.5">
        {check.passed ? (
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
            <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <LevelBadge level={check.level} size="sm" />
          <span className="text-sm font-medium text-brand-text">{check.name}</span>
        </div>
        <p className="text-xs text-brand-muted leading-relaxed">{check.message}</p>
        {!check.passed && check.recommendation && (
          <p className="text-xs text-brand-yellow/80 mt-1 flex items-start gap-1">
            <Zap className="w-3 h-3 mt-0.5 flex-shrink-0" />
            {check.recommendation}
          </p>
        )}
      </div>
      {hasGuide && (
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1 text-xs text-brand-purple-light bg-brand-purple/10 border border-brand-purple/30 px-2 py-1 rounded-lg">
            <BookOpen className="w-3 h-3" />
            Fix guide
          </div>
        </div>
      )}
    </div>
  )
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-brand-purple animate-pulse-dot"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
      <span className="text-xs text-brand-muted ml-2">Analyzing...</span>
    </div>
  )
}

function ScoreRing({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? score / maxScore : 0
  const r = 40
  const circ = 2 * Math.PI * r
  const dash = circ * pct

  return (
    <svg width="100" height="100" className="-rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={r} fill="none"
        stroke="url(#ring-grad)" strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <defs>
        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#F0C33C" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token, logout, setAuth } = useAuthStore()
  const prefilledUrl = (location.state as any)?.prefilledUrl ?? ''

  const [url, setUrl] = useState(prefilledUrl)
  const [auditState, setAuditState] = useState<AuditState>('idle')
  const [checks, setChecks] = useState<Check[]>([])
  const [summary, setSummary] = useState<{ level: number; score: number; max_score: number; audit_id: number } | null>(null)
  const [history, setHistory] = useState<AuditResult[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [guideCheck, setGuideCheck] = useState<Check | null>(null)
  const [watchlist, setWatchlist] = useState<WatchedDomain[]>([])
  const [auditingId, setAuditingId] = useState<number | null>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showTgPrompt, setShowTgPrompt] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const checksEndRef = useRef<HTMLDivElement>(null)
  const stopRef = useRef<(() => void) | null>(null)

  const NOTIF_KEY = 'agentable_notif_seen'

  const nextMonday = () => {
    const now = new Date()
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0))
    const day = d.getUTCDay() // 0=Sun,1=Mon...
    const daysUntilMon = day === 1 ? 7 : (8 - day) % 7
    d.setUTCDate(d.getUTCDate() + daysUntilMon)
    return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }) + ' 09:00 UTC'
  }

  useEffect(() => {
    auditApi.history()
      .then((r) => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
    monitorApi.list().then((r) => setWatchlist(r.data)).catch(() => {})
    // Load monitor notifications since last seen
    const since = localStorage.getItem(NOTIF_KEY) ?? ''
    api.get(`/monitor/notifications${since ? `?since=${encodeURIComponent(since)}` : ''}`).then((r) => {
      setNotifications(r.data)
    }).catch(() => {})
    // Refresh user so has_telegram is up to date
    api.get('/auth/me').then((r) => {
      const tok = localStorage.getItem('agentable_token')
      if (tok) setAuth(r.data, tok)
    }).catch(() => {})
  }, [summary])

  const markNotifsSeen = () => {
    localStorage.setItem(NOTIF_KEY, new Date().toISOString())
    setNotifications([])
    setShowNotifications(false)
  }

  const addToWatch = async (url: string) => {
    // Check TG status first, before add (which may 409 if already watching)
    if (!sessionStorage.getItem('tg_prompt_dismissed')) {
      api.post<{ connected: boolean }>('/bot/link-token').then((r) => {
        if (!r.data.connected) setShowTgPrompt(true)
      }).catch(() => {})
    }
    try {
      const r = await monitorApi.add(url)
      setWatchlist(prev => [r.data, ...prev])
    } catch {}
  }

  const removeWatch = async (id: number) => {
    await monitorApi.remove(id)
    setWatchlist(prev => prev.filter(w => w.id !== id))
  }

  const reauditWatch = async (w: WatchedDomain) => {
    setAuditingId(w.id)
    try {
      const r = await monitorApi.audit(w.id)
      setWatchlist(prev => prev.map(x => x.id === w.id ? {
        ...x,
        last_level: r.data.level,
        last_score: r.data.score,
        last_max: r.data.max_score,
        last_audit_at: new Date().toISOString(),
      } : x))
      navigate(`/report/${r.data.audit_id}`)
    } catch {} finally {
      setAuditingId(null)
    }
  }

  useEffect(() => {
    if (checksEndRef.current) {
      checksEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [checks])

  const startAudit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || !token) return
    setAuditState('running')
    setChecks([])
    setSummary(null)

    stopRef.current = streamAudit(
      url,
      token,
      (evt) => setChecks((prev) => [...prev, evt as Check]),
      (evt) => {
        setSummary(evt)
        setAuditState('done')
      },
      (evt) => {
        console.error('Audit error:', evt)
        setAuditState('error')
      }
    )
  }

  const handleLogout = () => {
    stopRef.current?.()
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-brand-black flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-brand-border/50 bg-brand-surface/30 p-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mb-6 px-2">
          <div className="w-7 h-7 rounded-lg bg-brand-yellow flex items-center justify-center">
            <span className="text-brand-black text-xs font-black">AI</span>
          </div>
          <span className="font-bold text-white text-sm tracking-tight">Agentable?</span>
        </Link>

        {/* Admin link */}
        {user?.is_admin && (
          <Link to="/admin" className="flex items-center gap-2 px-3 py-2 rounded-xl text-brand-yellow text-xs font-medium mb-2 hover:bg-brand-yellow/10 transition-colors border border-brand-yellow/20">
            <Shield className="w-3.5 h-3.5" />
            Admin panel
          </Link>
        )}

        {/* Upgrade to Pro banner */}
        {!user?.is_pro && (
          <Link
            to="/settings"
            className="flex items-center justify-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-lg"
          >
            ⚡ Upgrade to Pro — $9/mo
          </Link>
        )}

        {/* New audit btn */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setAuditState('idle'); setChecks([]); setSummary(null) }}
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand-yellow text-brand-black text-sm font-semibold hover:bg-brand-yellow-dim transition-colors shadow-glow-yellow"
          >
            <Search className="w-4 h-4" />
            New audit
          </button>
          <Link
            to="/compare"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:text-white hover:border-brand-purple/50 text-sm transition-colors"
            title="Compare"
          >
            <Zap className="w-4 h-4" />
          </Link>
          <Link
            to="/bulk"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:text-white hover:border-brand-purple/50 text-sm transition-colors"
            title="Bulk Audit"
          >
            <BookOpen className="w-4 h-4" />
          </Link>
          <Link
            to="/leaderboard"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:text-white hover:border-brand-yellow/50 text-sm transition-colors"
            title="Leaderboard"
          >
            <Trophy className="w-4 h-4" />
          </Link>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider px-2 mb-2">
            History
          </p>
          {loadingHistory ? (
            <div className="px-2 text-xs text-brand-muted">Loading...</div>
          ) : history.length === 0 ? (
            <div className="px-2 text-xs text-brand-muted">No audits yet</div>
          ) : (
            <div className="flex flex-col gap-1">
              {history.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/report/${a.id}`)}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-brand-surface-2 transition-colors text-left group"
                >
                  {a.level !== null && <LevelBadge level={a.level} size="sm" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-brand-text truncate group-hover:text-white transition-colors">
                      {a.url.replace(/^https?:\/\//, '')}
                    </p>
                    <p className="text-xs text-brand-muted">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-brand-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Watchlist */}
        <div className="border-t border-brand-border/50 pt-3 mt-3">
          <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
            <Eye className="w-3 h-3" />
            Watching
          </p>
          {watchlist.length === 0 ? (
            <p className="px-2 text-xs text-brand-muted">No domains watched yet</p>
          ) : (
            <div className="flex flex-col gap-1">
              {watchlist.map((w) => (
                <div key={w.id} className="flex flex-col px-2 py-1.5 rounded-lg hover:bg-brand-surface-2 group">
                  <div className="flex items-center gap-1.5">
                    {w.last_level !== null && <LevelBadge level={w.last_level} size="sm" />}
                    <p className="text-xs text-brand-text truncate flex-1">{w.url.replace(/^https?:\/\//, '')}</p>
                    <button
                      onClick={() => reauditWatch(w)}
                      disabled={auditingId === w.id}
                      className="opacity-0 group-hover:opacity-100 text-brand-muted hover:text-brand-yellow transition-colors disabled:opacity-50"
                      title="Re-audit now"
                    >
                      <RefreshCw className={clsx('w-3 h-3', auditingId === w.id && 'animate-spin')} />
                    </button>
                    <button
                      onClick={() => removeWatch(w.id)}
                      className="opacity-0 group-hover:opacity-100 text-brand-muted hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[10px] text-brand-muted/60 mt-0.5 pl-0.5">
                    Weekly · Next: {nextMonday()}
                  </p>
                </div>
              ))}
            </div>
          )}
          {/* Add current audit URL to watchlist */}
          {summary && url && !watchlist.find(w => w.url === url.trim()) && (
            <button
              onClick={() => addToWatch(url)}
              className="mt-2 flex items-center gap-1.5 px-2 py-1.5 text-xs text-brand-muted hover:text-brand-yellow transition-colors"
            >
              <Eye className="w-3 h-3" />
              Watch this domain
            </button>
          )}
        </div>

        {/* User */}
        <div className="border-t border-brand-border/50 pt-3 mt-3">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-brand-purple/30 border border-brand-purple/40 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-brand-purple-light" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.name ?? user?.email}</p>
              {user?.name && <p className="text-xs text-brand-muted truncate">{user.email}</p>}
            </div>
            <div className="flex items-center gap-1">
              {/* Notification bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(v => !v)}
                  className="relative text-brand-muted hover:text-white transition-colors"
                  title="Notifications"
                >
                  <Bell className="w-3.5 h-3.5" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-brand-yellow rounded-full text-brand-black text-[8px] font-bold flex items-center justify-center">
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute left-full ml-3 bottom-0 w-72 bg-brand-surface border border-brand-border rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-brand-border">
                      <span className="text-xs font-semibold text-white">Monitor Reports</span>
                      {notifications.length > 0 && (
                        <button onClick={markNotifsSeen} className="text-xs text-brand-yellow hover:underline">Mark read</button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-brand-muted px-3 py-4 text-center">No new reports</p>
                      ) : notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => { navigate(`/report/${n.id}`); setShowNotifications(false) }}
                          className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-white/5 transition-colors text-left border-b border-brand-border/30 last:border-0"
                        >
                          <span className="text-xs font-medium text-white flex-1 truncate">{n.url.replace(/^https?:\/\//, '')}</span>
                          <span className="text-xs text-brand-yellow shrink-0">L{n.level}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Link to="/settings" className="text-brand-muted hover:text-white transition-colors" title="Settings">
                <Settings className="w-3.5 h-3.5" />
              </Link>
              <button onClick={handleLogout} className="text-brand-muted hover:text-red-400 transition-colors" title="Log out">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Telegram connect prompt */}
      {showTgPrompt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-2xl mb-3">🔔</div>
            <h3 className="text-white font-semibold mb-2">Get alerts in Telegram</h3>
            <p className="text-sm text-brand-muted mb-5">
              Connect @Agentable_Bot to receive weekly monitoring reports directly in Telegram — no need to check the site.
            </p>
            <div className="flex gap-2">
              <Link
                to="/settings"
                onClick={() => setShowTgPrompt(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl text-center transition-colors"
              >
                Connect Telegram
              </Link>
              <button
                onClick={() => { sessionStorage.setItem('tg_prompt_dismissed', '1'); setShowTgPrompt(false) }}
                className="flex-1 border border-brand-border text-brand-muted hover:text-white text-sm py-2.5 rounded-xl transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-brand-border/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-brand-yellow flex items-center justify-center">
              <span className="text-brand-black text-xs font-black">AI</span>
            </div>
            <span className="font-bold text-white text-sm">Agentable?</span>
          </div>
          <button onClick={() => setShowMobileSidebar(true)} className="text-brand-muted hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile sidebar overlay */}
        {showMobileSidebar && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowMobileSidebar(false)} />
            <div className="relative w-72 bg-brand-surface border-r border-brand-border/50 flex flex-col p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <Link to="/" className="flex items-center gap-2 px-2">
                  <div className="w-7 h-7 rounded-lg bg-brand-yellow flex items-center justify-center">
                    <span className="text-brand-black text-xs font-black">AI</span>
                  </div>
                  <span className="font-bold text-white text-sm tracking-tight">Agentable?</span>
                </Link>
                <button onClick={() => setShowMobileSidebar(false)} className="text-brand-muted hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {!user?.is_pro && (
                <Link
                  to="/settings"
                  onClick={() => setShowMobileSidebar(false)}
                  className="flex items-center justify-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
                >
                  ⚡ Upgrade to Pro — $9/mo
                </Link>
              )}
              {user?.is_admin && (
                <Link to="/admin" onClick={() => setShowMobileSidebar(false)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-brand-yellow text-xs font-medium mb-2 hover:bg-brand-yellow/10 transition-colors border border-brand-yellow/20">
                  <Shield className="w-3.5 h-3.5" /> Admin panel
                </Link>
              )}
              <div className="flex gap-2 mb-4">
                <button onClick={() => { setAuditState('idle'); setChecks([]); setSummary(null); setShowMobileSidebar(false) }} className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand-yellow text-brand-black text-sm font-semibold hover:bg-brand-yellow-dim transition-colors">
                  <Search className="w-4 h-4" /> New audit
                </button>
                <Link to="/compare" onClick={() => setShowMobileSidebar(false)} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:text-white text-sm transition-colors" title="Compare"><Zap className="w-4 h-4" /></Link>
                <Link to="/bulk" onClick={() => setShowMobileSidebar(false)} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:text-white text-sm transition-colors" title="Bulk"><BookOpen className="w-4 h-4" /></Link>
                <Link to="/leaderboard" onClick={() => setShowMobileSidebar(false)} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-brand-border text-brand-muted hover:text-white text-sm transition-colors" title="Leaderboard"><Trophy className="w-4 h-4" /></Link>
              </div>
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider px-2 mb-2">History</p>
              {history.slice(0, 15).map((h) => (
                <button key={h.id} onClick={() => { navigate(`/report/${h.id}`); setShowMobileSidebar(false) }} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-brand-muted hover:text-white hover:bg-white/5 transition-colors text-left">
                  <span className="truncate flex-1">{h.url.replace(/^https?:\/\//, '')}</span>
                  <span className="text-xs text-brand-purple shrink-0">L{h.level}</span>
                </button>
              ))}
              <div className="mt-auto pt-4 border-t border-brand-border/50 flex items-center gap-3">
                <Link to="/settings" onClick={() => setShowMobileSidebar(false)} className="text-brand-muted hover:text-white transition-colors"><Settings className="w-4 h-4" /></Link>
                <button onClick={handleLogout} className="text-brand-muted hover:text-red-400 transition-colors"><LogOut className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
          <div className="max-w-2xl mx-auto">

            {/* URL form */}
            <form onSubmit={startAudit} className="mb-8">
              <div className="flex gap-2 p-2 rounded-2xl border border-brand-border bg-brand-surface/50 glow-border-yellow">
                <div className="flex-1 flex items-center gap-2 pl-2">
                  <Search className="w-4 h-4 text-brand-muted flex-shrink-0" />
                  <input
                    type="url"
                    placeholder="https://yourwebsite.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 bg-transparent text-white placeholder-brand-muted text-sm focus:outline-none"
                    disabled={auditState === 'running'}
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  loading={auditState === 'running'}
                  disabled={!url.trim() || auditState === 'running'}
                >
                  {auditState === 'running' ? 'Auditing...' : 'Audit'}
                </Button>
              </div>
            </form>

            {/* Idle state */}
            {auditState === 'idle' && checks.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-brand-surface-2 border border-brand-border flex items-center justify-center mx-auto mb-4">
                  <Search className="w-7 h-7 text-brand-muted" />
                </div>
                <p className="text-brand-muted text-sm">Enter a URL above to start your first audit</p>
              </div>
            )}

            {/* Results */}
            {(auditState === 'running' || checks.length > 0) && (
              <div className="space-y-3">
                {/* Summary card (when done) */}
                {auditState === 'done' && summary && (
                  <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 flex items-center gap-6 animate-slide-up">
                    <div className="relative">
                      <ScoreRing score={summary.score} maxScore={summary.max_score} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-bold text-white">{summary.score}</span>
                        <span className="text-xs text-brand-muted">/{summary.max_score}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1">Final score</p>
                      <LevelBadge level={summary.level} size="lg" showName animate />
                      <p className="text-xs text-brand-muted mt-2">
                        {summary.score} of {summary.max_score} checks passed
                      </p>
                      <button
                        onClick={() => navigate(`/report/${summary.audit_id}`)}
                        className="text-xs text-brand-yellow hover:text-brand-yellow-dim transition-colors mt-1 flex items-center gap-1"
                      >
                        View full report <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Level groups */}
                {[0, 1, 2, 3, 4, 5].map((lvl) => {
                  const lvlChecks = checks.filter((c) => c.level === lvl)
                  if (lvlChecks.length === 0) return null
                  const passed = lvlChecks.filter((c) => c.passed).length
                  return (
                    <div key={lvl}>
                      <div className="flex items-center gap-2 mb-2">
                        <LevelBadge level={lvl} size="sm" showName />
                        <span className="text-xs text-brand-muted ml-auto">
                          {passed}/{lvlChecks.length} passed
                        </span>
                      </div>
                      <div className="flex flex-col gap-2 pl-9">
                        {lvlChecks.map((c, i) => (
                          <CheckRow key={c.check_id} check={c} index={i} onGuide={setGuideCheck} />
                        ))}
                      </div>
                    </div>
                  )
                })}

                {auditState === 'running' && <LoadingDots />}
                <div ref={checksEndRef} />
              </div>
            )}

            {auditState === 'error' && (
              <div className="text-center py-12">
                <p className="text-red-400 text-sm">Audit failed. Check the URL and try again.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <FixGuideDrawer
        guide={guideCheck ? getGuide(guideCheck.check_id) : null}
        checkName={guideCheck?.name ?? ''}
        onClose={() => setGuideCheck(null)}
      />
    </div>
  )
}
