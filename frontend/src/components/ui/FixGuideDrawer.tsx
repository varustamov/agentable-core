import { useEffect, useState } from 'react'
import { X, Copy, Check, ExternalLink, ChevronRight, Zap } from 'lucide-react'
import type { Guide, Step } from '../../data/guides'
import { clsx } from 'clsx'

interface Props {
  guide: Guide | null
  checkName: string
  onClose: () => void
}

function CodeBlock({ code, language, file }: { code: string; language?: string; file?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-brand-border overflow-hidden">
      {file && (
        <div className="flex items-center justify-between px-4 py-2 bg-brand-surface-3/80 border-b border-brand-border">
          <span className="text-xs font-mono text-brand-muted">{file}</span>
          <span className="text-xs text-brand-purple-light/70">{language}</span>
        </div>
      )}
      <div className="relative group">
        <pre className="p-4 text-xs font-mono text-brand-text/90 overflow-x-auto leading-relaxed bg-brand-surface-2/50 max-h-80 overflow-y-auto">
          <code>{code}</code>
        </pre>
        <button
          onClick={copy}
          className={clsx(
            'absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
            'bg-brand-surface-3 border border-brand-border',
            copied
              ? 'text-emerald-400 border-emerald-500/40'
              : 'text-brand-muted hover:text-white hover:border-brand-purple/40'
          )}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-purple/20 border border-brand-purple/40 flex items-center justify-center mt-0.5">
        <span className="text-xs font-bold text-brand-purple-light">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white mb-1">{step.title}</p>
        {step.description && (
          <p className="text-xs text-brand-muted mb-3 leading-relaxed">{step.description}</p>
        )}
        {step.code && (
          <div className="mb-3">
            <CodeBlock code={step.code} language={step.language} file={step.file} />
          </div>
        )}
        {step.note && (
          <div className="flex items-start gap-2 text-xs text-brand-yellow/80 bg-brand-yellow/5 border border-brand-yellow/20 rounded-lg px-3 py-2">
            <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {step.note}
          </div>
        )}
      </div>
    </div>
  )
}

export function FixGuideDrawer({ guide, checkName, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const visible = !!guide

  return (
    <>
      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300',
          visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={clsx(
          'fixed top-0 right-0 h-full w-full max-w-xl bg-brand-surface border-l border-brand-border z-50',
          'flex flex-col transition-transform duration-300 ease-out',
          visible ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {guide && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 p-5 border-b border-brand-border">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-brand-purple-light bg-brand-purple/15 border border-brand-purple/30 px-2 py-0.5 rounded-full">
                    Fix Guide
                  </span>
                  <span className="text-xs text-brand-muted">{checkName}</span>
                </div>
                <h2 className="text-base font-bold text-white leading-snug">{guide.title}</h2>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-surface-3 border border-brand-border flex items-center justify-center text-brand-muted hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Why it matters */}
              <div className="p-4 rounded-xl bg-brand-yellow/5 border border-brand-yellow/20">
                <p className="text-xs font-semibold text-brand-yellow uppercase tracking-wider mb-2">Why this matters</p>
                <p className="text-sm text-brand-text/80 leading-relaxed">{guide.why}</p>
              </div>

              {/* Steps */}
              <div>
                <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-4">How to fix</p>
                <div className="flex flex-col gap-6">
                  {guide.steps.map((step, i) => (
                    <StepCard key={i} step={step} index={i} />
                  ))}
                </div>
              </div>

              {/* Deploy note */}
              {guide.deploy && (
                <div className="p-4 rounded-xl bg-brand-surface-2 border border-brand-border">
                  <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3 text-emerald-400" />
                    How to deploy
                  </p>
                  <p className="text-sm text-brand-text/80 leading-relaxed">{guide.deploy}</p>
                </div>
              )}

              {/* Links */}
              {guide.links && guide.links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {guide.links.map((l) => (
                    <a
                      key={l.url}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-brand-purple-light hover:text-white border border-brand-purple/30 hover:border-brand-purple px-3 py-1.5 rounded-lg transition-colors bg-brand-purple/5 hover:bg-brand-purple/15"
                    >
                      {l.label}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-brand-border bg-brand-surface-2/50">
              <p className="text-xs text-brand-muted text-center">
                After implementing, re-run the audit to verify the fix
              </p>
            </div>
          </>
        )}
      </div>
    </>
  )
}
