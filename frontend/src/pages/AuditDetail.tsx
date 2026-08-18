import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Copy, Check, BookOpen, Download, Loader2, Package, Eye, EyeOff } from 'lucide-react'
import { auditApi, monitorApi, api, type AuditResult, type Check as AuditCheck } from '../api/client'
import { LevelBadge, LEVEL_NAMES } from '../components/ui/LevelBadge'
import { FixGuideDrawer } from '../components/ui/FixGuideDrawer'
import { getGuide } from '../data/guides'
import { Button } from '../components/ui/Button'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { useAuthStore } from '../store/auth'

function ScoreBar({ passed, total }: { passed: number; total: number }) {
  const pct = total > 0 ? (passed / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-brand-surface-3">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-brand-purple to-brand-yellow transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-brand-muted font-mono whitespace-nowrap">{passed}/{total}</span>
    </div>
  )
}

function ScoreRing({ passed, total }: { passed: number; total: number }) {
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#eab308' : pct >= 40 ? '#f97316' : '#ef4444'
  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <svg viewBox="0 0 72 72" className="w-20 h-20 -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#2a2a3a" strokeWidth="7" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold text-white leading-none">{pct}</span>
        <span className="text-[10px] text-brand-muted">/ 100</span>
      </div>
    </div>
  )
}

