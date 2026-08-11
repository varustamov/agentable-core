"""
Agentable MCP Server

Exposes Agentable auditing tools to any MCP-compatible AI agent.

Run as stdio server:
    agentable-mcp

Or in Claude Desktop config (claude_desktop_config.json):
    {
      "mcpServers": {
        "agentable": {
          "command": "agentable-mcp",
          "env": {
            "AGENTABLE_TOKEN": "your_jwt_token"
          }
        }
      }
    }
"""

import asyncio
import json
import os

import mcp.server.stdio
import mcp.types as types
from mcp.server import Server
from mcp.server.models import InitializationOptions
from mcp.server.lowlevel import NotificationOptions

from .client import AgentableClient

LEVEL_NAMES = {
    0: "Hostile",
    1: "Readable",
    2: "Discoverable",
    3: "Interactive",
    4: "Integrated",
    5: "Autonomous",
}

server = Server("agentable")
_client: AgentableClient | None = None


def _get_client() -> AgentableClient:
    global _client
    if _client is None:
        _client = AgentableClient()
    return _client


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="audit_url",
            description=(
                "Audit a website for AI/agent readiness. Returns a readiness level (0-5), "
                "score percentage, and individual check results. "
                "Level 5 = Autonomous (fully agent-ready), Level 0 = Hostile. "
                "Free plan: 5 audits/day. Pro: unlimited."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The website URL to audit (e.g. https://example.com)",
                    }
                },
                "required": ["url"],
            },
        ),
        types.Tool(
            name="bulk_audit",
            description=(
                "Audit multiple websites at once (up to 50). Returns a summary table "
                "with level and score for each URL. Requires Pro subscription."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "urls": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of URLs to audit (max 50, Pro only)",
                        "maxItems": 50,
                    }
                },
                "required": ["urls"],
            },
        ),
        types.Tool(
            name="compare_urls",
            description=(
                "Compare websites side by side for agent readiness. "
                "Free plan: up to 2 URLs. Pro plan: up to 8 URLs. "
                "Returns scores and check results for each URL."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "urls": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "2–8 URLs to compare (2 for Free, up to 8 for Pro)",
                        "minItems": 2,
                        "maxItems": 8,
                    }
                },
                "required": ["urls"],
            },
        ),
        types.Tool(
            name="get_leaderboard",
            description=(
                "Get the public leaderboard of top agent-ready websites. "
                "No authentication required."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Number of results to return (default 20, max 50)",
                        "default": 20,
                    }
                },
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    client = _get_client()

    if name == "audit_url":
        url = arguments["url"]
        try:
            result = await client.audit(url)
        except Exception as e:
            return [types.TextContent(type="text", text=f"Audit failed: {e}")]

        level = result.get("level")
        level_name = LEVEL_NAMES.get(level, "Unknown") if level is not None else "Unknown"
        checks = result.get("checks", [])
        failed = [c for c in checks if not c.get("passed")]

        lines = [
            f"## Audit: {url}",
            f"",
            f"**Level {level} — {level_name}** | Score: {result.get('score_pct', 0)}% ({result.get('score')}/{result.get('max_score')} checks passed)",
            f"",
        ]
        if failed:
            lines.append(f"### Failed checks ({len(failed)}):")
            for c in failed:
                lines.append(f"- **L{c['level']} {c['name']}**: {c['message']}")
                if c.get("recommendation"):
                    lines.append(f"  → {c['recommendation']}")
        else:
            lines.append("✅ All checks passed!")

        if result.get("audit_id"):
            lines.append(f"\n[Full report](https://seo4agent.com/report/{result['audit_id']})")

        return [types.TextContent(type="text", text="\n".join(lines))]

    elif name == "bulk_audit":
        urls = arguments["urls"]
        try:
            results = await client.bulk_audit(urls)
        except Exception as e:
            return [types.TextContent(type="text", text=f"Bulk audit failed: {e}")]

        lines = [f"## Bulk Audit — {len(results)} URLs\n"]
        for r in results:
            if r.get("error"):
                lines.append(f"- ❌ {r['url']}: {r['error']}")
            else:
                lvl = r.get("level", "?")
                name_lvl = LEVEL_NAMES.get(lvl, "") if isinstance(lvl, int) else ""
                lines.append(f"- **L{lvl} {name_lvl}** {r['url']} — {r.get('score_pct', 0)}%")
        return [types.TextContent(type="text", text="\n".join(lines))]

    elif name == "compare_urls":
        urls = arguments["urls"]
        try:
            results = await client.compare(urls)
        except Exception as e:
            return [types.TextContent(type="text", text=f"Compare failed: {e}")]

        lines = ["## Comparison\n"]
        for r in results:
            if r.get("error"):
                lines.append(f"### ❌ {r['url']}\nError: {r['error']}\n")
            else:
                lvl = r.get("level", "?")
                lines.append(
                    f"### L{lvl} — {LEVEL_NAMES.get(lvl, '')} | {r['url']}\n"
                    f"Score: {r.get('score_pct', 0)}% ({r.get('score')}/{r.get('max_score')})\n"
                )
        return [types.TextContent(type="text", text="\n".join(lines))]

    elif name == "get_leaderboard":
        limit = min(int(arguments.get("limit", 20)), 50)
        try:
            results = await client.leaderboard()
        except Exception as e:
            return [types.TextContent(type="text", text=f"Leaderboard failed: {e}")]

        lines = ["## Agent Readiness Leaderboard\n"]
        for i, r in enumerate(results[:limit], 1):
            medal = ["🥇", "🥈", "🥉"][i - 1] if i <= 3 else f"{i}."
            lines.append(
                f"{medal} **L{r['level']}** {r['domain']} — {r['score_pct']}%"
            )
        return [types.TextContent(type="text", text="\n".join(lines))]

    return [types.TextContent(type="text", text=f"Unknown tool: {name}")]


def main():
    async def _run():
        async with mcp.server.stdio.stdio_server() as (read, write):
            await server.run(
                read,
                write,
                InitializationOptions(
                    server_name="agentable",
                    server_version="0.1.1",
                    capabilities=server.get_capabilities(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                ),
            )

    asyncio.run(_run())


if __name__ == "__main__":
    main()
