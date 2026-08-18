import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, X, Loader2, Check, ExternalLink } from 'lucide-react'
import { auditApi, type AuditResult } from '../api/client'
import { LevelBadge, LEVEL_NAMES } from '../components/ui/LevelBadge'
import { Button } from '../components/ui/Button'
import { clsx } from 'clsx'

const CHECK_LABELS: Record<string, string> = {
  l0_reach: 'Reachable', l0_block: 'Not Blocked', l0_https: 'HTTPS',
  l1_robots: 'robots.txt', l1_sitemap: 'Sitemap', l1_crawlable: 'Crawlable',
  l2_llmstxt: 'llms.txt', l2_opengraph: 'Open Graph', l2_schema: 'Schema.org',
  l2_securitytxt: 'security.txt',
  l3_jsonapi: 'JSON API', l3_ratelimit: 'Rate Limits', l3_cors: 'CORS',
  l4_oauth: 'OAuth/Auth', l4_webhook: 'Webhooks', l4_mcp: 'MCP',
  l4_webmcp: 'WebMCP', l4_x402: 'x402 Payment',
  l5_autonomy: 'Autonomous',
}

function ScorePill({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : pct >= 60 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
    : pct >= 40 ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
    : 'text-red-400 bg-red-500/10 border-red-500/30'
  return (
    <span className={clsx('text-sm font-mono font-bold border rounded-lg px-2 py-0.5', color)}>
      {pct}%
    </span>
  )
}

type CompareResult = AuditResult & { score_pct: number; audit_id?: number; error?: string }

export default function Compare() {
  const [urls, setUrls] = useState<string[]>(['', ''])
  const [results, setResults] = useState<CompareResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addUrl = () => { if (urls.length < 4) setUrls([...urls, '']) }
  const removeUrl = (i: number) => setUrls(urls.filter((_, idx) => idx !== i))
  const setUrl = (i: number, v: string) => setUrls(urls.map((u, idx) => idx === i ? v : u))

  const run = async () => {
    const valid = urls.map(u => u.trim()).filter(Boolean)
    if (valid.length < 2) { setError('Enter at least 2 URLs to compare'); return }
    setError('')
    setLoading(true)
    setResults(null)
    try {
      const res = await auditApi.compare(valid)
      setResults(res.data as CompareResult[])
    } catch {
      setError('Comparison failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Collect all unique check_ids across results for the comparison table
  const allCheckIds = results
    ? Array.from(new Set(results.flatMap(r => (r.results ?? []).map(c => c.check_id))))
    : []

  return (
    <div className="min-h-screen bg-brand-black">
      <div className="sticky top-0 z-10 border-b border-brand-border/50 bg-brand-black/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link to="/dashboard" className="text-brand-muted hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-sm font-semibold text-white flex-1">Competitor Comparison</h1>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">Dashboard</Button>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* URL inputs */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 space-y-4">
          <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider">URLs to compare (2–4)</p>
          <div className="space-y-2">
            {urls.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-brand-muted w-5 text-right flex-shrink-0">{i + 1}</span>
                <input
                  type="url"
                  value={u}
                  onChange={e => setUrl(i, e.target.value)}
                  placeholder={i === 0 ? 'https://your-site.com' : `https://competitor-${i}.com`}
                  className="flex-1 bg-brand-surface-3 border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-brand-muted focus:outline-none focus:border-brand-purple/50"
                />
                {urls.length > 2 && (
                  <button onClick={() => removeUrl(i)} className="text-brand-muted hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {urls.length < 4 && (
              <button
                onClick={addUrl}
                className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add URL
              </button>
            )}
            <div className="flex-1" />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button onClick={run} disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
              ) : 'Compare'}
            </Button>
          </div>
        </div>

        {/* Results */}
        {results && (
          <>
            {/* Summary cards */}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${results.length}, 1fr)` }}>
              {results.map((r, i) => (
                <div key={i} className={clsx(
                  'rounded-2xl border p-4',
                  r.error ? 'border-red-500/30 bg-red-500/5' : 'border-brand-border bg-brand-surface'
                )}>
                  <p className="text-xs text-brand-muted truncate mb-3">
                    {r.url?.replace(/^https?:\/\//, '') ?? '—'}
                  </p>
                  {r.error ? (
                    <p className="text-xs text-red-400">{r.error}</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-2">
                        <LevelBadge level={r.level ?? 0} size="md" />
                        <div>
                          <p className="text-xs font-semibold text-white">{LEVEL_NAMES[r.level ?? 0]}</p>
                          <ScorePill pct={r.score_pct ?? 0} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-brand-muted">{r.score}/{r.max_score} checks passed</p>
                        {r.audit_id && (
                          <Link to={`/report/${r.audit_id}`} className="text-brand-muted hover:text-white transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Check-by-check table */}
            <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-brand-border">
                      <th className="text-left px-4 py-3 text-brand-muted font-semibold uppercase tracking-wider w-40">Check</th>
                      {results.map((r, i) => (
                        <th key={i} className="px-4 py-3 text-center text-brand-muted font-semibold max-w-[120px]">
                          <span className="truncate block">{r.url?.replace(/^https?:\/\//, '').split('/')[0] ?? '—'}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allCheckIds.map((cid) => (
                      <tr key={cid} className="border-b border-brand-border/50 hover:bg-brand-surface-3/30 transition-colors">
                        <td className="px-4 py-2.5 text-brand-text font-medium">
                          {CHECK_LABELS[cid] ?? cid}
                        </td>
                        {results.map((r, i) => {
                          const check = (r.results ?? []).find(c => c.check_id === cid)
                          return (
                            <td key={i} className="px-4 py-2.5 text-center">
                              {!check ? (
                                <span className="text-brand-muted">—</span>
                              ) : check.passed ? (
                                <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                              ) : (
                                <X className="w-4 h-4 text-red-400 mx-auto" />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
