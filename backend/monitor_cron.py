#!/usr/bin/env python3
"""
Weekly monitoring cron — re-audits all watched domains,
sends per-user Telegram alerts + admin summary.

Run: python3 /opt/agentable/backend/monitor_cron.py
"""

import asyncio
import os
import sys
import logging
from collections import defaultdict
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
load_dotenv()

from app.db import SessionLocal, WatchedDomain, Audit, User, init_db
from app.auditor.checker import audit_url, compute_level

init_db()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("monitor_cron")

# Admin notifications (Нео bot → developer personal chat)
ADMIN_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID", "820061932")
ADMIN_THREAD_ID = os.getenv("AGENTABLE_THREAD_ID", "")

# @Agentable_Bot for client notifications
CLIENT_BOT_TOKEN = os.getenv("AGENTABLE_BOT_TOKEN", "")


async def _send(bot_token: str, chat_id: str, text: str, thread_id: str = ""):
    if not bot_token or not chat_id:
        return
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if thread_id:
        payload["message_thread_id"] = thread_id
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json=payload, timeout=10,
        )
        if not r.is_success:
            log.warning(f"TG send failed {r.status_code}: {r.text[:100]}")


async def send_admin(text: str):
    await _send(ADMIN_BOT_TOKEN, ADMIN_CHAT_ID, text, ADMIN_THREAD_ID)


async def send_client(chat_id: str, text: str):
    await _send(CLIENT_BOT_TOKEN, chat_id, text)


async def audit_one(db, w: WatchedDomain) -> dict:
    log.info(f"Auditing {w.url} (user {w.user_id})")
    results = []
    try:
        async for check in audit_url(w.url):
            results.append(check)
    except Exception as e:
        log.error(f"Failed to audit {w.url}: {e}")
        return {"url": w.url, "user_id": w.user_id, "error": str(e)}

    level = compute_level(results)
    passed = sum(1 for c in results if c["passed"])
    total = len(results)
    score_pct = round(passed / total * 100) if total else 0
    prev_level = w.last_level

    audit = Audit(
        user_id=w.user_id, url=w.url, level=level,
        score=passed, max_score=total, results=results, source="monitor",
    )
    db.add(audit)
    w.last_level = level
    w.last_score = passed
    w.last_max = total
    w.last_audit_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "url": w.url,
        "user_id": w.user_id,
        "level": level,
        "score_pct": score_pct,
        "prev_level": prev_level,
        "dropped": prev_level is not None and level < prev_level,
        "improved": prev_level is not None and level > prev_level,
    }


def _build_summary(results: list) -> str:
    dropped = [r for r in results if r.get("dropped")]
    improved = [r for r in results if r.get("improved")]
    stable = [r for r in results if not r.get("dropped") and not r.get("improved") and "error" not in r]
    errors = [r for r in results if "error" in r]

    lines = ["🔍 <b>Agentable Weekly Monitor</b>", ""]
    if dropped:
        lines.append("🔴 <b>Level dropped:</b>")
        for r in dropped:
            lines.append(f"  • {r['url']} — L{r['prev_level']} → L{r['level']} ({r['score_pct']}%)")
        lines.append("")
    if improved:
        lines.append("🟢 <b>Level improved:</b>")
        for r in improved:
            lines.append(f"  • {r['url']} — L{r['prev_level']} → L{r['level']} ({r['score_pct']}%)")
        lines.append("")
    if stable:
        lines.append("✅ <b>Stable:</b>")
        for r in stable:
            lines.append(f"  • {r['url']} — L{r['level']} ({r['score_pct']}%)")
        lines.append("")
    if errors:
        lines.append("⚠️ <b>Errors:</b>")
        for r in errors:
            lines.append(f"  • {r.get('url','?')}: {r['error']}")
    return "\n".join(lines)


def _user_summary(user_results: list, user_name: str) -> str:
    name = user_name or "there"
    lines = [f"👋 Hi <b>{name}</b>! Here's your weekly Agentable report:", ""]
    for r in user_results:
        if "error" in r:
            lines.append(f"⚠️ {r['url']} — check failed")
        elif r.get("dropped"):
            lines.append(f"🔴 <b>{r['url']}</b> — level dropped L{r['prev_level']} → L{r['level']} ({r['score_pct']}%)")
        elif r.get("improved"):
            lines.append(f"🟢 <b>{r['url']}</b> — level improved L{r['prev_level']} → L{r['level']} ({r['score_pct']}%)")
        else:
            lines.append(f"✅ {r['url']} — L{r['level']} ({r['score_pct']}%)")
    lines.append("")
    lines.append("📊 View full reports at <a href=\"https://seo4agent.com\">seo4agent.com</a>")
    return "\n".join(lines)


async def main():
    db = SessionLocal()
    try:
        watched = db.query(WatchedDomain).all()
        log.info(f"Found {len(watched)} watched domains")
        if not watched:
            return

        all_results = []
        for w in watched:
            r = await audit_one(db, w)
            all_results.append(r)
            await asyncio.sleep(2)

        # Group by user_id
        by_user: dict[int, list] = defaultdict(list)
        for r in all_results:
            by_user[r["user_id"]].append(r)

        # Send per-user notifications via @Agentable_Bot
        if CLIENT_BOT_TOKEN:
            users = {u.id: u for u in db.query(User).filter(User.id.in_(by_user.keys())).all()}
            for user_id, results in by_user.items():
                user = users.get(user_id)
                if user and user.telegram_chat_id:
                    text = _user_summary(results, user.name or user.email.split("@")[0])
                    await send_client(user.telegram_chat_id, text)
                    log.info(f"Sent client alert to user {user_id}")

        # Send admin summary
        await send_admin(_build_summary(all_results))
        log.info("Done.")

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
