"""
Lava.top payment integration for Agentable Pro subscriptions.

Env vars:
  LAVA_API_KEY             — lava.top API key
  LAVA_WEBHOOK_LOGIN       — Basic Auth login configured in lava.top dashboard
  LAVA_WEBHOOK_PASSWORD    — Basic Auth password
  LAVA_PRO_OFFER_ID        — offer UUID for Pro $9/mo plan
  AGENTABLE_BASE_URL       — https://seo4agent.com
"""

import base64
import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db, User, PromoCode
from ..auth import get_current_user
from datetime import datetime, timezone

log = logging.getLogger("agentable.payment")

router = APIRouter(tags=["payment"])

LAVA_API_KEY          = os.getenv("LAVA_API_KEY", "")
LAVA_WEBHOOK_LOGIN    = os.getenv("LAVA_WEBHOOK_LOGIN", "agentable")
LAVA_WEBHOOK_PASSWORD = os.getenv("LAVA_WEBHOOK_PASSWORD", "")
LAVA_PRO_OFFER_ID     = os.getenv("LAVA_PRO_OFFER_ID", "")
LAVA_PRO_PRODUCT_ID   = os.getenv("LAVA_PRO_PRODUCT_ID", "")
BASE_URL              = os.getenv("AGENTABLE_BASE_URL", "https://seo4agent.com")

PRO_PRICE_USD = 9.0


def _verify_basic_auth(request: Request) -> bool:
    if not LAVA_WEBHOOK_PASSWORD:
        log.warning("[lava] LAVA_WEBHOOK_PASSWORD not set — skipping auth check")
        return True
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Basic "):
        return False
    try:
        decoded = base64.b64decode(auth[6:]).decode()
        login, password = decoded.split(":", 1)
        return login == LAVA_WEBHOOK_LOGIN and password == LAVA_WEBHOOK_PASSWORD
    except Exception:
        return False


def _find_user(db: Session, email: str) -> User | None:
    return db.query(User).filter(
        User.email == email.lower().strip(),
        User.is_active == True,
        User.deleted_at == None,
    ).first()


async def _create_invoice(offer_id: str, email: str) -> dict | None:
    if not LAVA_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://gate.lava.top/api/v1/invoice",
                headers={"X-Api-Key": LAVA_API_KEY, "Content-Type": "application/json"},
                json={"email": email, "offerId": offer_id, "currency": "USD"},
            )
            log.info(f"[lava] create invoice: {resp.status_code} {resp.text[:300]}")
            if resp.status_code == 201:
                return resp.json()
    except Exception as e:
        log.warning(f"[lava] create invoice error: {e}")
    return None


async def _get_invoice(invoice_id: str) -> dict | None:
    if not LAVA_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://gate.lava.top/api/v1/invoices/{invoice_id}",
                headers={"X-Api-Key": LAVA_API_KEY},
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        log.warning(f"[lava] get invoice error: {e}")
    return None


# ── Webhook ───────────────────────────────────────────────────────────────────

@router.post("/webhooks/lava", status_code=200)
async def lava_webhook(request: Request, db: Session = Depends(get_db)):
    if not _verify_basic_auth(request):
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    log.info(f"[lava] webhook: {payload}")

    event = (
        payload.get("eventType")
        or payload.get("event")
        or payload.get("type")
        or payload.get("status")
    )
    email = (
        (payload.get("buyer") or {}).get("email")
        or payload.get("buyerEmail")
        or payload.get("email")
    )

    SUCCESS_EVENTS = {"payment.success", "subscription.recurring.payment.success", "success", "SUCCESS"}
    FAILED_EVENTS  = {"payment.failed", "subscription.recurring.payment.failed"}
    CANCEL_EVENTS  = {"subscription.cancelled", "subscription.canceled"}

    if event in SUCCESS_EVENTS:
        if not email:
            return {"ok": True, "action": "ignored", "reason": "no_email"}
        user = _find_user(db, email)
        if not user:
            log.warning(f"[lava] user not found: {email}")
            return {"ok": True, "action": "ignored", "reason": "user_not_found"}
        user.is_pro = True
        db.commit()
        log.info(f"[lava] Pro activated for {email} (user {user.id})")
        return {"ok": True, "action": "pro_activated"}

    elif event in FAILED_EVENTS:
        if email:
            user = _find_user(db, email)
            if user:
                user.is_pro = False
                db.commit()
                log.info(f"[lava] Pro revoked (payment failed) for {email}")
        return {"ok": True, "action": "pro_revoked"}

    elif event in CANCEL_EVENTS:
        # Keep Pro until next billing cycle — lava.top stops charging automatically
        log.info(f"[lava] subscription cancelled for {email}, keeping Pro until expiry")
        return {"ok": True, "action": "cancel_noted"}

    log.info(f"[lava] unhandled event: {event}")
    return {"ok": True, "action": "ignored", "event": event}


