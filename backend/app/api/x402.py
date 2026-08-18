"""
x402 Payment Protocol middleware for Agentable API.
Uses local EIP-712 signature verification (no external facilitator needed).
Authenticated (Bearer) requests bypass x402.
SIWX (Sign-In-With-X) allows returning wallets to skip payment.
"""
import logging
import os
import base64
import json
import time
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from x402.http.utils import decode_payment_signature_header
from x402.mechanisms.evm.exact.eip3009_utils import build_typed_data_for_signing
from eth_account import Account
from eth_account.messages import encode_defunct, encode_typed_data

log = logging.getLogger("agentable.x402")

router = APIRouter(prefix="/x402", tags=["x402"])

# In-memory nonce store: nonce -> (wallet_hint, expires_at)
# Fine for single-process; replace with Redis for multi-worker
_nonces: dict[str, tuple[str, datetime]] = {}

PAY_TO  = os.getenv("X402_PAY_TO",  "0x2427CE4588EB9bBdd92f4c065899657060607fCB")
NETWORK = os.getenv("X402_NETWORK", "eip155:8453")
USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
CHAIN_ID = 8453

X402_PATHS = {"/audit/run"}


def _verify_eip3009_local(payment_header: str) -> tuple[bool, str]:
    """Verify EIP-3009 transferWithAuthorization signature locally."""
    try:
        payload = decode_payment_signature_header(payment_header)
        p = payload.payload  # dict with signature + authorization
        auth = p.get("authorization", {})

        now = int(time.time())
        valid_before = int(auth.get("validBefore", 0))
        valid_after = int(auth.get("validAfter", 0))

        if now > valid_before:
            return False, "Payment expired"
        if now < valid_after:
            return False, "Payment not yet valid"
        if auth.get("to", "").lower() != PAY_TO.lower():
            return False, "Wrong recipient"
        if str(int(auth.get("value", 0))) != "100000":
            return False, "Wrong amount"

        # Reconstruct EIP-712 message for local verification
        nonce_hex = auth.get("nonce", "0x" + "00" * 32)
        nonce_bytes = bytes.fromhex(nonce_hex.removeprefix("0x"))

        domain_data = {
            "name": "USD Coin",
            "version": "2",
            "chainId": CHAIN_ID,
            "verifyingContract": USDC_ADDRESS,
        }
        message_types = {
            "TransferWithAuthorization": [
                {"name": "from", "type": "address"},
                {"name": "to", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "validAfter", "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce", "type": "bytes32"},
            ]
        }
        message_data = {
            "from": auth.get("from"),
            "to": auth.get("to"),
            "value": int(auth.get("value", 0)),
            "validAfter": valid_after,
            "validBefore": valid_before,
            "nonce": nonce_bytes,
        }

        encoded = encode_typed_data(
            domain_data=domain_data,
            message_types=message_types,
            message_data=message_data,
        )
        signature = p.get("signature", "")
        recovered = Account.recover_message(encoded, signature=signature)

        if recovered.lower() != auth.get("from", "").lower():
            return False, f"Invalid signature: recovered {recovered}, expected {auth.get('from')}"

        log.info(f"[x402] local verify OK: from={auth.get('from')} amount={auth.get('value')}")
        return True, "", auth.get("from", ""), nonce_hex, int(auth.get("value", 0))
    except Exception as e:
        return False, f"Verification error: {e}", "", "", 0

PAYMENT_PAYLOAD = {
    "x402Version": 2,
    "error": "Payment required",
    "resource": {
        "url": "https://seo4agent.com/audit/run",
        "description": "Agentable agent-readiness audit — $0.10 USDC per audit",
        "mimeType": "application/json",
    },
    "accepts": [
        {
            "scheme": "exact",
            "network": NETWORK,
            "amount": "100000",
            "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "payTo": PAY_TO,
            "maxTimeoutSeconds": 300,
            "extra": {"name": "USD Coin", "version": "2"},
        }
    ],
    "extensions": {
        "bazaar": {
            "info": {
                "input": {
                    "type": "http",
                    "method": "POST",
                    "bodyParams": {
                        "url": {
                            "type": "string",
                            "description": "The website URL to audit for AI agent readiness (e.g. https://example.com)",
                            "required": True,
                        }
                    },
                },
                "output": {
                    "type": "json",
                    "example": {
                        "type": "complete",
                        "audit_id": 42,
                        "level": 3,
                        "score": 18,
                        "max_score": 25,
                    },
                    "schema": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string"},
                            "audit_id": {"type": "integer"},
                            "level": {"type": "integer", "minimum": 0, "maximum": 5},
                            "score": {"type": "integer"},
                            "max_score": {"type": "integer"},
                        },
                    },
                },
            },
            "schema": {
                "type": "object",
                "properties": {
                    "type": {"type": "string"},
                    "audit_id": {"type": "integer"},
                    "level": {"type": "integer", "minimum": 0, "maximum": 5},
                    "score": {"type": "integer"},
                    "max_score": {"type": "integer"},
                },
            },
            "name": "Agentable",
            "description": "Agent-readiness auditor — checks if your website is discoverable and usable by AI agents. $0.10 USDC per audit.",
            "url": "https://seo4agent.com",
            "category": "tools",
            "tags": ["ai", "audit", "agent-readiness", "llms.txt", "mcp"],
            "logoUrl": "https://seo4agent.com/favicon.ico",
        }
    },
}

