"""Audit routes with SSE streaming."""

import asyncio
import json
from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db, Audit, User, X402Payment
from ..auth import get_current_user, get_optional_user
from ..schemas import AuditRequest, AuditOut
from ..auditor.checker import audit_url, compute_level

FREE_DAILY_LIMIT = 5

router = APIRouter(prefix="/audit", tags=["audit"])


@router.post("/run")
async def run_audit(
    request: Request,
    body: AuditRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """
    Stream audit results as Server-Sent Events.
    Each event is a JSON check result.
    Final event has type='complete'.
    """
    url = body.url

    # x402 paid requests bypass auth requirement
    x402_paid = getattr(request.state, "x402_paid", False)
    if not current_user and not x402_paid:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Daily limit for free (authenticated) users
    if current_user and not current_user.is_pro:
        today = date.today()
        daily_count = (
            db.query(Audit)
            .filter(
                Audit.user_id == current_user.id,
                Audit.created_at >= today.isoformat(),
            )
            .count()
        )
        if daily_count >= FREE_DAILY_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"Free plan limit: {FREE_DAILY_LIMIT} audits per day. Upgrade to Pro for unlimited audits.",
            )

    async def event_stream():
        results = []
        try:
            async for check in audit_url(url):
                results.append(check)
                payload = json.dumps({"type": "check", **check})
                yield f"data: {payload}\n\n"

            level = compute_level(results)
            passed = sum(1 for c in results if c["passed"])
            total  = len(results)

            # Save to DB
            src = request.headers.get("X-Source", "web" if current_user else "x402")
            audit = Audit(
                user_id=current_user.id if current_user else None,
                url=url,
                level=level,
                score=passed,
                max_score=total,
                results=results,
                source=src,
            )
            db.add(audit)
            db.commit()
            db.refresh(audit)

            if getattr(request.state, "x402_paid", False):
                payment = X402Payment(
                    from_address=getattr(request.state, "x402_from", ""),
                    nonce=getattr(request.state, "x402_nonce", ""),
                    amount_usdc=getattr(request.state, "x402_amount", 100000),
                    path=request.url.path,
                    audit_id=audit.id,
                )
                db.add(payment)
                db.commit()

            summary = json.dumps({
                "type": "complete",
                "audit_id": audit.id,
                "level": level,
                "score": passed,
                "max_score": total,
            })
            yield f"data: {summary}\n\n"

        except Exception as e:
            error = json.dumps({"type": "error", "message": str(e)})
            yield f"data: {error}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history", response_model=List[AuditOut])
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audits = (
        db.query(Audit)
        .filter(Audit.user_id == current_user.id)
        .order_by(Audit.created_at.desc())
        .limit(50)
        .all()
    )
    return audits


class CompareRequest(BaseModel):
    urls: List[str]  # 2–4 URLs


async def _audit_one(url: str) -> dict:
    results = []
    async for check in audit_url(url):
        results.append(check)
    level = compute_level(results)
    passed = sum(1 for c in results if c["passed"])
    total = len(results)
    return {
        "url": url,
        "level": level,
        "score": passed,
        "max_score": total,
        "score_pct": round(passed / total * 100) if total else 0,
        "results": results,
    }


