"""Public badge endpoint — no auth required."""

from fastapi import APIRouter, Response
from sqlalchemy.orm import Session
from fastapi import Depends

from ..db import get_db, Audit

router = APIRouter(tags=["badge"])

LEVEL_COLORS = {
    0: "#ef4444",  # red
    1: "#f97316",  # orange
    2: "#eab308",  # yellow
    3: "#22c55e",  # green
    4: "#3b82f6",  # blue
    5: "#a855f7",  # purple
}

def _score_color(pct: float) -> str:
    if pct >= 80: return "#22c55e"
    if pct >= 60: return "#eab308"
    if pct >= 40: return "#f97316"
    return "#ef4444"

def _make_svg(domain: str, level: int, score_pct: int) -> str:
    level_color = LEVEL_COLORS.get(level, "#6b7280")
    score_color = _score_color(score_pct)
    label = "agent-ready"
    value = f"L{level} · {score_pct}%"
    label_w = 90
    value_w = 80
    total_w = label_w + value_w
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total_w}" height="20">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="{total_w}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="{label_w}" height="20" fill="#555"/>
    <rect x="{label_w}" width="{value_w}" height="20" fill="{level_color}"/>
    <rect width="{total_w}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="{label_w // 2}" y="15" fill="#010101" fill-opacity=".3">{label}</text>
    <text x="{label_w // 2}" y="14">{label}</text>
    <text x="{label_w + value_w // 2}" y="15" fill="#010101" fill-opacity=".3">{value}</text>
    <text x="{label_w + value_w // 2}" y="14">{value}</text>
  </g>
</svg>"""

@router.get("/badge/{domain}")
def get_badge(domain: str, db: Session = Depends(get_db)):
    """Return an SVG badge for the most recent audit of a domain."""
    # Normalize domain
    domain = domain.lower().strip().rstrip("/")
    if not domain.startswith("http"):
        search = domain
    else:
        search = domain

    # Find most recent audit matching domain
    audit = (
        db.query(Audit)
        .filter(Audit.url.contains(search))
        .order_by(Audit.created_at.desc())
        .first()
    )

    if not audit:
        svg = _make_svg(domain, 0, 0)
        return Response(content=svg, media_type="image/svg+xml",
                        headers={"Cache-Control": "no-cache, max-age=0"})

    score_pct = round((audit.score / audit.max_score) * 100) if audit.max_score else 0
    svg = _make_svg(domain, audit.level or 0, score_pct)
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )
