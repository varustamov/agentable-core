"""
Agentable? — Backend entry point.

Dev:   uvicorn main:app --reload --port 8002
Prod:  uvicorn main:app --host 0.0.0.0 --port 8002 --workers 2
"""

import logging
import os

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.db import init_db
from app.api.auth import router as auth_router
from app.api.audit import router as audit_router
from app.api.admin import router as admin_router
from app.api.badge import router as badge_router
from app.api.generate import router as generate_router
from app.api.monitor import router as monitor_router
from app.api.bot import router as bot_router
from app.api.payment import router as payment_router
from app.api.x402 import X402Middleware, router as x402_router  # noqa: must import after FastAPI setup

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("aiseo")

app = FastAPI(
    title="Agentable? API",
    description="Agent-readiness auditing for websites",
    version="1.0.0",
    docs_url="/docs",
)

class RateLimitHeadersMiddleware(BaseHTTPMiddleware):
    """Inject X-RateLimit-* headers so agents can self-throttle."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = "60"
        response.headers["X-RateLimit-Remaining"] = "59"
        response.headers["X-RateLimit-Reset"] = "60"
        response.headers["Retry-After"] = "60"
        return response


app.add_middleware(X402Middleware)
app.add_middleware(RateLimitHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(audit_router)
app.include_router(admin_router)
app.include_router(badge_router)
app.include_router(generate_router)
app.include_router(monitor_router)
app.include_router(bot_router)
app.include_router(payment_router)
app.include_router(x402_router)


@app.on_event("startup")
def startup():
    init_db()
    log.info("Agentable? backend started")


@app.get("/health")
def health():
    return {"status": "ok", "service": "aiseo"}


@app.get("/api")
def api_info():
    """API entry point — returns auth info for agent discovery."""
    from fastapi.responses import JSONResponse
    return JSONResponse(
        content={
            "name": "Agentable API",
            "version": "1.0.0",
            "auth": {
                "type": "bearer",
                "description": "Use JWT bearer token from seo4agent.com login. Pass as Authorization: Bearer <token>.",
                "token_url": "/auth/login",
                "register_url": "/auth/register",
            },
            "docs": "/docs",
            "openapi": "/openapi.json",
        },
        headers={"WWW-Authenticate": "Bearer realm=\"Agentable API\", charset=\"UTF-8\""},
    )
