import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Trophy, ExternalLink } from 'lucide-react'
import { api } from '../api/client'
import { LevelBadge, LEVEL_NAMES } from '../components/ui/LevelBadge'
import { Button } from '../components/ui/Button'
import { clsx } from 'clsx'

interface LeaderboardEntry {
  url: string
  domain: string
  level: number
  score_pct: number
  score: number
  max_score: number
  audited_at: string
}

function ScoreBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-500' : pct >= 40 ? 'bg-orange-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-brand-surface-3">
        <div className={clsx('h-1.5 rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-brand-muted w-8 text-right">{pct}%</span>
    </div>
  )
}

const MEDALS: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' }

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<LeaderboardEntry[]>('/audit/leaderboard')
      .then(r => setEntries(r.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-brand-black">
      <div className="sticky top-0 z-10 border-b border-brand-border/50 bg-brand-black/90 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link to="/dashboard" className="text-brand-muted hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Trophy className="w-4 h-4 text-brand-yellow" />
          <h1 className="text-sm font-semibold text-white flex-1">Agent Readiness Leaderboard</h1>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">Dashboard</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-xs text-brand-muted mb-6">
          Top sites audited on seo4agent.com, ranked by agent-readiness score. Public — updated in real time.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-brand-muted text-sm">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-brand-muted text-sm">No audits yet. Be the first!</div>
        ) : (
          <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left px-4 py-3 text-brand-muted font-semibold uppercase tracking-wider text-xs w-10">#</th>
                  <th className="text-left px-4 py-3 text-brand-muted font-semibold uppercase tracking-wider text-xs">Domain</th>
                  <th className="px-4 py-3 text-brand-muted font-semibold uppercase tracking-wider text-xs text-center">Level</th>
                  <th className="px-4 py-3 text-brand-muted font-semibold uppercase tracking-wider text-xs text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.domain + i} className="border-b border-brand-border/40 hover:bg-brand-surface-3/30 transition-colors">
                    <td className="px-4 py-3 text-brand-muted font-mono text-xs">
                      {MEDALS[i] ?? <span className="text-brand-muted">{i + 1}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium truncate max-w-[200px]">{e.domain}</span>
                        <a href={e.url} target="_blank" rel="noopener noreferrer"
                           className="text-brand-muted hover:text-brand-yellow transition-colors flex-shrink-0">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-[10px] text-brand-muted mt-0.5">{LEVEL_NAMES[e.level ?? 0]}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <LevelBadge level={e.level ?? 0} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar pct={e.score_pct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-center text-xs text-brand-muted mt-6">
          Want your site here?{' '}
          <Link to="/dashboard" className="text-brand-purple-light hover:underline">Run a free audit →</Link>
        </p>
      </div>
    </div>
  )
}
