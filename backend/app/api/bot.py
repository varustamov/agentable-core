"""Telegram bot webhook for @Agentable_Bot — user account linking."""

import os
import secrets
import httpx

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..db import get_db, User
from ..auth import get_current_user

router = APIRouter(prefix="/bot", tags=["bot"])

BOT_TOKEN = os.getenv("AGENTABLE_BOT_TOKEN", "")
BOT_USERNAME = "Agentable_Bot"
TG_API = f"https://api.telegram.org/bot{BOT_TOKEN}"


async def _tg_send(chat_id: str | int, text: str):
    if not BOT_TOKEN:
        return
    async with httpx.AsyncClient() as c:
        await c.post(f"{TG_API}/sendMessage", json={
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
        }, timeout=8)


# ── Generate link token (called from frontend) ────────────────────────────────

@router.post("/link-token")
def get_link_token(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    token = secrets.token_urlsafe(24)
    user.telegram_link_token = token
    db.commit()
    return {
        "token": token,
        "url": f"https://t.me/{BOT_USERNAME}?start={token}",
        "connected": bool(user.telegram_chat_id),
        "telegram_chat_id": user.telegram_chat_id,
    }


@router.delete("/unlink")
def unlink_telegram(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user.telegram_chat_id = None
    user.telegram_link_token = None
    db.commit()
    return {"ok": True}


# ── Webhook from Telegram ─────────────────────────────────────────────────────

@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    message = data.get("message") or data.get("edited_message")
    if not message:
        return {"ok": True}

    chat_id = str(message["chat"]["id"])
    text = (message.get("text") or "").strip()

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        token = parts[1].strip() if len(parts) > 1 else ""

        if not token:
            await _tg_send(chat_id, "👋 Hi! To connect this bot to your Agentable account, go to <b>Settings → Connect Telegram</b> on seo4agent.com and click the link.")
            return {"ok": True}

        user = db.query(User).filter(User.telegram_link_token == token).first()
        if not user:
            await _tg_send(chat_id, "❌ Link expired or already used. Please generate a new one in your Agentable settings.")
            return {"ok": True}

        user.telegram_chat_id = chat_id
        user.telegram_link_token = None
        db.commit()

        name = user.name or user.email.split("@")[0]
        await _tg_send(chat_id, f"✅ Connected! Hi <b>{name}</b> — you'll now receive Agentable monitoring alerts here.")
        return {"ok": True}

    await _tg_send(chat_id, "ℹ️ I send monitoring alerts from <a href=\"https://seo4agent.com\">seo4agent.com</a>. Connect your account in Settings.")
    return {"ok": True}