@router.post("/compare")
async def compare_audits(
    body: CompareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    max_urls = 8 if current_user.is_pro else 2
    if len(body.urls) > max_urls:
        raise HTTPException(
            status_code=402,
            detail=f"{'Pro' if not current_user.is_pro else 'Your'} plan allows comparing up to {max_urls} sites. {'Upgrade to Pro for up to 8.' if not current_user.is_pro else ''}",
        )
    urls = body.urls[:max_urls]
    tasks = [_audit_one(u) for u in urls]
    gathered = await asyncio.gather(*tasks, return_exceptions=True)
    output = []
    for url, r in zip(urls, gathered):
        if isinstance(r, Exception):
            output.append({"url": url, "error": str(r)})
        else:
            audit = Audit(
                user_id=current_user.id,
                url=r["url"],
                level=r["level"],
                score=r["score"],
                max_score=r["max_score"],
                results=r["results"],
                source="compare",
            )
            db.add(audit)
            db.commit()
            db.refresh(audit)
            output.append({**r, "audit_id": audit.id})
    return output


@router.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db)):
    """Top 50 highest-scored domains across all users (public). One entry per domain."""
    from sqlalchemy import desc

    def _domain(url: str) -> str:
        return url.replace("https://", "").replace("http://", "").split("/")[0].lstrip("www.")

    # Fetch latest audit per unique URL, then deduplicate by domain in Python
    all_audits = (
        db.query(Audit)
        .filter(Audit.max_score > 0)
        .order_by(desc(Audit.id))
        .limit(500)
        .all()
    )

    seen: dict[str, Audit] = {}
    for a in all_audits:
        d = _domain(a.url)
        if d not in seen:
            seen[d] = a

    ranked = sorted(
        seen.values(),
        key=lambda a: (-(a.score * 100 // a.max_score), -a.level),
    )[:50]

    return [
        {
            "url": a.url,
            "domain": _domain(a.url),
            "level": a.level,
            "score_pct": round(a.score / a.max_score * 100) if a.max_score else 0,
            "score": a.score,
            "max_score": a.max_score,
            "audited_at": a.created_at.isoformat(),
        }
        for a in ranked
    ]


@router.get("/domain-history")
def get_domain_history(
    domain: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return audit score/level history for a given domain (oldest first)."""
    audits = (
        db.query(Audit)
        .filter(Audit.user_id == current_user.id, Audit.url.contains(domain))
        .order_by(Audit.created_at.asc())
        .limit(30)
        .all()
    )
    return [
        {
            "id": a.id,
            "created_at": a.created_at.isoformat(),
            "score_pct": round(a.score / a.max_score * 100) if a.max_score else 0,
            "level": a.level,
        }
        for a in audits
    ]


class BulkRequest(BaseModel):
    urls: List[str]  # up to 50


@router.post("/bulk")
async def bulk_audit(
    body: BulkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Audit up to 50 URLs with concurrency limit of 5. Requires Pro."""
    if not current_user.is_pro:
        raise HTTPException(status_code=402, detail="Bulk audit requires a Pro subscription.")
    urls = [u.strip() for u in body.urls[:50] if u.strip()]
    # Normalize
    urls = [u if u.startswith("http") else f"https://{u}" for u in urls]

    sem = asyncio.Semaphore(5)

    async def _limited(url: str):
        async with sem:
            try:
                return await _audit_one(url)
            except Exception as e:
                return {"url": url, "error": str(e)}

    gathered = await asyncio.gather(*[_limited(u) for u in urls])

    output = []
    for r in gathered:
        if "error" in r:
            output.append({"url": r["url"], "error": r["error"]})
        else:
            audit = Audit(
                user_id=current_user.id,
                url=r["url"],
                level=r["level"],
                score=r["score"],
                max_score=r["max_score"],
                results=r["results"],
                source="bulk",
            )
            db.add(audit)
            db.commit()
            db.refresh(audit)
            output.append({
                "url": r["url"],
                "audit_id": audit.id,
                "level": r["level"],
                "score_pct": r["score_pct"],
                "score": r["score"],
                "max_score": r["max_score"],
            })
    return output


@router.get("/{audit_id}", response_model=AuditOut)
def get_audit(
    audit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit = db.query(Audit).filter(
        Audit.id == audit_id,
        Audit.user_id == current_user.id,
    ).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")
    return audit


@router.get("/{audit_id}/pdf")
def download_audit_pdf(
    audit_id: int,
    request: Request,
    db: Session = Depends(get_db),
    token: str | None = None,
):
    """Generate and return a PDF report for an audit (Pro users only)."""
    from ..auth import decode_token
    auth_header = request.headers.get("authorization", "")
    raw = token or (auth_header.split(" ", 1)[1] if " " in auth_header else None)
    if not raw:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = decode_token(raw)
    current_user = db.query(User).filter(User.id == user_id, User.is_active == True, User.deleted_at == None).first()
    if not current_user or not current_user.is_pro:
        raise HTTPException(status_code=402, detail="PDF reports require a Pro subscription")

    audit = db.query(Audit).filter(
        Audit.id == audit_id,
        Audit.user_id == current_user.id,
    ).first()
    if not audit:
        raise HTTPException(status_code=404, detail="Audit not found")

    from fpdf import FPDF
    from fastapi.responses import Response
    import textwrap

    LEVEL_NAMES = {0: "Hostile", 1: "Readable", 2: "Discoverable",
                   3: "Interactive", 4: "Integrated", 5: "Autonomous"}

    def _ascii(s: str) -> str:
        return s.replace("\u2014", "-").replace("\u2013", "-").replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"').encode("latin-1", errors="replace").decode("latin-1")

    checks = audit.results or []
    passed = [c for c in checks if c.get("passed")]
    failed = [c for c in checks if not c.get("passed")]
    score_pct = round(audit.score / audit.max_score * 100) if audit.max_score else 0
    level_name = LEVEL_NAMES.get(audit.level, "Unknown")
    audited_at = audit.created_at.strftime("%Y-%m-%d %H:%M UTC") if audit.created_at else ""

    pdf = FPDF()
    pdf.add_page()
    pdf.set_margins(20, 20, 20)

    # Header
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 10, "Agentable? - Agent Readiness Report", ln=True)

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, f"seo4agent.com  |  Generated {audited_at}", ln=True)
    pdf.ln(4)

    # URL + score box
    pdf.set_fill_color(245, 245, 245)
    pdf.rect(20, pdf.get_y(), 170, 22, "F")
    pdf.set_xy(25, pdf.get_y() + 4)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 6, audit.url, ln=True)
    pdf.set_x(25)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 6, f"Level {audit.level} - {level_name}  |  Score: {score_pct}%  ({audit.score}/{audit.max_score} checks passed)", ln=True)
    pdf.ln(8)

    # Failed checks
    if failed:
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(180, 40, 40)
        pdf.cell(0, 8, f"Failed Checks ({len(failed)})", ln=True)
        pdf.set_draw_color(220, 80, 80)
        pdf.line(20, pdf.get_y(), 190, pdf.get_y())
        pdf.ln(3)
        for c in failed:
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(30, 30, 30)
            label = _ascii(f"[L{c.get('level','')}] {c.get('name','')}")
            pdf.cell(0, 6, label, ln=True)
            msg = _ascii(c.get("message", ""))
            if msg:
                pdf.set_font("Helvetica", "", 9)
                pdf.set_text_color(80, 80, 80)
                for line in textwrap.wrap(msg, 90):
                    pdf.set_x(25)
                    pdf.cell(0, 5, line, ln=True)
            rec = _ascii(c.get("recommendation", ""))
            if rec:
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(60, 100, 160)
                for line in textwrap.wrap(f"Fix: {rec}", 88):
                    pdf.set_x(25)
                    pdf.cell(0, 5, line, ln=True)
            pdf.ln(2)

    # Passed checks
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(30, 120, 60)
    pdf.cell(0, 8, f"Passed Checks ({len(passed)})", ln=True)
    pdf.set_draw_color(60, 180, 100)
    pdf.line(20, pdf.get_y(), 190, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(60, 60, 60)
    for c in passed:
        label = _ascii(f"  [OK] [L{c.get('level','')}] {c.get('name','')} - {c.get('message','')}")
        for line in textwrap.wrap(label, 95):
            pdf.cell(0, 5, line, ln=True)

    # Footer
    pdf.set_y(-20)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 5, "Agentable? | seo4agent.com | AI Agent Readiness Auditing", align="C")

    pdf_bytes = pdf.output()
    domain = audit.url.replace("https://", "").replace("http://", "").split("/")[0]
    filename = f"agentable-report-{domain}-L{audit.level}.pdf"
    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