# ── Checkout ──────────────────────────────────────────────────────────────────

class CheckoutOut(BaseModel):
    url: str
    invoice_id: str = ""


@router.post("/payment/checkout", response_model=CheckoutOut)
async def create_checkout(
    current_user: User = Depends(get_current_user),
):
    """Create a lava.top checkout for Agentable Pro $9/mo."""
    if current_user.is_pro:
        raise HTTPException(status_code=400, detail="Already a Pro subscriber")
    if not LAVA_PRO_OFFER_ID:
        raise HTTPException(status_code=503, detail="Payment not configured yet")

    invoice = await _create_invoice(LAVA_PRO_OFFER_ID, current_user.email)
    if invoice and invoice.get("paymentUrl"):
        return {"url": invoice["paymentUrl"], "invoice_id": invoice.get("id", "")}

    # Fallback: direct product link (product_id/offer_id format)
    product_path = f"{LAVA_PRO_PRODUCT_ID}/{LAVA_PRO_OFFER_ID}" if LAVA_PRO_PRODUCT_ID else LAVA_PRO_OFFER_ID
    import urllib.parse
    success_url = urllib.parse.quote(f"{BASE_URL}/settings?upgraded=1", safe="")
    return {
        "url": f"https://app.lava.top/products/{product_path}?email={current_user.email}&currency=USD&successUrl={success_url}",
        "invoice_id": "",
    }


@router.get("/payment/invoice/{invoice_id}")
async def get_invoice_status(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
):
    invoice = await _get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    paid = (invoice.get("status") or "").upper() in ("PAID", "SUCCESS", "COMPLETED")
    if paid:
        # Activate Pro immediately on frontend poll
        db_gen = get_db()
        db = next(db_gen)
        user = _find_user(db, current_user.email)
        if user and not user.is_pro:
            user.is_pro = True
            db.commit()
    return {"invoice_id": invoice_id, "status": (invoice.get("status") or "").upper(), "paid": paid}


@router.post("/payment/cancel")
def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark subscription as cancelling — lava.top stops recurring billing automatically."""
    if not current_user.is_pro:
        raise HTTPException(status_code=400, detail="No active Pro subscription")
    # Attempt to cancel via lava.top API
    if LAVA_API_KEY:
        try:
            import httpx as _httpx
            resp = _httpx.post(
                "https://gate.lava.top/api/v1/subscriptions/unsubscribe",
                headers={"X-Api-Key": LAVA_API_KEY, "Content-Type": "application/json"},
                json={"email": current_user.email},
                timeout=10,
            )
            log.info(f"[lava] cancel API: {resp.status_code} {resp.text[:200]}")
        except Exception as e:
            log.warning(f"[lava] cancel API error: {e}")
    return {"ok": True, "detail": "Subscription cancelled. Pro access continues until end of billing period."}


class PromoRequest(BaseModel):
    code: str


@router.post("/payment/promo")
def activate_promo(
    body: PromoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = body.code.strip().upper()
    promo = db.query(PromoCode).filter(PromoCode.code == code).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Invalid promo code")
    if promo.expires_at and promo.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Promo code has expired")
    if promo.max_uses is not None and promo.use_count >= promo.max_uses:
        raise HTTPException(status_code=410, detail="Promo code usage limit reached")
    if current_user.promo_code_used:
        raise HTTPException(status_code=400, detail="You have already used a promo code")
    if current_user.is_pro:
        raise HTTPException(status_code=400, detail="You already have a Pro subscription")

    if promo.grants_pro:
        current_user.is_pro = True
        current_user.promo_code_used = promo.code
    promo.use_count += 1
    db.commit()
    return {"ok": True, "detail": "Promo code activated! Pro plan is now active."}