_PAYMENT_REQUIRED_HEADER = base64.b64encode(json.dumps(PAYMENT_PAYLOAD).encode()).decode()



@router.get("/challenge")
async def siwx_challenge(wallet: str = ""):
    """Issue a SIWX challenge nonce for wallet-based auth."""
    nonce = secrets.token_hex(16)
    expires = datetime.now(timezone.utc) + timedelta(minutes=5)
    _nonces[nonce] = (wallet.lower(), expires)
    domain = "seo4agent.com"
    issued_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    message = (
        f"{domain} wants you to sign in with your Ethereum account.\n\n"
        f"Sign in to Agentable as a returning customer.\n\n"
        f"URI: https://seo4agent.com\n"
        f"Version: 1\n"
        f"Chain ID: 8453\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at}"
    )
    return {"nonce": nonce, "message": message, "expiresAt": expires.isoformat()}


def _verify_siwx(message: str, signature: str) -> tuple[bool, str, str]:
    """Verify EIP-191 personal_sign. Returns (ok, reason, wallet_address)."""
    try:
        encoded = encode_defunct(text=message)
        recovered = Account.recover_message(encoded, signature=signature)
        return True, "", recovered.lower()
    except Exception as e:
        return False, str(e), ""


def _siwx_wallet_has_paid(wallet: str) -> bool:
    """Check if wallet has any prior x402 payment in DB."""
    try:
        from ..db import SessionLocal, X402Payment
        with SessionLocal() as db:
            hit = db.query(X402Payment).filter(
                X402Payment.from_address == wallet.lower()
            ).first()
            return hit is not None
    except Exception as e:
        log.warning(f"[siwx] DB check failed: {e}")
        return False


def _has_siwx(request: Request) -> bool:
    return bool(request.headers.get("X-SIWX-Signature") and request.headers.get("X-SIWX-Message"))


def _has_bearer(request: Request) -> bool:
    auth = request.headers.get("Authorization", "")
    token = request.query_params.get("token", "")
    return auth.startswith("Bearer ") or bool(token)


def _has_payment(request: Request) -> bool:
    return bool(request.headers.get("X-Payment") or request.headers.get("X-Payment-Signature"))


def payment_required_response() -> JSONResponse:
    return JSONResponse(
        status_code=402,
        content=PAYMENT_PAYLOAD,
        headers={"PAYMENT-REQUIRED": _PAYMENT_REQUIRED_HEADER},
    )


class X402Middleware(BaseHTTPMiddleware):
    """
    Intercepts unauthenticated requests to x402-protected paths.
    Uses official x402 Python SDK for verify+settle via CDP facilitator.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if path not in X402_PATHS:
            return await call_next(request)

        if _has_bearer(request):
            return await call_next(request)

        if _has_siwx(request):
            msg = request.headers.get("X-SIWX-Message", "")
            sig = request.headers.get("X-SIWX-Signature", "")
            ok, reason, wallet = _verify_siwx(msg, sig)
            if not ok:
                return JSONResponse(status_code=401, content={"error": f"SIWX invalid: {reason}"})
            # Extract nonce from message and validate
            nonce = None
            for line in msg.splitlines():
                if line.startswith("Nonce: "):
                    nonce = line.removeprefix("Nonce: ").strip()
            if nonce and nonce in _nonces:
                _, expires = _nonces[nonce]
                if datetime.now(timezone.utc) <= expires:
                    del _nonces[nonce]
                    if _siwx_wallet_has_paid(wallet):
                        log.info(f"[siwx] returning wallet {wallet} granted access")
                        request.state.siwx_wallet = wallet
                        return await call_next(request)
                    return JSONResponse(status_code=402, content={
                        "x402Version": 2,
                        "error": "No prior payment found for this wallet. Please pay first.",
                        **PAYMENT_PAYLOAD,
                    }, headers={"PAYMENT-REQUIRED": _PAYMENT_REQUIRED_HEADER})
                del _nonces[nonce]
            return JSONResponse(status_code=401, content={"error": "SIWX nonce expired or invalid"})

        if not _has_payment(request):
            log.info(f"[x402] 402 issued for {path}")
            return payment_required_response()

        payment_header = request.headers.get("X-Payment") or request.headers.get("X-Payment-Signature", "")

        try:
            is_valid, reason, from_addr, nonce, amount = _verify_eip3009_local(payment_header)
            if not is_valid:
                log.warning(f"[x402] invalid payment: {reason}")
                return JSONResponse(
                    status_code=402,
                    content={"x402Version": 2, "error": f"Payment verification failed: {reason}"},
                    headers={"PAYMENT-REQUIRED": _PAYMENT_REQUIRED_HEADER},
                )
            log.info(f"[x402] payment verified for {path}")
        except Exception as e:
            log.warning(f"[x402] payment error: {e}")
            return JSONResponse(
                status_code=402,
                content={"x402Version": 2, "error": f"Payment error: {str(e)}"},
                headers={"PAYMENT-REQUIRED": _PAYMENT_REQUIRED_HEADER},
            )

        request.state.x402_paid = True
        request.state.x402_from = from_addr
        request.state.x402_nonce = nonce
        request.state.x402_amount = amount
        return await call_next(request)
