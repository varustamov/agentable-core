# Agentable — Roadmap & Implementation Plan

**Last updated:** 2026-08-10  
**Product:** seo4agent.com — AI Agent Readiness Auditor  
**Stack:** FastAPI + React + SQLite, running on `/opt/agentable`, service: `agentable.service`

---

## Vision

Become the #1 open-source platform for AI agent readiness auditing.

**Strategy:** open-source engine (agentable-core pip package + MCP server) drives awareness → closed-source platform (seo4agent.com) converts to paid subscribers via freemium.

**Freemium model:**
| Free | Paid ($9-99/mo) |
|------|-----------------|
| One-shot audit | Weekly monitoring + alerts |
| llms.txt generator | API access with keys |
| Public badge | White-label PDF reports |
| Basic recommendations | Bulk audit (10-50 sites) |
| Fix Pack ZIP download | Fix-generator (auto-creates llms.txt, agent.json, robots.txt) |

**Unique differentiators vs competitors (ASO Audit MCP, Librecrawl, etc.):**
- History + change diff (none have this)
- Embeddable badge (`/badge/domain.com`) — viral in dev communities
- Public leaderboard / industry rankings
- Fix Pack ZIP — ready-to-deploy files per failing check
- Competitor comparison (up to 4 sites side-by-side)
- Monitoring with Telegram/email alerts
- Full platform with UI, auth, history (competitors are CLI-only)

---

## Phase 0 — Prerequisites ✅ Done
- [x] Verify disk/RAM headroom
- [x] Research competitors and market gaps
- [x] Define monetization strategy
- [x] Define open-source vs closed-source boundary

---

## Phase 1 — Quick Wins ✅ Done

### 1.1 Numeric Score 0-100 + Badge endpoint ✅
- Score ring SVG in UI (color-coded by threshold)
- `/badge/{domain}` SVG endpoint (shields.io style, cached 1h)
- BadgeSection in AuditDetail with markdown copy

### 1.2 llms.txt Generator ✅
- `POST /generate/llms-txt` — parses title, description, nav, headings, sitemap
- LlmsTxtSection in AuditDetail — Generate / Copy / Download
- Smart: shows "already exists" + View link if l2_llmstxt check passed

### 1.3 Competitor Comparison Mode ✅
- `/compare` page — 2–4 URLs, parallel audit via asyncio.gather
- Summary cards + check-by-check table
- Saves each URL to audit history, links to full reports
- Compare button in Dashboard sidebar

### 1.4 History Graph ✅
- SVG sparkline in AuditDetail — score over time for domain
- Shows delta vs previous audit (+N% / −N%)
- Only appears when ≥2 audits for same domain

### 1.5 New Checks (21 → 24) ✅
- L2: security.txt (RFC 9116)
- L4: WebMCP Discovery (/.well-known/mcp.json)
- L4: x402 Payment Protocol (HTTP 402 signals)

---

## Phase 2 — Growth Features

### 2.1 Monitoring (paid feature) ⬜ Next
- User can add domains to "watch list"
- Cron job runs weekly audits
- Alert if level drops: Telegram bot + email
- DB schema: new `WatchedDomain` table

### 2.2 Fix Generator ✅ Done
- `POST /generate/fix-pack` → ZIP with ready-to-deploy files
- Generates: robots-patch.txt, security.txt, mcp.json, schema-jsonld.html, og-tags.html, llms.txt
- README.md with full fix checklist for ALL failing checks
- "Download Fix Pack" button in AuditDetail Priority fixes section

### 2.3 Bulk Audit / B2B ⬜
- CSV upload: list of URLs
- Parallel audit of 10-50 sites
- Aggregate report with ranking

### 2.4 Public Leaderboard ✅ Done
- `/leaderboard` page — top 50 domains by score
- One entry per domain (deduped by domain, latest audit wins)
- Medals 🥇🥈🥉 for top 3
- Trophy icon in Dashboard sidebar

### 2.5 Embeddable Badge ✅ Done (Phase 1.1)

### 2.6 Improve seo4agent.com Score ✅ Partial

