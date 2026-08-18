import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Zap, Shield, Globe, BarChart3, CheckCircle, ChevronRight, Terminal, Bot, Package } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { LevelBadge, LEVEL_NAMES } from '../components/ui/LevelBadge'
import { useAuthStore } from '../store/auth'

const FEATURES = [
  { icon: Globe, title: 'Deep URL Analysis', desc: 'We fetch your site as an AI agent would — raw HTTP, no JavaScript execution.' },
  { icon: BarChart3, title: 'L0–L5 Framework', desc: 'Score your site across 6 levels of agent-readiness with actionable fixes.' },
  { icon: Zap, title: 'Real-Time Streaming', desc: 'Watch checks run live, one by one, like a terminal you can share.' },
  { icon: Shield, title: 'Fix Recommendations', desc: 'Every failing check comes with a precise, copy-paste recommendation.' },
]

const LEVELS = [0, 1, 2, 3, 4, 5]

export default function Landing() {
  const [url, setUrl] = useState('')
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)

  const handleTry = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    if (token) {
      navigate('/dashboard', { state: { prefilledUrl: url } })
    } else {
      navigate('/register', { state: { prefilledUrl: url } })
    }
  }

  return (
    <div className="min-h-screen bg-brand-black overflow-x-hidden">

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-brand-border/50 bg-brand-black/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-yellow flex items-center justify-center">
              <span className="text-brand-black text-xs font-black">AI</span>
            </div>
            <span className="font-bold text-white text-sm tracking-tight">Agentable?</span>
          </div>
          <div className="flex items-center gap-2">
            {token ? (
              <Button size="sm" onClick={() => navigate('/dashboard')}>Dashboard</Button>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Sign in</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-28 pb-20 px-4 sm:px-6">
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-purple/15 rounded-full blur-3xl animate-blob" />
          <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-brand-yellow/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute bottom-1/4 left-1/2 w-64 h-64 bg-brand-purple/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-yellow/30 bg-brand-yellow/5 text-brand-yellow text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-yellow animate-pulse" />
            Agent traffic growing 8× faster than human traffic
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
            Is your site{' '}
            <span className="text-brand-yellow">invisible</span>
            {' '}to<br />
            <span className="bg-gradient-to-r from-brand-purple-light to-brand-yellow bg-clip-text text-transparent">
              AI agents?
            </span>
          </h1>

          <p className="text-brand-muted text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Audit your website's agent-readiness in seconds. Get a scored L0–L5 report
            with actionable fixes — so agents can find, read, and interact with your site.
          </p>

          {/* URL Input */}
          <form onSubmit={handleTry} className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3 p-2 rounded-2xl border border-brand-border bg-brand-surface/50 backdrop-blur-sm glow-border-yellow">
              <input
                type="url"
                placeholder="https://yourwebsite.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-transparent text-white placeholder-brand-muted px-4 py-2.5 text-sm focus:outline-none"
              />
              <Button type="submit" size="md" className="whitespace-nowrap">
                Audit for free <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-brand-muted mt-3">
              Free forever · No credit card · Results in ~15 seconds
            </p>
          </form>
        </div>
      </section>

      {/* Level scale */}
      <section className="py-16 px-4 sm:px-6 border-y border-brand-border/40 bg-brand-surface/20">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-brand-muted text-sm font-medium uppercase tracking-widest mb-8">
            The Agent Readiness Scale
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {LEVELS.map((l) => (
              <div key={l} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-brand-surface-2/50 border border-brand-border/50 hover:border-brand-purple/30 transition-colors">
                <LevelBadge level={l} size="md" />
                <span className="text-xs font-medium text-brand-text/80">{LEVEL_NAMES[l]}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-brand-muted text-xs mt-6">
            <strong className="text-brand-yellow">Fewer than 0.1% of websites</strong> pass L5 — full autonomous agent-readiness. Most sites are stuck at L0–L1.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-3">
            Built for the agentic web
          </h2>
          <p className="text-brand-muted text-center mb-12 text-sm">
            Not another SEO tool. This checks what AI agents actually care about.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 stagger-children">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl border border-brand-border/60 bg-brand-surface/40 hover:border-brand-purple/30 hover:bg-brand-surface/60 transition-all duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-brand-purple/20 border border-brand-purple/30 flex items-center justify-center mb-4 group-hover:bg-brand-purple/30 transition-colors">
                  <Icon className="w-5 h-5 text-brand-purple-light" />
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-brand-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we check */}
      <section className="py-16 px-4 sm:px-6 bg-brand-surface/20 border-y border-brand-border/40">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-white text-center mb-10">What gets checked</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { level: 0, checks: ['Site reachability', 'Bot blocking detection'] },
              { level: 1, checks: ['Semantic HTML structure', 'Meta tags & OG tags', 'Schema.org JSON-LD', 'Server-side rendering'] },
              { level: 2, checks: ['robots.txt quality', 'XML sitemap', 'llms.txt presence', 'OpenAPI spec'] },
              { level: 3, checks: ['JSON API surface', 'Agent card (/.well-known)', 'Rate limit headers'] },
              { level: 4, checks: ['MCP server detection', 'Webhook endpoints', 'Agent-friendly auth'] },
              { level: 5, checks: ['SSE / WebSocket streaming', 'Subscription API', 'Agent manifest'] },
            ].map(({ level, checks }) => (
              <div key={level} className="flex gap-4">
                <LevelBadge level={level} size="sm" />
                <div>
                  <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-2">{LEVEL_NAMES[level]}</p>
                  <ul className="space-y-1">
                    {checks.map((c) => (
                      <li key={c} className="flex items-center gap-2 text-sm text-brand-text/80">
                        <CheckCircle className="w-3.5 h-3.5 text-brand-purple-light flex-shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MCP / Developer section */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-purple/30 bg-brand-purple/5 text-brand-purple-light text-xs font-medium mb-4">
              <Terminal className="w-3.5 h-3.5" />
              For developers & AI agents
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Use Agentable from your AI agent
            </h2>
            <p className="text-brand-muted text-sm max-w-xl mx-auto">
              Connect directly via MCP — audit any site from Claude Desktop, Cursor, or any MCP-compatible agent.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-10">
            <div className="p-6 rounded-2xl border border-brand-border/60 bg-brand-surface/40">
              <Package className="w-6 h-6 text-brand-yellow mb-3" />
              <h3 className="font-semibold text-white text-sm mb-2">Install the SDK</h3>
              <code className="block bg-brand-black rounded-lg px-3 py-2 text-xs text-green-400 font-mono">
                pip install agentable-core
              </code>
            </div>
            <div className="p-6 rounded-2xl border border-brand-border/60 bg-brand-surface/40">
              <Bot className="w-6 h-6 text-brand-purple-light mb-3" />
              <h3 className="font-semibold text-white text-sm mb-2">Connect to Claude Desktop</h3>
              <p className="text-brand-muted text-xs leading-relaxed">Add your token in Settings → get instant audit tools inside Claude.</p>
            </div>
            <div className="p-6 rounded-2xl border border-brand-border/60 bg-brand-surface/40">
              <Terminal className="w-6 h-6 text-brand-purple-light mb-3" />
              <h3 className="font-semibold text-white text-sm mb-2">4 tools available</h3>
              <ul className="space-y-1 text-xs text-brand-muted font-mono">
                <li>audit_url <span className="text-gray-600 font-sans">Free · 5/day</span></li>
                <li>bulk_audit <span className="text-yellow-600 font-sans">Pro</span></li>
                <li>compare_urls <span className="text-gray-600 font-sans">2→8 sites</span></li>
                <li>get_leaderboard <span className="text-gray-600 font-sans">Free</span></li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-border/60 bg-brand-black/60 p-5">
            <p className="text-xs text-brand-muted mb-3 font-medium">Claude Desktop config (~/.config/claude/claude_desktop_config.json)</p>
            <pre className="text-xs text-gray-300 overflow-x-auto font-mono leading-relaxed">{`{
  "mcpServers": {
    "agentable": {
      "command": "agentable-mcp",
      "env": { "AGENTABLE_TOKEN": "your_token_from_settings" }
    }
  }
}`}</pre>
            <p className="text-xs text-brand-muted mt-3">
              Get your token at{' '}
              <Link to="/register" className="text-brand-yellow hover:underline">seo4agent.com → Settings</Link>
              {' '}after signing up.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-brand-purple/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Make your site visible to AI agents
          </h2>
          <p className="text-brand-muted mb-8">
            Free audit in 15 seconds. No credit card. Join 500+ sites already tracked.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register">
              <Button size="lg">
                Start auditing free <ChevronRight className="w-5 h-5" />
              </Button>
            </Link>
            <a href="https://pypi.org/project/agentable-core/" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="ghost">
                <Package className="w-4 h-4" /> pip install agentable-core
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-border/40 py-6 px-4 sm:px-6 text-center">
        <p className="text-brand-muted text-xs">
          © 2026 Agentable? · Built for the agentic internet
        </p>
      </footer>
    </div>
  )
}
