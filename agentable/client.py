"""Agentable REST API client."""

from __future__ import annotations

import os
from typing import Any

import httpx

BASE_URL = os.getenv("AGENTABLE_BASE_URL", "https://seo4agent.com")


class AgentableClient:
    """Thin async client for the Agentable API.

    Usage::

        client = AgentableClient(token="your_jwt_token")
        result = await client.audit("https://example.com")
        print(result["level"], result["score_pct"])
    """

    def __init__(self, token: str | None = None, base_url: str = BASE_URL):
        self.base_url = base_url.rstrip("/")
        self._token = token or os.getenv("AGENTABLE_TOKEN", "")
        self._headers = {"Authorization": f"Bearer {self._token}"} if self._token else {}

    async def audit(self, url: str) -> dict[str, Any]:
        """Run a full audit and return summary + checks."""
        checks: list[dict] = []
        summary: dict = {}
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/audit/run",
                json={"url": url},
                headers={**self._headers, "Content-Type": "application/json"},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    import json
                    evt = json.loads(line[6:])
                    if evt.get("type") == "check":
                        checks.append(evt)
                    elif evt.get("type") == "complete":
                        summary = evt
        return {
            "url": url,
            "audit_id": summary.get("audit_id"),
            "level": summary.get("level"),
            "score": summary.get("score"),
            "max_score": summary.get("max_score"),
            "score_pct": round(summary["score"] / summary["max_score"] * 100)
            if summary.get("max_score")
            else 0,
            "checks": checks,
        }

    async def bulk_audit(self, urls: list[str]) -> list[dict[str, Any]]:
        """Audit up to 50 URLs in parallel."""
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{self.base_url}/audit/bulk",
                json={"urls": urls},
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def compare(self, urls: list[str]) -> list[dict[str, Any]]:
        """Compare 2–4 URLs side by side."""
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{self.base_url}/audit/compare",
                json={"urls": urls},
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def history(self) -> list[dict[str, Any]]:
        """Return recent audit history for the authenticated user."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/audit/history",
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def leaderboard(self) -> list[dict[str, Any]]:
        """Return public leaderboard (no auth required)."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{self.base_url}/audit/leaderboard")
            resp.raise_for_status()
            return resp.json()
