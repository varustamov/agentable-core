import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { Copy, Check, Zap, Lock } from 'lucide-react'

interface LinkTokenResponse {
  token: string
  url: string
  connected: boolean
  telegram_chat_id: string | null
}

function PlanSection({ user }: { user: any }) {
  const [upgrading, setUpgrading] = useState(false)
  const [invoiceId, setInvoiceId] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState('')
  const { setAuth } = useAuthStore()

  const activatePromo = async () => {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    setPromoMsg('')
    try {
      const r = await api.post('/payment/promo', { code: promoCode.trim() })
      setPromoMsg('✅ ' + r.data.detail)
      const me = await api.get('/auth/me')
      setAuth(me.data, localStorage.getItem('agentable_token')!)
    } catch (e: any) {
      setPromoMsg('❌ ' + (e?.response?.data?.detail || 'Error activating promo code'))
    } finally {
      setPromoLoading(false)
    }
  }

  const upgrade = async () => {
    setUpgrading(true)
    try {
      const r = await api.post('/payment/checkout')
      const { url, invoice_id } = r.data
      setInvoiceId(invoice_id)
      window.open(url, '_blank')
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Payment not available yet')
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <section className="bg-gray-900 rounded-xl p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Plan</h2>

      {user?.is_pro ? (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 px-3 py-1.5 rounded-lg text-sm font-medium">
              <Zap className="w-4 h-4" />
              Pro
            </div>
            <span className="text-sm text-gray-400">Unlimited audits · PDF reports · 20 watchlist sites · Bulk audit</span>
          </div>
          <button
            onClick={async () => {
              if (!confirm('Cancel Pro subscription? You will keep access until the end of the billing period.')) return
              try {
                await api.post('/payment/cancel')
                alert('Subscription cancelled. Pro access continues until the end of your billing period.')
              } catch (e: any) {
                alert(e?.response?.data?.detail || 'Error cancelling subscription')
              }
            }}
            className="text-xs text-gray-500 hover:text-red-400 underline transition-colors"
          >
            Cancel subscription
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 text-gray-400 px-3 py-1.5 rounded-lg text-sm font-medium">
              <Lock className="w-4 h-4" />
              Free
            </div>
            <span className="text-sm text-gray-400">5 audits/day · 1 watchlist site</span>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-white mb-2">Upgrade to Pro — $9/mo</p>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>✓ Unlimited audits</li>
              <li>✓ Bulk audit up to 50 sites</li>
              <li>✓ Up to 20 sites in watchlist</li>
              <li>✓ PDF reports</li>
              <li>✓ Compare up to 8 sites</li>
            </ul>
          </div>
          <button
            onClick={upgrade}
            disabled={upgrading}
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            <Zap className="w-4 h-4" />
            {upgrading ? 'Opening checkout…' : 'Upgrade to Pro'}
          </button>
          {invoiceId && (
            <p className="text-xs text-gray-500 mt-2">
              After payment, refresh this page to activate Pro.
            </p>
          )}

          <div className="mt-5 pt-5 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Have a promo code?</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={e => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Enter promo code"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
              />
              <button
                onClick={activatePromo}
                disabled={promoLoading || !promoCode.trim()}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {promoLoading ? '…' : 'Apply'}
              </button>
            </div>
            {promoMsg && <p className="text-xs mt-2 text-gray-300">{promoMsg}</p>}
          </div>
        </div>
      )}
    </section>
  )
}

export default function Settings() {
  const { user, logout, setAuth } = useAuthStore()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const token = typeof window !== 'undefined' ? localStorage.getItem('agentable_token') ?? '' : ''

  const copyToken = () => {
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const [tgStatus, setTgStatus] = useState<LinkTokenResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [unlinking, setUnlinking] = useState(false)

  useEffect(() => {
    api.post<LinkTokenResponse>('/bot/link-token').then(r => setTgStatus(r.data)).catch(() => {})
  }, [])

  async function connectTelegram() {
    setLoading(true)
    try {
      const r = await api.post<LinkTokenResponse>('/bot/link-token')
      setTgStatus(r.data)
      window.open(r.data.url, '_blank')
    } finally {
      setLoading(false)
    }
  }

  async function unlinkTelegram() {
    setUnlinking(true)
    try {
      await api.delete('/bot/unlink')
      const r = await api.post<LinkTokenResponse>('/bot/link-token')
      setTgStatus(r.data)
      // Refresh user in auth store so has_telegram reflects reality
      const me = await api.get('/auth/me')
      if (user) setAuth(me.data, localStorage.getItem('agentable_token')!)
    } finally {
      setUnlinking(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm mb-8 flex items-center gap-1">
          ← Back
        </button>

        <h1 className="text-2xl font-bold mb-8">Settings</h1>

        {/* Profile */}
        <section className="bg-gray-900 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <div className="space-y-2 text-sm text-gray-300">
            <div><span className="text-gray-500">Email:</span> {user?.email}</div>
            {user?.name && <div><span className="text-gray-500">Name:</span> {user.name}</div>}
            {(user as any)?.company && <div><span className="text-gray-500">Company:</span> {(user as any).company}</div>}
          </div>
        </section>

        {/* Telegram */}
        <section className="bg-gray-900 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">Telegram Notifications</h2>
          <p className="text-sm text-gray-400 mb-5">
            Connect your Telegram account to receive weekly monitoring alerts directly from <b>@Agentable_Bot</b>.
          </p>

          {tgStatus?.connected ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                Connected (chat {tgStatus.telegram_chat_id})
              </div>
              <button
                onClick={unlinkTelegram}
                disabled={unlinking}
                className="text-xs text-gray-400 hover:text-red-400 underline"
              >
                {unlinking ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <button
              onClick={connectTelegram}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 14.317l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.978.242z"/>
              </svg>
              {loading ? 'Opening Telegram…' : 'Connect Telegram'}
            </button>
          )}

          {tgStatus && !tgStatus.connected && (
            <p className="text-xs text-gray-500 mt-3">
              You'll be redirected to @Agentable_Bot. Press Start to link your account.
            </p>
          )}
        </section>

        {/* API / MCP */}
        <section className="bg-gray-900 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2">API & MCP Server</h2>
          <p className="text-sm text-gray-400 mb-4">
            Use your token to connect the <strong>agentable-core</strong> MCP server to Claude Desktop, Cursor, or any MCP-compatible AI agent.
          </p>

          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Your API token</label>
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <code className="text-xs text-green-400 flex-1 truncate">{token.slice(0, 40)}…</code>
              <button onClick={copyToken} className="text-gray-400 hover:text-white transition-colors shrink-0">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Claude Desktop config</label>
            <pre className="text-xs bg-gray-800 rounded-lg p-3 overflow-x-auto text-gray-300 whitespace-pre-wrap">{`{
  "mcpServers": {
    "agentable": {
      "command": "agentable-mcp",
      "env": {
        "AGENTABLE_TOKEN": "${token}"
      }
    }
  }
}`}</pre>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            Install: <code className="text-purple-400">pip install agentable-core</code>
          </p>
        </section>

        {/* Plan */}
        <PlanSection user={user} />

        {/* Logout */}
        <section className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="text-sm text-red-400 hover:text-red-300 underline"
          >
            Log out
          </button>
        </section>
      </div>
    </div>
  )
}
