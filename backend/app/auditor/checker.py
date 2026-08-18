"""
AI Agent Readiness Auditor — L0 through L5.

Each check is an async function that returns a dict with:
  check_id, level, name, passed, message, recommendation (optional)
"""

import asyncio
import json
import re
from typing import AsyncGenerator, Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": "AISEOSetup/1.0 (+https://aiseo.setup; audit bot)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

TIMEOUT = httpx.Timeout(12.0, connect=5.0)

AI_BOTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "anthropic-ai", "Googlebot", "Bingbot"]


def _base(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"


def _check(check_id: str, level: int, name: str, passed: bool,
           message: str, recommendation: str = None) -> dict:
    return {
        "check_id": check_id,
        "level": level,
        "name": name,
        "passed": passed,
        "message": message,
        "recommendation": recommendation,
    }


# ── Level 0: Reachability ─────────────────────────────────────────────────────

async def check_reachable(client: httpx.AsyncClient, url: str) -> dict:
    try:
        r = await client.get(url, headers=HEADERS, timeout=TIMEOUT)
        if r.status_code < 400:
            return _check("l0_reach", 0, "Site Reachable", True,
                          f"Site responded with HTTP {r.status_code}.")
        else:
            return _check("l0_reach", 0, "Site Reachable", False,
                          f"Site returned HTTP {r.status_code}.",
                          "Ensure the site is publicly accessible and returns a 2xx status.")
    except httpx.TimeoutException:
        return _check("l0_reach", 0, "Site Reachable", False,
                      "Request timed out after 12 seconds.",
                      "Check server availability and response time.")
    except Exception as e:
        return _check("l0_reach", 0, "Site Reachable", False,
                      f"Connection failed: {type(e).__name__}",
                      "Verify the URL is correct and the server is running.")


async def check_not_blocked(client: httpx.AsyncClient, url: str) -> dict:
    try:
        r = await client.get(url, headers=HEADERS)
        if r.status_code == 403:
            return _check("l0_block", 0, "Not Blocked", False,
                          "Site returned 403 Forbidden — AI crawlers may be blocked.",
                          "Review WAF/CDN rules to allow legitimate AI crawlers.")
        if r.status_code == 429:
            return _check("l0_block", 0, "Not Blocked", False,
                          "Site rate-limited the request (429).",
                          "Ensure AI crawlers are not rate-limited before they can read content.")
        return _check("l0_block", 0, "Not Blocked", True,
                      f"No blocking detected (HTTP {r.status_code}).")
    except Exception:
        return _check("l0_block", 0, "Not Blocked", False,
                      "Could not determine blocking status.",
                      "Ensure the site is publicly accessible.")


# ── Level 1: Basic Accessibility ──────────────────────────────────────────────

def _l1_checks(html: str, response: httpx.Response) -> list[dict]:
    results = []
    soup = BeautifulSoup(html, "html.parser")

    # Semantic HTML
    semantic_tags = ["header", "nav", "main", "article", "section", "footer"]
    found = [t for t in semantic_tags if soup.find(t)]
    passed = len(found) >= 3
    results.append(_check(
        "l1_semantic", 1, "Semantic HTML",
        passed,
        f"Found {len(found)}/{len(semantic_tags)} semantic tags: {', '.join(found) or 'none'}.",
        None if passed else "Add <header>, <nav>, <main>, <article>, <section>, <footer> to your HTML structure."
    ))

    # Meta title
    title = soup.find("title")
    has_title = bool(title and title.get_text(strip=True))
    results.append(_check(
        "l1_title", 1, "Meta Title",
        has_title,
        f"Title: \"{title.get_text(strip=True)[:80]}\"" if has_title else "No <title> tag found.",
        None if has_title else "Add a descriptive <title> tag to every page."
    ))

    # Meta description
    meta_desc = soup.find("meta", attrs={"name": "description"})
    has_desc = bool(meta_desc and meta_desc.get("content", "").strip())
    results.append(_check(
        "l1_metadesc", 1, "Meta Description",
        has_desc,
        "Meta description found." if has_desc else "No meta description found.",
        None if has_desc else "Add <meta name=\"description\" content=\"...\"> to every page."
    ))

    # Open Graph tags
    og_title = soup.find("meta", attrs={"property": "og:title"})
    og_desc  = soup.find("meta", attrs={"property": "og:description"})
    og_image = soup.find("meta", attrs={"property": "og:image"})
    og_count = sum(1 for t in [og_title, og_desc, og_image] if t)
    has_og = og_count >= 2
    results.append(_check(
        "l1_og", 1, "Open Graph Tags",
        has_og,
        f"{og_count}/3 OG tags found (og:title, og:description, og:image).",
        None if has_og else "Add og:title, og:description, og:image meta tags for better agent parsing."
    ))

    # Schema.org JSON-LD
    scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    has_schema = len(scripts) > 0
    schema_types = []
    for s in scripts:
        try:
            data = json.loads(s.string or "")
            t = data.get("@type") if isinstance(data, dict) else None
            if t:
                schema_types.append(t)
        except Exception:
            pass
    results.append(_check(
        "l1_schema", 1, "Schema.org / JSON-LD",
        has_schema,
        f"Found {len(scripts)} JSON-LD block(s): {', '.join(schema_types) or 'unknown types'}." if has_schema
        else "No JSON-LD structured data found.",
        None if has_schema else "Add schema.org JSON-LD (Organization, Article, Product, FAQ) to your pages."
    ))

    # Server-side rendering (content in raw HTML)
    text_content = soup.get_text(strip=True)
    has_content = len(text_content) > 200
    results.append(_check(
        "l1_ssr", 1, "Server-Side Rendering",
        has_content,
        f"Initial HTML contains ~{len(text_content)} characters of text content." if has_content
        else "Very little text in initial HTML — content may be JavaScript-only.",
        None if has_content else "Ensure critical content is server-rendered (SSR/SSG), not loaded via client-side JS."
    ))

    return results


# ── Level 2: Discoverability ──────────────────────────────────────────────────

async def _l2_checks(client: httpx.AsyncClient, base: str) -> list[dict]:
    results = []

    # robots.txt
    try:
        r = await client.get(f"{base}/robots.txt", headers=HEADERS, timeout=TIMEOUT)
        has_robots = r.status_code == 200 and len(r.text) > 10
        blocked_bots = [b for b in AI_BOTS if f"Disallow: /" in r.text and b in r.text]
        if has_robots and not blocked_bots:
            results.append(_check("l2_robots", 2, "robots.txt", True,
                                  "robots.txt found and no major AI crawlers are explicitly blocked."))
        elif has_robots and blocked_bots:
            results.append(_check("l2_robots", 2, "robots.txt", False,
                                  f"robots.txt found but blocks: {', '.join(blocked_bots)}.",
                                  "Review Disallow rules — ensure AI crawlers like GPTBot and ClaudeBot can access content."))
        else:
            results.append(_check("l2_robots", 2, "robots.txt", False,
                                  "No robots.txt found.",
                                  "Create /robots.txt to guide crawlers and avoid accidental blocking."))
    except Exception:
        results.append(_check("l2_robots", 2, "robots.txt", False,
                              "Could not fetch robots.txt.",
                              "Create /robots.txt at the root of your domain."))

    # XML Sitemap
    sitemap_found = False
    for path in ["/sitemap.xml", "/sitemap_index.xml", "/sitemap"]:
        try:
            r = await client.get(f"{base}{path}", headers=HEADERS, timeout=TIMEOUT)
            if r.status_code == 200 and ("<url" in r.text or "<sitemap" in r.text):
                sitemap_found = True
                results.append(_check("l2_sitemap", 2, "XML Sitemap", True,
                                      f"Sitemap found at {path}."))
                break
        except Exception:
            pass
    if not sitemap_found:
        results.append(_check("l2_sitemap", 2, "XML Sitemap", False,
                              "No XML sitemap found at /sitemap.xml or /sitemap_index.xml.",
                              "Create and submit an XML sitemap listing all major pages."))

    # llms.txt
    try:
        r = await client.get(f"{base}/llms.txt", headers=HEADERS, timeout=TIMEOUT)
        has_llms = r.status_code == 200 and len(r.text) > 20
        results.append(_check(
            "l2_llmstxt", 2, "llms.txt",
            has_llms,
            "llms.txt found — agents can discover your product description and docs." if has_llms
            else "No /llms.txt found.",
            None if has_llms else "Publish /llms.txt describing your product, API, and doc locations for AI agents."
        ))
    except Exception:
        results.append(_check("l2_llmstxt", 2, "llms.txt", False,
                              "Could not check for llms.txt.",
                              "Publish /llms.txt at your domain root."))

    # security.txt
    try:
        r = await client.get(f"{base}/.well-known/security.txt", headers=HEADERS, timeout=TIMEOUT)
        if r.status_code != 200:
            r = await client.get(f"{base}/security.txt", headers=HEADERS, timeout=TIMEOUT)
        has_security = r.status_code == 200 and len(r.text) > 10
        results.append(_check(
            "l2_securitytxt", 2, "security.txt",
            has_security,
            "security.txt found — agents and researchers can report issues responsibly." if has_security
            else "No security.txt found.",
            None if has_security else "Publish /.well-known/security.txt per RFC 9116 with contact and policy URLs."
        ))
    except Exception:
        results.append(_check("l2_securitytxt", 2, "security.txt", False,
                              "Could not check for security.txt.",
                              "Publish /.well-known/security.txt per RFC 9116."))

    # OpenAPI spec
    openapi_found = False
    for path in ["/openapi.json", "/api/openapi.json", "/swagger.json",
                 "/api/docs/openapi.json", "/v1/openapi.json"]:
        try:
            r = await client.get(f"{base}{path}", headers={**HEADERS, "Accept": "application/json"},
                                 timeout=TIMEOUT)
            if r.status_code == 200 and "openapi" in r.text.lower():
                openapi_found = True
                results.append(_check("l2_openapi", 2, "OpenAPI Spec", True,
                                      f"OpenAPI specification found at {path}."))
                break
        except Exception:
            pass
    if not openapi_found:
        results.append(_check("l2_openapi", 2, "OpenAPI Spec", False,
                              "No OpenAPI/Swagger spec found at common paths.",
                              "Publish a machine-readable OpenAPI spec at /openapi.json."))

    return results


# ── Level 3: Structured Interaction ───────────────────────────────────────────

async def _l3_checks(client: httpx.AsyncClient, base: str) -> list[dict]:
    results = []

    # Agent card
    try:
        r = await client.get(f"{base}/.well-known/agent.json",
                             headers={**HEADERS, "Accept": "application/json"}, timeout=TIMEOUT)
        has_agent = r.status_code == 200
        results.append(_check(
            "l3_agentcard", 3, "Agent Card",
            has_agent,
            "Agent card found at /.well-known/agent.json — agents can discover capabilities." if has_agent
            else "No agent card at /.well-known/agent.json.",
            None if has_agent else "Publish /.well-known/agent.json describing your capabilities, auth methods, and actions."
        ))
    except Exception:
        results.append(_check("l3_agentcard", 3, "Agent Card", False,
                              "Could not check for agent card.",
                              "Publish /.well-known/agent.json."))

    # JSON API response
    api_json = False
    for path in ["/api", "/api/v1", "/v1", "/api/health", "/health"]:
        try:
            r = await client.get(f"{base}{path}",
                                 headers={**HEADERS, "Accept": "application/json"}, timeout=TIMEOUT)
            ct = r.headers.get("content-type", "")
            if r.status_code < 500 and "json" in ct:
                api_json = True
                results.append(_check("l3_jsonapi", 3, "JSON API", True,
                                      f"JSON response at {path} — API returns machine-readable data."))
                break
        except Exception:
            pass
    if not api_json:
        results.append(_check("l3_jsonapi", 3, "JSON API", False,
                              "No JSON API endpoint detected at common paths.",
                              "Expose a REST or GraphQL API returning predictable JSON responses."))

    # Rate limit headers
    try:
        r = await client.get(base, headers=HEADERS, timeout=TIMEOUT)
        rl_headers = [h for h in r.headers if "ratelimit" in h.lower() or "x-rate" in h.lower()]
        has_rl = len(rl_headers) > 0
        results.append(_check(
            "l3_ratelimit", 3, "Rate Limit Headers",
            has_rl,
            f"Rate limit headers found: {', '.join(rl_headers)}." if has_rl
            else "No rate limit headers detected.",
            None if has_rl else "Return X-RateLimit-Limit, X-RateLimit-Remaining, and Retry-After headers so agents can self-throttle."
        ))
    except Exception:
        results.append(_check("l3_ratelimit", 3, "Rate Limit Headers", False,
                              "Could not check rate limit headers.",
                              "Add rate limit headers to API responses."))

    return results


# ── Level 4: Agent Integration ────────────────────────────────────────────────

async def _l4_checks(client: httpx.AsyncClient, base: str) -> list[dict]:
    results = []

    # MCP server
    mcp_found = False
    for path in ["/mcp", "/.well-known/mcp.json", "/api/mcp"]:
        try:
            r = await client.get(f"{base}{path}", headers=HEADERS, timeout=TIMEOUT)
            if r.status_code < 404:
                mcp_found = True
                results.append(_check("l4_mcp", 4, "MCP Server", True,
                                      f"Potential MCP server detected at {path}."))
                break
        except Exception:
            pass
    if not mcp_found:
        results.append(_check("l4_mcp", 4, "MCP Server", False,
                              "No MCP (Model Context Protocol) server detected.",
                              "Implement an MCP server so AI agents can discover and call your functions directly."))

    # Webhook support
    webhook_found = False
    for path in ["/webhooks", "/webhook", "/api/webhooks"]:
        try:
            r = await client.get(f"{base}{path}", headers=HEADERS, timeout=TIMEOUT)
            if r.status_code < 404:
                webhook_found = True
                results.append(_check("l4_webhooks", 4, "Webhook Support", True,
                                      f"Webhook endpoint detected at {path}."))
                break
        except Exception:
            pass
    if not webhook_found:
        results.append(_check("l4_webhooks", 4, "Webhook Support", False,
                              "No webhook endpoints detected.",
                              "Implement webhooks so agents can receive async notifications of state changes."))

    # WebMCP (/.well-known/mcp.json — Google Lighthouse standard May 2026)
    webmcp_found = False
    for path in ["/.well-known/mcp.json", "/.well-known/mcp", "/mcp.json"]:
        try:
            r = await client.get(f"{base}{path}", headers=HEADERS, timeout=TIMEOUT)
            if r.status_code == 200:
                webmcp_found = True
                results.append(_check("l4_webmcp", 4, "WebMCP Discovery",  True,
                                      f"WebMCP discovery manifest found at {path}."))
                break
        except Exception:
            pass
    if not webmcp_found:
        results.append(_check("l4_webmcp", 4, "WebMCP Discovery", False,
                              "No WebMCP manifest at /.well-known/mcp.json.",
                              "Publish /.well-known/mcp.json to enable automatic MCP server discovery (WebMCP spec)."))

    # x402 payment protocol
    x402_found = False
    try:
        r = await client.get(f"{base}/api", headers={**HEADERS, "Accept": "application/json"},
                             timeout=TIMEOUT)
        x402_found = r.status_code == 402 or "x-payment" in " ".join(r.headers.keys()).lower()
    except Exception:
        pass
    if not x402_found:
        # Check /.well-known/x402 manifest
        try:
            r = await client.get(f"{base}/.well-known/x402", headers=HEADERS, timeout=TIMEOUT)
            if r.status_code == 200 and "x402Version" in r.text:
                x402_found = True
        except Exception:
            pass
    if not x402_found:
        # Try a few API paths
        for path in ["/api/v1", "/api/pay", "/payment"]:
            try:
                r = await client.get(f"{base}{path}", headers=HEADERS, timeout=TIMEOUT)
                if r.status_code == 402 or "x-payment" in " ".join(r.headers.keys()).lower():
                    x402_found = True
                    break
            except Exception:
                pass
    results.append(_check(
        "l4_x402", 4, "x402 Payment Protocol",
        x402_found,
        "x402 payment signals detected — agents can pay for API access autonomously." if x402_found
        else "No x402 payment protocol signals detected.",
        None if x402_found else "Implement HTTP 402 + x-payment headers to enable agent-native micropayments (x402 protocol)."
    ))

    # API key / OAuth hints
    try:
        r = await client.get(f"{base}/api", headers=HEADERS, timeout=TIMEOUT)
        auth_header = r.headers.get("www-authenticate", "")
        has_auth = bool(auth_header) or "api_key" in r.text.lower() or "bearer" in r.text.lower()
        results.append(_check(
            "l4_auth", 4, "Agent-Friendly Auth",
            has_auth,
            "API key / OAuth auth signals detected — agents can authenticate programmatically." if has_auth
            else "No API key or OAuth signals detected.",
            None if has_auth else "Support API keys or OAuth client credentials (not just session cookies) for agent auth."
        ))
    except Exception:
        results.append(_check("l4_auth", 4, "Agent-Friendly Auth", False,
                              "Could not check authentication mechanisms.",
                              "Expose API key or OAuth 2.0 client credentials for programmatic agent access."))

    return results


# ── Level 5: Autonomous Operation ─────────────────────────────────────────────

async def _l5_checks(client: httpx.AsyncClient, base: str) -> list[dict]:
    results = []

    # SSE / WebSocket
    sse_found = False
    sse_connect_timeout = httpx.Timeout(5.0, connect=3.0, read=0.5)
    for path in ["/events", "/stream", "/sse", "/api/events", "/api/stream"]:
        try:
            async with client.stream("GET", f"{base}{path}",
                                     headers={**HEADERS, "Accept": "text/event-stream"},
                                     timeout=sse_connect_timeout) as r:
                ct = r.headers.get("content-type", "")
                if "event-stream" in ct or r.status_code < 404:
                    sse_found = True
                    results.append(_check("l5_streaming", 5, "Event Streaming (SSE/WS)", True,
                                          f"Event stream endpoint detected at {path}."))
                    break
        except Exception:
            pass
    if not sse_found:
        results.append(_check("l5_streaming", 5, "Event Streaming (SSE/WS)", False,
                              "No Server-Sent Events or WebSocket streaming detected.",
                              "Implement SSE or WebSocket endpoints for real-time agent notifications."))

    # Subscription API
    sub_found = False
    for path in ["/subscriptions", "/api/subscriptions", "/subscribe"]:
        try:
            r = await client.get(f"{base}{path}", headers=HEADERS, timeout=TIMEOUT)
            if r.status_code < 404:
                sub_found = True
                results.append(_check("l5_subscriptions", 5, "Subscription API", True,
                                      f"Subscription endpoint detected at {path}."))
                break
        except Exception:
            pass
    if not sub_found:
        results.append(_check("l5_subscriptions", 5, "Subscription API", False,
                              "No subscription/management API detected.",
                              "Build a subscription API so agents can manage their own settings and data feeds."))

    # Agent manifest
    try:
        r = await client.get(f"{base}/.well-known/ai-plugin.json",
                             headers=HEADERS, timeout=TIMEOUT)
        has_manifest = r.status_code == 200
        results.append(_check(
            "l5_manifest", 5, "Agent Manifest",
            has_manifest,
            "AI plugin manifest found at /.well-known/ai-plugin.json." if has_manifest
            else "No agent manifest found.",
            None if has_manifest else "Publish /.well-known/ai-plugin.json or an agent manifest enabling cross-service agent handoffs."
        ))
    except Exception:
        results.append(_check("l5_manifest", 5, "Agent Manifest", False,
                              "Could not check for agent manifest.",
                              "Publish /.well-known/ai-plugin.json for agent discovery and cross-service coordination."))

    return results


# ── Level calculation ─────────────────────────────────────────────────────────

LEVEL_CHECKS = {0: 2, 1: 6, 2: 4, 3: 3, 4: 3, 5: 3}


def compute_level(results: list[dict]) -> int:
    """
    Compute final L0-L5 based on checks passed.
    A level is 'reached' when ≥ 60% of that level's checks pass
    AND all previous levels were reached.
    """
    by_level: dict[int, list[dict]] = {}
    for c in results:
        by_level.setdefault(c["level"], []).append(c)

    for lvl in range(6):
        checks = by_level.get(lvl, [])
        if not checks:
            return lvl - 1 if lvl > 0 else 0
        passed = sum(1 for c in checks if c["passed"])
        ratio = passed / len(checks)
        if ratio < 0.6:
            return lvl
    return 5


# ── Main streaming generator ──────────────────────────────────────────────────

async def audit_url(url: str) -> AsyncGenerator[dict, None]:
    base = _base(url)

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=TIMEOUT,
        verify=False,
    ) as client:

        # L0
        yield await check_reachable(client, url)
        await asyncio.sleep(0.15)
        yield await check_not_blocked(client, url)
        await asyncio.sleep(0.15)

        # Fetch HTML for L1
        try:
            r = await client.get(url, headers=HEADERS, timeout=TIMEOUT)
            html = r.text
        except Exception:
            html = ""

        # L1
        for check in _l1_checks(html, r if html else None):
            yield check
            await asyncio.sleep(0.15)

        # L2
        for check in await _l2_checks(client, base):
            yield check
            await asyncio.sleep(0.15)

        # L3
        for check in await _l3_checks(client, base):
            yield check
            await asyncio.sleep(0.15)

        # L4
        for check in await _l4_checks(client, base):
            yield check
            await asyncio.sleep(0.1)

        # L5
        for check in await _l5_checks(client, base):
            yield check
            await asyncio.sleep(0.1)