function BadgeSection({ url }: { url: string }) {
  const [badgeCopied, setBadgeCopied] = useState(false)
  const domain = url.replace(/^https?:\/\//, '').split('/')[0]
  const badgeUrl = `https://seo4agent.com/badge/${domain}`
  const markdownSnippet = `[![Agent Ready](${badgeUrl})](https://seo4agent.com)`

  const copy = () => {
    navigator.clipboard.writeText(markdownSnippet)
    setBadgeCopied(true)
    setTimeout(() => setBadgeCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface p-5">
      <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Embed Badge</p>
      <div className="flex items-center gap-4 flex-wrap">
        <img src={badgeUrl} alt="Agent Ready badge" className="h-5" />
        <div className="flex-1 min-w-0">
          <code className="text-xs text-brand-muted bg-brand-surface-3 rounded px-2 py-1 block truncate">
            {markdownSnippet}
          </code>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-white transition-colors flex-shrink-0"
        >
          {badgeCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {badgeCopied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

interface HistoryPoint { id: number; created_at: string; score_pct: number; level: number }

function HistoryGraph({ url }: { url: string }) {
  const [points, setPoints] = useState<HistoryPoint[]>([])

  useEffect(() => {
    const domain = url.replace(/^https?:\/\//, '').split('/')[0]
    api.get<HistoryPoint[]>(`/audit/domain-history?domain=${encodeURIComponent(domain)}`)
      .then(r => setPoints(r.data))
      .catch(() => {})
  }, [url])

  if (points.length < 2) return null

  const W = 400, H = 80, PAD = 8
  const xs = points.map((_, i) => PAD + (i / (points.length - 1)) * (W - PAD * 2))
  const ys = points.map(p => H - PAD - (p.score_pct / 100) * (H - PAD * 2))
  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ')
  const area = `M${xs[0]},${ys[0]} ` + xs.slice(1).map((x, i) => `L${x},${ys[i + 1]}`).join(' ') +
    ` L${xs[xs.length - 1]},${H} L${xs[0]},${H} Z`

  const latest = points[points.length - 1]
  const prev = points[points.length - 2]
  const delta = latest.score_pct - prev.score_pct

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider">Score History</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-muted">{points.length} audits</span>
          {delta !== 0 && (
            <span className={clsx('text-xs font-mono font-semibold', delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
              {delta > 0 ? '+' : ''}{delta}%
            </span>
          )}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
        <defs>
          <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[25, 50, 75].map(pct => {
          const y = H - PAD - (pct / 100) * (H - PAD * 2)
          return <line key={pct} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#2a2a3a" strokeWidth="1" />
        })}
        <path d={area} fill="url(#hg)" />
        <polyline points={polyline} fill="none" stroke="#a855f7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots */}
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r="3" fill="#a855f7" stroke="#1a1a2e" strokeWidth="1.5" />
        ))}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-brand-muted">{format(new Date(points[0].created_at), 'MMM d')}</span>
        <span className="text-[10px] text-brand-muted">{format(new Date(points[points.length - 1].created_at), 'MMM d')}</span>
      </div>
    </div>
  )
}

function LlmsTxtSection({ url, hasLlmsTxt }: { url: string; hasLlmsTxt: boolean }) {
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/generate/llms-txt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const text = await res.text()
      setContent(text)
    } catch {
      setContent('Error generating llms.txt. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const download = () => {
    if (!content) return
    const domain = url.replace(/^https?:\/\//, '').split('/')[0]
    const blob = new Blob([content], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `llms-${domain}.txt`
    a.click()
  }

  const copy = () => {
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (hasLlmsTxt) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1">llms.txt</p>
            <p className="text-xs text-emerald-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Your site already has an llms.txt — AI agents can discover it.
            </p>
          </div>
          <a
            href={`${url.replace(/\/$/, '')}/llms.txt`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-brand-muted hover:text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider">llms.txt Generator</p>
        {!content && (
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs bg-brand-purple/20 hover:bg-brand-purple/30 text-brand-purple-light border border-brand-purple/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {loading ? 'Generating…' : 'Generate'}
          </button>
        )}
        {content && (
          <div className="flex items-center gap-2">
            <button onClick={copy} className="flex items-center gap-1 text-xs text-brand-muted hover:text-white transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={download} className="flex items-center gap-1 text-xs text-brand-muted hover:text-white transition-colors">
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-brand-muted mb-3">
        Generate a structured <code className="bg-brand-surface-3 px-1 rounded">llms.txt</code> file to help AI agents discover and understand your site's content.
      </p>
      {content && (
        <pre className="text-xs text-brand-text bg-brand-surface-3 rounded-xl p-4 overflow-auto max-h-64 font-mono leading-relaxed whitespace-pre-wrap">
          {content}
        </pre>
      )}
    </div>
  )
}

export default function AuditDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [audit, setAudit] = useState<AuditResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [guideCheck, setGuideCheck] = useState<AuditCheck | null>(null)
  const [fixLoading, setFixLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [watching, setWatching] = useState(false)
  const [watched, setWatched] = useState(false)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    monitorApi.list().then(r => {
      if (audit) setWatched(r.data.some(w => w.url === audit.url))
    }).catch(() => {})
  }, [audit])

  useEffect(() => {
    if (!id) return
    auditApi.getById(Number(id))
      .then((r) => setAudit(r.data))
      .catch((err) => {
        if (err?.response?.status !== 401) navigate('/dashboard')
      })
      .finally(() => setLoading(false))
  }, [id])

  const copyUrl = () => {
    if (!audit) return
    navigator.clipboard.writeText(audit.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <div className="flex items-center gap-3 text-brand-muted">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading report...
        </div>
      </div>
    )
  }
  if (!audit) return null

  const results = audit.results ?? []
  const failed = results.filter((c) => !c.passed)
  const hasLlmsTxt = results.find((c) => c.check_id === 'l2_llmstxt')?.passed ?? false

  const fixableFailedIds = failed.map(c => c.check_id)

  const downloadPdf = () => {
    if (!audit) return
    if (!user?.is_pro) {
      alert('PDF reports are available on the Pro plan. Upgrade in Settings.')
      return
    }
    const token = localStorage.getItem('agentable_token')
    window.open(`/audit/${audit.id}/pdf?token=${token}`, '_blank')
  }

  const downloadFixPack = async () => {
    setFixLoading(true)
    try {
      const res = await fetch('/generate/fix-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: audit.url, failed_checks: fixableFailedIds }),
      })
      const blob = await res.blob()
      const domain = audit.url.replace(/^https?:\/\//, '').split('/')[0]
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `agentable-fixes-${domain}.zip`
      a.click()
    } finally {
      setFixLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-black">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-brand-border/50 bg-brand-black/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-brand-muted hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-brand-muted truncate">{audit.url.replace(/^https?:\/\//, '')}</span>
              <button onClick={copyUrl} className="text-brand-muted hover:text-brand-yellow transition-colors flex-shrink-0">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <a href={audit.url} target="_blank" rel="noopener noreferrer"
                 className="text-brand-muted hover:text-brand-yellow transition-colors flex-shrink-0">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          <button
            onClick={async () => {
              if (watched || !audit) return
              setWatching(true)
              try {
                await monitorApi.add(audit.url)
                setWatched(true)
              } catch {} finally { setWatching(false) }
            }}
            disabled={watched || watching}
            className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-yellow transition-colors disabled:opacity-50"
            title={watched ? 'Already watching' : 'Watch this domain'}
          >
            {watched ? <EyeOff className="w-3.5 h-3.5 text-brand-yellow" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{watched ? 'Watching' : 'Watch'}</span>
          </button>
          <button
            onClick={downloadPdf}
            disabled={pdfLoading}
            className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-yellow transition-colors disabled:opacity-50"
            title={user?.is_pro ? 'Download PDF report' : 'PDF report — Pro only'}
          >
            {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">PDF{!user?.is_pro && ' 🔒'}</span>
          </button>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">Dashboard</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Summary */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-3">Agent Readiness Level</p>
              {audit.level !== null && (
                <LevelBadge level={audit.level} size="lg" showName animate />
              )}
              <p className="text-brand-muted text-xs mt-3">
                Audited {format(new Date(audit.created_at), 'MMM d, yyyy · HH:mm')}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider self-start">Score</p>
              <ScoreRing passed={audit.score ?? 0} total={audit.max_score ?? 0} />
              <p className="text-xs text-brand-muted">
                {audit.score ?? 0} of {audit.max_score ?? 0} checks passed
              </p>
            </div>
          </div>
        </div>

        {/* Registration prompt for anonymous users */}
        {!user && (
          <div className="rounded-2xl border border-brand-purple/40 bg-gradient-to-r from-brand-purple/10 to-brand-yellow/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white mb-1">Хочешь сохранить результат?</p>
              <p className="text-xs text-brand-muted">Зарегистрируйся бесплатно — история аудитов, мониторинг изменений и PDF-отчёты.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link to="/register">
                <Button size="sm">Зарегистрироваться</Button>
              </Link>
              <Link to="/login">
                <Button variant="ghost" size="sm">Войти</Button>
              </Link>
            </div>
          </div>
        )}

        {/* History graph (only shows if ≥2 audits for this domain) */}
        <HistoryGraph url={audit.url} />

        {/* Badge */}
        <BadgeSection url={audit.url} />

        {/* llms.txt generator */}
        <LlmsTxtSection url={audit.url} hasLlmsTxt={hasLlmsTxt} />

        {/* Failed checks — priority fixes */}
        {failed.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Priority fixes ({failed.length})
              </h2>
              <button
                onClick={downloadFixPack}
                disabled={fixLoading}
                className="flex items-center gap-1.5 text-xs bg-brand-purple/20 hover:bg-brand-purple/30 text-brand-purple-light border border-brand-purple/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {fixLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                {fixLoading ? 'Generating…' : 'Download Fix Pack'}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {failed.map((c) => {
                const hasGuide = !!getGuide(c.check_id)
                return (
                  <div
                    key={c.check_id}
                    className={clsx(
                      'p-4 rounded-xl border border-red-500/20 bg-red-500/5 group',
                      hasGuide && 'cursor-pointer hover:border-brand-yellow/30 hover:bg-brand-yellow/5 transition-colors'
                    )}
                    onClick={() => hasGuide && setGuideCheck(c)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <LevelBadge level={c.level} size="sm" />
                        <span className="text-sm font-medium text-white">{c.name}</span>
                      </div>
                      {hasGuide && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-brand-purple-light bg-brand-purple/10 border border-brand-purple/30 px-2 py-1 rounded-lg">
                          <BookOpen className="w-3 h-3" />
                          Fix guide
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-brand-muted mb-1">{c.message}</p>
                    {c.recommendation && (
                      <p className="text-xs text-brand-yellow/90 flex items-start gap-1">
                        <span className="mt-0.5">→</span>
                        {c.recommendation}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* All checks by level */}
        {[0, 1, 2, 3, 4, 5].map((lvl) => {
          const lvlChecks = results.filter((c) => c.level === lvl)
          if (lvlChecks.length === 0) return null
          const passed = lvlChecks.filter((c) => c.passed).length
          return (
            <div key={lvl}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <LevelBadge level={lvl} size="sm" showName />
                </div>
                <div className="flex items-center gap-3">
                  <ScoreBar passed={passed} total={lvlChecks.length} />
                </div>
              </div>
              <div className="flex flex-col gap-2 pl-9">
                {lvlChecks.map((c) => {
                  const hasGuide = !c.passed && !!getGuide(c.check_id)
                  return (
                    <div
                      key={c.check_id}
                      className={clsx(
                        'p-3 rounded-xl border text-sm group',
                        c.passed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5',
                        hasGuide && 'cursor-pointer hover:border-brand-yellow/30 hover:bg-brand-yellow/5 transition-colors'
                      )}
                      onClick={() => hasGuide && setGuideCheck(c)}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-2">
                          <span className={c.passed ? 'text-emerald-400' : 'text-red-400'}>
                            {c.passed ? '✓' : '✗'}
                          </span>
                          <span className="font-medium text-brand-text">{c.name}</span>
                        </div>
                        {hasGuide && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-brand-purple-light">
                            <BookOpen className="w-3 h-3" />
                            <span>Fix guide</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-brand-muted pl-5">{c.message}</p>
                      {!c.passed && c.recommendation && (
                        <p className="text-xs text-brand-yellow/80 pl-5 mt-1">→ {c.recommendation}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="text-center pt-4">
          <Link to="/dashboard">
            <Button variant="secondary" size="sm">← Run another audit</Button>
          </Link>
        </div>
      </div>

      <FixGuideDrawer
        guide={guideCheck ? getGuide(guideCheck.check_id) : null}
        checkName={guideCheck?.name ?? ''}
        onClose={() => setGuideCheck(null)}
      />
    </div>
  )
}
