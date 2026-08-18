import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { LevelBadge } from '../components/ui/LevelBadge'
import { ArrowLeft, Upload, Play, ExternalLink, Lock } from 'lucide-react'
import { useAuthStore } from '../store/auth'

interface BulkResult {
  url: string
  audit_id?: number
  level?: number
  score_pct?: number
  score?: number
  max_score?: number
  error?: string
}

export default function Bulk() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<BulkResult[]>([])
  const [error, setError] = useState('')

  const parseUrls = (raw: string) =>
    raw
      .split(/[\n,;]+/)
      .map(s => s.replace(/^["'\s]+|["'\s]+$/g, '').trim())
      .filter(Boolean)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setText(ev.target?.result as string ?? '')
    reader.readAsText(file)
  }

  const run = async () => {
    const urls = parseUrls(text)
    if (!urls.length) { setError('Enter at least one URL'); return }
    if (urls.length > 50) { setError('Maximum 50 URLs at once'); return }
    setError('')
    setRunning(true)
    setResults([])
    try {
      const r = await api.post<BulkResult[]>('/audit/bulk', { urls }, { timeout: 300_000 })
      setResults(r.data)
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Request failed')
    } finally {
      setRunning(false)
    }
  }

  const urlCount = parseUrls(text).length

  const avgLevel = results.length
    ? (results.filter(r => r.level != null).reduce((s, r) => s + (r.level ?? 0), 0) /
       results.filter(r => r.level != null).length).toFixed(1)
    : null

  if (!user?.is_pro) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Bulk Audit is Pro only</h1>
          <p className="text-gray-400 mb-8">Audit up to 50 URLs in parallel, export results, and more — available on Pro plan.</p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Upgrade to Pro — $9/mo
          </Link>
          <button onClick={() => navigate(-1)} className="block mx-auto mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Bulk Audit</h1>
          <span className="text-sm text-gray-500">Up to 50 URLs</span>
        </div>

        {/* Input */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-300">URLs</label>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={'https://example.com\nhttps://another.com\n...'}
            className="w-full h-40 bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none font-mono"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-500">
              {urlCount > 0 ? `${urlCount} URL${urlCount > 1 ? 's' : ''} detected` : 'One URL per line, or paste CSV'}
            </span>
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button
              onClick={run}
              disabled={running || urlCount === 0}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {running ? `Running… (${results.length}/${urlCount})` : 'Run Audit'}
            </button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-gray-900 rounded-2xl overflow-hidden">
            {/* Summary bar */}
            <div className="flex items-center gap-6 px-6 py-4 border-b border-gray-800">
              <span className="text-sm font-semibold text-white">{results.length} audited</span>
              {avgLevel && <span className="text-sm text-gray-400">Avg level <span className="text-purple-400 font-semibold">{avgLevel}</span></span>}
              <span className="text-sm text-gray-400">
                {results.filter(r => !r.error).length} ok · {results.filter(r => r.error).length} errors
              </span>
              <Link
                to="/dashboard"
                className="ml-auto text-xs text-gray-400 hover:text-white underline transition-colors"
              >
                View in History
              </Link>
            </div>

            {/* Table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left px-6 py-3 font-medium">URL</th>
                  <th className="text-center px-4 py-3 font-medium">Level</th>
                  <th className="text-center px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-3 text-gray-300 truncate max-w-xs">
                      {r.url.replace(/^https?:\/\//, '')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.error
                        ? <span className="text-xs text-red-400">Error</span>
                        : r.level != null && <LevelBadge level={r.level} size="sm" />
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.error
                        ? <span className="text-xs text-gray-600 truncate max-w-[120px] inline-block" title={r.error}>{r.error}</span>
                        : <span className="text-gray-300">{r.score_pct}%</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.audit_id && (
                        <Link
                          to={`/report/${r.audit_id}`}
                          className="text-purple-400 hover:text-purple-300 transition-colors inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