**Done:**
- [x] security.txt → /.well-known/security.txt
- [x] WebMCP → /.well-known/mcp.json
- [x] /sitemap.xml
- [x] /llms.txt (static + backend)
- [x] OG meta tags + Schema.org JSON-LD in index.html

**Remaining (from self-audit fix pack):**
- [ ] **l2_openapi** — expose /openapi.json via nginx proxy (FastAPI generates it automatically at /openapi.json, just need to add it to nginx location regex)
- [ ] **l3_ratelimit** — add X-RateLimit-Limit / X-RateLimit-Remaining headers to FastAPI responses (slowapi or manual middleware)
- [ ] **l1_semantic** — requires SSR/pre-rendering; low priority for now
- [ ] **l1_ssr** — requires SSR (Next.js migration or pre-render); architectural decision
- [ ] **l4_auth** — API keys for external access; implement when public API tier is ready
- [ ] **l4_x402** — after payment system is live

---

## Phase 3 — Open Source + MCP

### 3.1 Extract agentable-core package
- New repo: `github.com/[username]/agentable-core`
- Extract `checker.py` into standalone Python package
- CLI: `pip install agentable-core` → `agentable audit https://example.com`
- MIT license

### 3.2 MCP Server
- Wrap checker as MCP tool: `check_agent_readiness(url: str) -> AuditReport`
- Publish as `agentable-mcp` package
- Works with Claude Code, Cursor, any MCP client

### 3.3 GitHub Actions Integration
- `agentable-action`: runs audit on PR/deploy
- Fails CI if score drops below threshold
- Posts comment with diff vs previous audit

---

## Current Architecture Reference

```
/opt/agentable/
├── backend/
│   ├── main.py                    # FastAPI app
│   ├── app/
│   │   ├── db.py                  # SQLAlchemy models (User, Audit)
│   │   ├── schemas.py             # Pydantic schemas
│   │   ├── auth.py                # JWT auth (7-day expiry)
│   │   ├── api/
│   │   │   ├── audit.py           # /audit/run (SSE), /audit/history, /audit/compare,
│   │   │   │                      # /audit/leaderboard, /audit/domain-history, /audit/:id
│   │   │   ├── auth.py            # register, login, /me
│   │   │   ├── admin.py           # admin stats, user management
│   │   │   ├── badge.py           # GET /badge/{domain} → SVG
│   │   │   └── generate.py        # POST /generate/llms-txt, POST /generate/fix-pack
│   │   └── auditor/
│   │       └── checker.py         # 24 checks across L0-L5 ← CORE
├── frontend/src/
│   ├── pages/
│   │   ├── Dashboard.tsx          # Main audit UI + sidebar (Compare, Leaderboard)
│   │   ├── AuditDetail.tsx        # Report at /report/:id (renamed from /audit/:id)
│   │   ├── Compare.tsx            # /compare — side-by-side comparison
│   │   ├── Leaderboard.tsx        # /leaderboard — public top-50
│   │   └── Admin.tsx              # Admin panel
│   └── store/auth.ts              # Zustand auth state
├── frontend/public/
│   ├── llms.txt                   # Static llms.txt for seo4agent.com
│   ├── sitemap.xml                # Static sitemap
│   └── .well-known/
│       ├── security.txt           # RFC 9116 security contact
│       └── mcp.json               # WebMCP discovery manifest
└── agentable.db                   # SQLite
```

**Audit levels (24 checks):**
- L0: Reachability (2 checks) — reach, block
- L1: Basic Accessibility (6 checks) — https, title, metadesc, og, schema, semantic, ssr
- L2: Discoverability (5 checks) — robots, sitemap, llmstxt, securitytxt, openapi
- L3: Structured Interaction (3 checks) — agentcard, jsonapi, ratelimit
- L4: Agent Integration (5 checks) — mcp, webmcp, webhooks, auth, x402
- L5: Autonomous Operation (3 checks) — streaming, subscriptions, manifest

**Nginx routes:**
- `~ ^/(auth|audit|admin|health|docs|badge|generate)` → FastAPI :8002
- `/sub` → VPN sub server :9090 ← DO NOT TOUCH
- `/` → frontend dist (SPA)
- Frontend audit reports live at `/report/:id` (not `/audit/:id`)
