"""Monitoring — watchlist CRUD + manual re-audit trigger."""

import os
from datetime import datetime, timezone
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db, WatchedDomain, Audit, User
from ..auth import get_current_user
from ..auditor.checker import audit_url, compute_level

CLIENT_BOT_TOKEN = os.getenv("AGENTABLE_BOT_TOKEN", "")


async def _notify_user(chat_id: str, url: str, level: int, score_pct: int, prev_level):
    if not CLIENT_BOT_TOKEN or not chat_id:
        return
    if prev_level is not None and level < prev_level:
        icon = "🔴"
        change = f"Level dropped L{prev_level} → L{level}"
    elif prev_level is not None and level > prev_level:
        icon = "🟢"
        change = f"Level improved L{prev_level} → L{level}"
    else:
        icon = "✅"
        change = f"L{level} — stable"
    text = f"{icon} <b>Re-audit complete</b>\n{url}\n{change} ({score_pct}%)"
    async with httpx.AsyncClient() as c:
        await c.post(f"https://api.telegram.org/bot{CLIENT_BOT_TOKEN}/sendMessage", json={
            "chat_id": chat_id, "text": text, "parse_mode": "HTML",
        }, timeout=8)

router = APIRouter(prefix="/monitor", tags=["monitor"])


class WatchRequest(BaseModel):
    url: str


class WatchOut(BaseModel):
    id: int
    url: str
    last_level: int | None
    last_score: int | None
    last_max: int | None
    last_audit_at: str | None
    created_at: str

    class Config:
        from_attributes = True


@router.get("/watchlist", response_model=List[WatchOut])
def get_watchlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = (
        db.query(WatchedDomain)
        .filter(WatchedDomain.user_id == current_user.id)
        .order_by(WatchedDomain.created_at.desc())
        .all()
    )
    return [_to_out(w) for w in items]


@router.post("/watchlist")
def add_to_watchlist(
    body: WatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    url = body.url.strip().rstrip("/")
    if not url.startswith("http"):
        url = "https://" + url

    existing = db.query(WatchedDomain).filter(
        WatchedDomain.user_id == current_user.id,
        WatchedDomain.url == url,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already watching this URL")

    # Seed last_level/score from most recent audit if available
    last = (
        db.query(Audit)
        .filter(Audit.user_id == current_user.id, Audit.url.contains(
            url.replace("https://", "").replace("http://", "").split("/")[0]
        ))
        .order_by(Audit.created_at.desc())
        .first()
    )

    w = WatchedDomain(
        user_id=current_user.id,
        url=url,
        last_level=last.level if last else None,
        last_score=last.score if last else None,
        last_max=last.max_score if last else None,
        last_audit_at=last.created_at if last else None,
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return _to_out(w)


@router.delete("/watchlist/{watch_id}")
def remove_from_watchlist(
    watch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    w = db.query(WatchedDomain).filter(
        WatchedDomain.id == watch_id,
        WatchedDomain.user_id == current_user.id,
    ).first()
    if not w:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(w)
    db.commit()
    return {"ok": True}


@router.post("/watchlist/{watch_id}/audit")
async def audit_watched(
    watch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger re-audit of a watched domain."""
    w = db.query(WatchedDomain).filter(
        WatchedDomain.id == watch_id,
        WatchedDomain.user_id == current_user.id,
    ).first()
    if not w:
        raise HTTPException(status_code=404, detail="Not found")

    results = []
    async for check in audit_url(w.url):
        results.append(check)

    level = compute_level(results)
    passed = sum(1 for c in results if c["passed"])
    total = len(results)

    prev_level = w.last_level

    audit = Audit(
        user_id=current_user.id,
        url=w.url,
        level=level,
        score=passed,
        max_score=total,
        results=results,
        source="monitor",
    )
    db.add(audit)

    w.last_level = level
    w.last_score = passed
    w.last_max = total
    w.last_audit_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(audit)

    score_pct = round(passed / total * 100) if total else 0

    # Send TG notification if user has connected Telegram
    if current_user.telegram_chat_id:
        await _notify_user(current_user.telegram_chat_id, w.url, level, score_pct, prev_level)

    return {
        "audit_id": audit.id,
        "level": level,
        "score": passed,
        "max_score": total,
        "score_pct": score_pct,
        "level_changed": prev_level is not None and level != prev_level,
        "level_delta": (level - prev_level) if prev_level is not None else None,
    }


@router.get("/notifications")
def get_notifications(
    since: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return monitor-sourced audits newer than `since` (ISO timestamp)."""
    q = (
        db.query(Audit)
        .filter(Audit.user_id == current_user.id, Audit.source == "monitor")
    )
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            q = q.filter(Audit.created_at > since_dt)
        except ValueError:
            pass
    q = q.order_by(Audit.created_at.desc()).limit(50)
    audits = q.all()
    return [
        {
            "id": a.id,
            "url": a.url,
            "level": a.level,
            "score": a.score,
            "max_score": a.max_score,
            "created_at": a.created_at.isoformat(),
        }
        for a in audits
    ]


def _to_out(w: WatchedDomain) -> dict:
    return {
        "id": w.id,
        "url": w.url,
        "last_level": w.last_level,
        "last_score": w.last_score,
        "last_max": w.last_max,
        "last_audit_at": w.last_audit_at.isoformat() if w.last_audit_at else None,
        "created_at": w.created_at.isoformat(),
    }
