export interface Step {
  title: string
  description?: string
  code?: string
  language?: string
  file?: string          // e.g. "public/llms.txt"
  note?: string
}

export interface Guide {
  check_id: string
  title: string
  why: string
  steps: Step[]
  deploy?: string        // How to deploy / apply the fix
  links?: { label: string; url: string }[]
}

const GUIDES: Record<string, Guide> = {

  // ── L1 ────────────────────────────────────────────────────────────────────

  l1_semantic: {
    check_id: 'l1_semantic',
    title: 'Add Semantic HTML Structure',
    why: 'AI agents parse raw HTML to understand page structure. Without semantic tags like <main>, <nav>, <article>, they can\'t determine what\'s content, navigation, or footer — so they either skip the page or misread it.',
    steps: [
      {
        title: 'Replace generic <div> wrappers with semantic tags',
        description: 'Wrap your main content areas using the correct HTML5 elements:',
        code: `<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
  </header>

  <main>
    <article>
      <h1>Page Title</h1>
      <section>
        <p>Your content here...</p>
      </section>
    </article>

    <aside>
      Related links or sidebar
    </aside>
  </main>

  <footer>
    <p>© 2026 Your Company</p>
  </footer>
</body>`,
        language: 'html',
        file: 'Your main layout template (e.g. layout.html, _layout.tsx, index.html)',
      },
    ],
    deploy: 'Deploy like any HTML change. No server restart needed — just push/upload updated templates.',
  },

  l1_title: {
    check_id: 'l1_title',
    title: 'Add a <title> Tag',
    why: 'The page title is the first thing AI agents read to understand what a page is about. Missing or empty title means the agent has no context.',
    steps: [
      {
        title: 'Add <title> inside <head>',
        code: `<head>
  <title>Your Page Name — Brand Name</title>
</head>`,
        language: 'html',
        file: 'Every HTML page or your layout template',
        note: 'For Next.js use: export const metadata = { title: "..." } or <Head><title>...</title></Head>',
      },
    ],
  },

  l1_metadesc: {
    check_id: 'l1_metadesc',
    title: 'Add Meta Description',
    why: 'Meta descriptions give agents a concise summary of the page without parsing all content. Without it, agents must infer meaning from raw text.',
    steps: [
      {
        title: 'Add meta description tag inside <head>',
        code: `<head>
  <title>Page Title</title>
  <meta name="description" content="A clear 120-160 character description of what this page is about." />
</head>`,
        language: 'html',
        file: 'Every page or your layout template',
      },
      {
        title: 'For Next.js (App Router)',
        code: `// app/layout.tsx or app/page.tsx
export const metadata = {
  title: 'Page Title',
  description: 'A clear description of this page.',
}`,
        language: 'typescript',
        file: 'app/layout.tsx',
      },
    ],
  },

  l1_og: {
    check_id: 'l1_og',
    title: 'Add Open Graph Tags',
    why: 'OG tags give agents structured metadata (title, description, image) in a predictable format. They\'re faster to parse than body text and used by AI crawlers to build knowledge graphs.',
    steps: [
      {
        title: 'Add these tags inside <head>',
        code: `<head>
  <!-- Open Graph -->
  <meta property="og:title"       content="Your Page Title" />
  <meta property="og:description" content="What this page is about." />
  <meta property="og:image"       content="https://yourdomain.com/og-image.png" />
  <meta property="og:url"         content="https://yourdomain.com/this-page" />
  <meta property="og:type"        content="website" />

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="Your Page Title" />
  <meta name="twitter:description" content="What this page is about." />
  <meta name="twitter:image"       content="https://yourdomain.com/og-image.png" />
</head>`,
        language: 'html',
        file: 'Layout template or each page <head>',
      },
    ],
    deploy: 'Static HTML: update and re-upload. Next.js/Nuxt: use metadata API or react-helmet. WordPress: use Yoast SEO plugin.',
  },

  l1_schema: {
    check_id: 'l1_schema',
    title: 'Add Schema.org JSON-LD',
    why: 'JSON-LD is the primary way AI agents understand the semantic meaning of your page. It tells them "this is an Organization", "this is an Article", "this is a Product" — instead of guessing from layout.',
    steps: [
      {
        title: 'For a company/website — add Organization schema',
        code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company Name",
  "url": "https://yourdomain.com",
  "logo": "https://yourdomain.com/logo.png",
  "description": "What your company does.",
  "sameAs": [
    "https://twitter.com/yourhandle",
    "https://linkedin.com/company/yourcompany"
  ]
}
</script>`,
        language: 'html',
        file: 'Inside <head> on your homepage (and layout for sitewide)',
      },
      {
        title: 'For blog articles — add Article schema',
        code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Article Title Here",
  "description": "Short description of the article.",
  "author": {
    "@type": "Person",
    "name": "Author Name"
  },
  "datePublished": "2026-04-14",
  "publisher": {
    "@type": "Organization",
    "name": "Your Brand"
  }
}
</script>`,
        language: 'html',
        file: 'Inside <head> on each article/blog page',
      },
    ],
    deploy: 'Paste into your HTML template <head> section. Validate at: https://validator.schema.org',
    links: [{ label: 'Schema.org Validator', url: 'https://validator.schema.org' }],
  },

  l1_ssr: {
    check_id: 'l1_ssr',
    title: 'Enable Server-Side Rendering',
    why: 'AI crawlers don\'t execute JavaScript. If your content loads via React/Vue/Angular client-side, crawlers see an empty page. You need content in the initial HTML response.',
    steps: [
      {
        title: 'Option A: Enable SSR in Next.js (recommended)',
        code: `// Use 'use server' components (App Router) — content renders on server by default
// app/page.tsx
export default async function Page() {
  const data = await fetchData() // server-side fetch
  return <main>{data.content}</main>
}`,
        language: 'typescript',
        file: 'app/page.tsx',
      },
      {
        title: 'Option B: Use Static Site Generation (SSG)',
        code: `// Next.js Pages Router
export async function getStaticProps() {
  const data = await fetchData()
  return { props: { data } }
}`,
        language: 'typescript',
        note: 'SSG generates HTML at build time — fast and fully crawlable.',
      },
      {
        title: 'Option C: For Webflow/WordPress/other CMS',
        description: 'These platforms render server-side by default. If you\'re seeing this warning, check if you have a JavaScript-only widget hiding key content. Move critical text out of JS-rendered components.',
      },
    ],
    deploy: 'Rebuild and redeploy after enabling SSR/SSG.',
  },

  // ── L2 ────────────────────────────────────────────────────────────────────

  l2_robots: {
    check_id: 'l2_robots',
    title: 'Create / Fix robots.txt',
    why: 'robots.txt tells crawlers which pages they can access. Many sites accidentally block AI crawlers (GPTBot, ClaudeBot) via overly broad Disallow rules.',
    steps: [
      {
        title: 'Create robots.txt at your domain root',
        code: `# Allow all crawlers including AI bots
User-agent: *
Allow: /

# Explicitly allow known AI crawlers
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: anthropic-ai
Allow: /

# Block only sensitive paths (adjust as needed)
User-agent: *
Disallow: /admin/
Disallow: /api/private/

# Sitemap location
Sitemap: https://yourdomain.com/sitemap.xml`,
        language: 'text',
        file: 'public/robots.txt  (or the root of your web server)',
      },
    ],
    deploy: 'Upload to web root so it\'s accessible at https://yourdomain.com/robots.txt. For Next.js: place in /public/robots.txt. For Webflow: Settings → SEO → robots.txt field.',
  },

  l2_sitemap: {
    check_id: 'l2_sitemap',
    title: 'Create XML Sitemap',
    why: 'Sitemaps tell agents which pages exist and when they were last updated — essential for discovery beyond the homepage.',
    steps: [
      {
        title: 'For a static site — create sitemap.xml manually',
        code: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://yourdomain.com/</loc>
    <lastmod>2026-04-14</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://yourdomain.com/about</loc>
    <lastmod>2026-04-14</lastmod>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://yourdomain.com/blog</loc>
    <lastmod>2026-04-14</lastmod>
    <priority>0.9</priority>
  </url>
</urlset>`,
        language: 'xml',
        file: 'public/sitemap.xml',
      },
      {
        title: 'For Next.js — auto-generate with next-sitemap',
        code: `# Install
npm install next-sitemap

# next-sitemap.config.js
module.exports = {
  siteUrl: 'https://yourdomain.com',
  generateRobotsTxt: true,
}

# package.json — add to build script:
"postbuild": "next-sitemap"`,
        language: 'bash',
      },
      {
        title: 'For WordPress',
        description: 'Install Yoast SEO or RankMath — they auto-generate a sitemap at /sitemap_index.xml.',
      },
    ],
    deploy: 'After creating/generating sitemap.xml, also add it to robots.txt: Sitemap: https://yourdomain.com/sitemap.xml',
  },

  l2_llmstxt: {
    check_id: 'l2_llmstxt',
    title: 'Create llms.txt',
    why: 'llms.txt is an emerging standard (like robots.txt but for LLMs) that tells AI agents: what your product is, where your docs are, what your API does — in plain text they can read before crawling anything else.',
    steps: [
      {
        title: 'Create /llms.txt at your domain root',
        description: 'Replace the placeholders with your actual information:',
        code: `# llms.txt — Machine-readable product guide for AI agents
# Learn more: https://llmstxt.org

## About
Name: Your Product Name
Description: What your product does in 1-2 sentences.
URL: https://yourdomain.com

## Key Pages
- Homepage: https://yourdomain.com/
- About: https://yourdomain.com/about
- Blog: https://yourdomain.com/blog
- Contact: https://yourdomain.com/contact

## Documentation
- Docs: https://yourdomain.com/docs
- API: https://yourdomain.com/api

## Contact
- Email: hello@yourdomain.com
- Twitter: @yourhandle

## Notes
This site provides [describe what you do].
Agents may freely read and index all public content.`,
        language: 'text',
        file: 'public/llms.txt  →  accessible at https://yourdomain.com/llms.txt',
      },
    ],
    deploy: 'Next.js: place in /public/llms.txt. Webflow: host on CDN and redirect /llms.txt via Cloudflare Worker. Nginx: add static file. Verify at: https://yourdomain.com/llms.txt',
    links: [{ label: 'llmstxt.org spec', url: 'https://llmstxt.org' }],
  },

  l2_openapi: {
    check_id: 'l2_openapi',
    title: 'Publish an OpenAPI Spec',
    why: 'OpenAPI is the machine-readable contract for your API. Without it, agents must guess your API structure by trial and error. With it, they can discover all endpoints, parameters, and responses instantly.',
    steps: [
      {
        title: 'Option A: Static site with no API — publish a minimal spec',
        code: `{
  "openapi": "3.0.0",
  "info": {
    "title": "Your Site Name",
    "version": "1.0.0",
    "description": "Public API for yourdomain.com"
  },
  "servers": [
    { "url": "https://yourdomain.com" }
  ],
  "paths": {}
}`,
        language: 'json',
        file: 'public/openapi.json  →  https://yourdomain.com/openapi.json',
      },
      {
        title: 'Option B: FastAPI backend — it auto-generates OpenAPI',
        code: `# FastAPI generates /openapi.json automatically.
# Just make sure it's accessible:
from fastapi import FastAPI
app = FastAPI(title="Your API", version="1.0.0")

# Access at: http://yourbackend.com/openapi.json`,
        language: 'python',
      },
      {
        title: 'Option C: Express/Node.js — use swagger-jsdoc',
        code: `npm install swagger-jsdoc swagger-ui-express

// app.js
const swaggerJsdoc = require('swagger-jsdoc')
const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'API', version: '1.0.0' },
  },
  apis: ['./routes/*.js'],
})
app.get('/openapi.json', (req, res) => res.json(spec))`,
        language: 'javascript',
      },
    ],
    deploy: 'After publishing, verify at: https://yourdomain.com/openapi.json',
  },

  // ── L3 ────────────────────────────────────────────────────────────────────

  l3_agentcard: {
    check_id: 'l3_agentcard',
    title: 'Publish Agent Card',
    why: 'An agent card at /.well-known/agent.json is a machine-readable profile of your site: what it does, what actions agents can take, and how to authenticate. It\'s like an API welcome page specifically for AI agents.',
    steps: [
      {
        title: 'Create /.well-known/agent.json',
        code: `{
  "name": "Your Product Name",
  "description": "What your product does.",
  "url": "https://yourdomain.com",
  "version": "1.0.0",
  "capabilities": [
    "read-content",
    "search"
  ],
  "authentication": {
    "type": "none",
    "description": "All public content is freely accessible"
  },
  "actions": [
    {
      "name": "search",
      "description": "Search site content",
      "url": "https://yourdomain.com/search?q={query}"
    }
  ],
  "contact": {
    "email": "hello@yourdomain.com"
  }
}`,
        language: 'json',
        file: 'public/.well-known/agent.json  →  https://yourdomain.com/.well-known/agent.json',
      },
      {
        title: 'For Next.js — create the directory and file',
        code: `# Create directory
mkdir -p public/.well-known

# Create the file
# public/.well-known/agent.json
# (paste JSON from above)`,
        language: 'bash',
      },
      {
        title: 'For Nginx — serve the .well-known directory',
        code: `# nginx.conf — add to your server block:
location /.well-known/ {
    alias /var/www/yourdomain/.well-known/;
    add_header Access-Control-Allow-Origin *;
}`,
        language: 'nginx',
      },
    ],
    deploy: 'Upload agent.json to /.well-known/ at your web root. Verify at: https://yourdomain.com/.well-known/agent.json',
  },

  l3_jsonapi: {
    check_id: 'l3_jsonapi',
    title: 'Expose a JSON API Endpoint',
    why: 'Agents prefer machine-readable JSON over scraping HTML. Even a simple read-only API for your content lets agents reliably fetch structured data without fragile HTML parsing.',
    steps: [
      {
        title: 'Minimal read-only API with FastAPI',
        code: `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"])

@app.get("/api/info")
def info():
    return {
        "name": "Your Site",
        "description": "What you do",
        "url": "https://yourdomain.com"
    }

@app.get("/api/content")
def content():
    return {
        "articles": [
            {"id": 1, "title": "...", "url": "..."}
        ]
    }`,
        language: 'python',
        file: 'api/main.py',
      },
      {
        title: 'Minimal JSON API with Node.js/Express',
        code: `const express = require('express')
const app = express()

app.get('/api/info', (req, res) => {
  res.json({
    name: 'Your Site',
    description: 'What you do',
    url: 'https://yourdomain.com'
  })
})

app.listen(3000)`,
        language: 'javascript',
      },
    ],
    deploy: 'Deploy as a serverless function (Vercel, Netlify Functions, AWS Lambda) or a dedicated API server.',
  },

  l3_ratelimit: {
    check_id: 'l3_ratelimit',
    title: 'Add Rate Limit Headers',
    why: 'Without rate limit headers, agents can\'t self-throttle and may accidentally hammer your server. Standard headers let agents know when to slow down without getting blocked.',
    steps: [
      {
        title: 'Add headers in FastAPI with slowapi',
        code: `pip install slowapi

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from fastapi import FastAPI, Request

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter

@app.get("/api/data")
@limiter.limit("60/minute")
async def data(request: Request):
    return {"data": "..."}`,
        language: 'python',
      },
      {
        title: 'Add headers manually in Express/Node',
        code: `app.use((req, res, next) => {
  res.setHeader('X-RateLimit-Limit', '100')
  res.setHeader('X-RateLimit-Remaining', '99')
  res.setHeader('X-RateLimit-Reset', String(Math.floor(Date.now()/1000) + 60))
  next()
})`,
        language: 'javascript',
      },
      {
        title: 'Add at Nginx/Cloudflare level',
        code: `# nginx.conf
limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;

location /api/ {
    limit_req zone=api burst=20 nodelay;
    add_header X-RateLimit-Limit 60;
    proxy_pass http://backend;
}`,
        language: 'nginx',
      },
    ],
  },

  // ── L4 ────────────────────────────────────────────────────────────────────

  l4_mcp: {
    check_id: 'l4_mcp',
    title: 'Implement an MCP Server',
    why: 'Model Context Protocol (MCP) is the standard for exposing your site\'s capabilities directly to AI agents. With an MCP server, agents like Claude can call your functions natively — search your content, submit forms, fetch data — without any custom integration.',
    steps: [
      {
        title: 'Install MCP SDK',
        code: `# Python
pip install mcp

# or Node.js
npm install @modelcontextprotocol/sdk`,
        language: 'bash',
      },
      {
        title: 'Minimal MCP server in Python',
        code: `from mcp.server import Server
from mcp.server.stdio import stdio_server
import mcp.types as types

server = Server("your-site-mcp")

@server.list_tools()
async def list_tools():
    return [
        types.Tool(
            name="get_content",
            description="Get content from your site",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"}
                }
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "get_content":
        # Fetch and return your content
        return [types.TextContent(type="text", text=f"Results for: {arguments['query']}")]

async def main():
    async with stdio_server() as streams:
        await server.run(*streams, server.create_initialization_options())`,
        language: 'python',
        file: 'mcp_server.py',
      },
    ],
    deploy: 'Host MCP server and expose via HTTP at /mcp endpoint. See docs at modelcontextprotocol.io',
    links: [{ label: 'MCP Documentation', url: 'https://modelcontextprotocol.io' }],
  },

  l4_webhooks: {
    check_id: 'l4_webhooks',
    title: 'Add Webhook Support',
    why: 'Webhooks let agents receive notifications when things happen on your site (new content, status changes) — instead of polling repeatedly. This makes agent workflows async and efficient.',
    steps: [
      {
        title: 'Add webhook endpoint in FastAPI',
        code: `from fastapi import FastAPI, BackgroundTasks
import httpx

app = FastAPI()

# Store webhook subscriptions (use DB in production)
webhooks = []

@app.post("/webhooks/subscribe")
async def subscribe(url: str, events: list[str]):
    webhooks.append({"url": url, "events": events})
    return {"status": "subscribed"}

async def notify_webhooks(event: str, payload: dict):
    async with httpx.AsyncClient() as client:
        for wh in webhooks:
            if event in wh["events"]:
                try:
                    await client.post(wh["url"], json={"event": event, **payload})
                except Exception:
                    pass

# Call this when something happens:
# await notify_webhooks("content.published", {"id": 1, "title": "..."})`,
        language: 'python',
      },
    ],
  },

  l4_auth: {
    check_id: 'l4_auth',
    title: 'Add Agent-Friendly Auth (API Keys)',
    why: 'Session cookies and browser-based login flows don\'t work for AI agents. They need API keys or OAuth client credentials to authenticate programmatically.',
    steps: [
      {
        title: 'Add API key authentication in FastAPI',
        code: `from fastapi import FastAPI, HTTPException, Security
from fastapi.security import APIKeyHeader

app = FastAPI()
API_KEY_HEADER = APIKeyHeader(name="X-API-Key")

VALID_KEYS = {"your-api-key-here"}  # use DB in production

async def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
    if api_key not in VALID_KEYS:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return api_key

@app.get("/api/protected")
async def protected(key: str = Security(verify_api_key)):
    return {"data": "protected content"}`,
        language: 'python',
      },
      {
        title: 'Document the API key in llms.txt and agent.json',
        code: `# llms.txt — add this section:

## Authentication
API keys are available at: https://yourdomain.com/settings/api
Include in header: X-API-Key: your_key_here`,
        language: 'text',
      },
    ],
  },

  // ── L5 ────────────────────────────────────────────────────────────────────

  l5_streaming: {
    check_id: 'l5_streaming',
    title: 'Add SSE (Server-Sent Events)',
    why: 'Real-time streaming lets agents receive updates as they happen — new content, status changes, completions — without polling. Required for L5 autonomous operation.',
    steps: [
      {
        title: 'SSE endpoint in FastAPI',
        code: `from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio

app = FastAPI()

async def event_generator():
    while True:
        # Send events as they happen
        yield f"data: {{'type': 'heartbeat', 'ts': 'now'}}\\n\\n"
        await asyncio.sleep(30)

@app.get("/events")
async def events():
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )`,
        language: 'python',
        file: 'api/main.py',
      },
      {
        title: 'SSE in Node.js/Express',
        code: `app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const send = (data) => res.write(\`data: \${JSON.stringify(data)}\n\n\`)

  // Send events:
  send({ type: 'connected' })
  const interval = setInterval(() => send({ type: 'heartbeat' }), 30000)
  req.on('close', () => clearInterval(interval))
})`,
        language: 'javascript',
      },
    ],
  },

  l5_subscriptions: {
    check_id: 'l5_subscriptions',
    title: 'Add Subscription API',
    why: 'A subscription API lets agents manage their own data feeds — subscribe to topics, set preferences, manage notifications. Required for fully autonomous operation.',
    steps: [
      {
        title: 'Minimal subscription API in FastAPI',
        code: `from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Subscription(BaseModel):
    url: str
    topics: list[str]

subscriptions = []

@app.post("/subscriptions")
async def subscribe(sub: Subscription):
    subscriptions.append(sub)
    return {"id": len(subscriptions), "status": "active"}

@app.get("/subscriptions")
async def list_subs():
    return subscriptions

@app.delete("/subscriptions/{id}")
async def unsubscribe(id: int):
    subscriptions.pop(id - 1)
    return {"status": "cancelled"}`,
        language: 'python',
      },
    ],
  },

  l5_manifest: {
    check_id: 'l5_manifest',
    title: 'Publish AI Plugin Manifest',
    why: 'The ai-plugin.json manifest (originally from ChatGPT plugins) enables cross-service agent handoffs and is used by many AI orchestration systems to discover your capabilities.',
    steps: [
      {
        title: 'Create /.well-known/ai-plugin.json',
        code: `{
  "schema_version": "v1",
  "name_for_human": "Your Site Name",
  "name_for_model": "your_site",
  "description_for_human": "What your site does, for humans.",
  "description_for_model": "Use this to access content and data from yourdomain.com. You can search, retrieve articles, and get structured information.",
  "auth": {
    "type": "none"
  },
  "api": {
    "type": "openapi",
    "url": "https://yourdomain.com/openapi.json"
  },
  "logo_url": "https://yourdomain.com/logo.png",
  "contact_email": "hello@yourdomain.com",
  "legal_info_url": "https://yourdomain.com/legal"
}`,
        language: 'json',
        file: 'public/.well-known/ai-plugin.json  →  https://yourdomain.com/.well-known/ai-plugin.json',
      },
    ],
    deploy: 'Place in public/.well-known/ folder. Same directory as agent.json if you already created it.',
  },

  // ── L0 ────────────────────────────────────────────────────────────────────

  l0_reach: {
    check_id: 'l0_reach',
    title: 'Fix Site Reachability',
    why: 'The site did not respond to an HTTP request. AI agents cannot read or index sites they cannot reach.',
    steps: [
      { title: 'Check your DNS settings', description: 'Ensure the domain resolves correctly. Run: dig yourdomain.com' },
      { title: 'Check server status', description: 'SSH into your server and check if the web server (nginx/apache/node) is running.' },
      { title: 'Check SSL certificate', description: 'Expired SSL certs cause connection failures. Renew with Let\'s Encrypt: certbot renew' },
    ],
  },

  l0_block: {
    check_id: 'l0_block',
    title: 'Stop Blocking AI Crawlers',
    why: 'Your WAF/CDN/firewall is returning 403 or 429 to automated requests. This blocks all AI agents from reading your site.',
    steps: [
      {
        title: 'Cloudflare — whitelist known AI bots',
        description: 'In Cloudflare dashboard → Security → Bots → Allow "Verified Bots". Also check your WAF rules for rules blocking bots.',
      },
      {
        title: 'Update robots.txt to explicitly allow AI crawlers',
        code: `User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /`,
        language: 'text',
        file: 'public/robots.txt',
      },
    ],
  },
}

export function getGuide(check_id: string): Guide | null {
  return GUIDES[check_id] ?? null
}
