"""Admin routes — protected by is_admin flag."""

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel

from ..db import get_db, User, Audit, X402Payment, PromoCode
from ..auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ── Schemas ───────────────────────────────────────────────────────────────────

class AdminUserOut(BaseModel):
    id: int
    email: str
    name: Optional[str]
    job_title: Optional[str]
    company: Optional[str]
    social_url: Optional[str]
    is_active: bool
    is_admin: bool
    is_pro: bool
    created_at: datetime
    audit_count: int
    last_audit_at: Optional[datetime]
    avg_level: Optional[float]

    model_config = {"from_attributes": True}


class DayStats(BaseModel):
    date: str
    audits: int
    new_users: int


class PromoStats(BaseModel):
    code: str
    description: Optional[str]
    use_count: int
    max_uses: Optional[int]


class StatsOut(BaseModel):
    total_users: int
    active_users: int
    total_audits: int
    audits_today: int
    audits_this_week: int
    avg_level: Optional[float]
    level_distribution: dict[str, int]
    daily: List[DayStats]
    pro_users: int
    pro_paid_users: int
    pro_promo_users: int
    mrr_usd: float
    x402_payments: int
    x402_revenue_usd: float
    feature_usage: dict[str, int]
    promo_codes: List[PromoStats]


class AdminAuditOut(BaseModel):
    id: int
    url: str
    level: Optional[int]
    score: Optional[int]
    max_score: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsOut)
def get_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start  = today_start - timedelta(days=7)

    total_users   = db.query(func.count(User.id)).filter(User.deleted_at == None).scalar() or 0
    active_users  = db.query(func.count(User.id)).filter(User.is_active == True, User.deleted_at == None).scalar() or 0
    total_audits  = db.query(func.count(Audit.id)).scalar() or 0
    audits_today  = db.query(func.count(Audit.id)).filter(Audit.created_at >= today_start).scalar() or 0
    audits_week   = db.query(func.count(Audit.id)).filter(Audit.created_at >= week_start).scalar() or 0

    avg_level_row = db.query(func.avg(Audit.level)).filter(Audit.level != None).scalar()
    avg_level     = round(float(avg_level_row), 2) if avg_level_row is not None else None

    # Level distribution
    level_dist: dict[str, int] = {str(i): 0 for i in range(6)}
    rows = db.query(Audit.level, func.count(Audit.id)).filter(Audit.level != None).group_by(Audit.level).all()
    for lvl, cnt in rows:
        level_dist[str(lvl)] = cnt

    # Daily stats — last 30 days
    daily = []
    for i in range(29, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end   = day_start + timedelta(days=1)
        day_audits = db.query(func.count(Audit.id)).filter(
            Audit.created_at >= day_start, Audit.created_at < day_end
        ).scalar() or 0
        day_users = db.query(func.count(User.id)).filter(
            User.created_at >= day_start, User.created_at < day_end
        ).scalar() or 0
        daily.append(DayStats(
            date=day_start.strftime("%Y-%m-%d"),
            audits=day_audits,
            new_users=day_users,
        ))

    # Revenue — exclude promo users from MRR
    pro_users       = db.query(func.count(User.id)).filter(User.is_pro == True, User.deleted_at == None).scalar() or 0
    pro_promo_users = db.query(func.count(User.id)).filter(User.is_pro == True, User.deleted_at == None, User.promo_code_used != None).scalar() or 0
    pro_paid_users  = pro_users - pro_promo_users
    mrr_usd         = float(pro_paid_users) * 9.0

    x402_count = db.query(func.count(X402Payment.id)).scalar() or 0
    x402_total_micro = db.query(func.sum(X402Payment.amount_usdc)).scalar() or 0
    x402_revenue_usd = float(x402_total_micro) / 1_000_000

    # Feature usage by source
    feature_usage: dict[str, int] = {"web": 0, "mcp": 0, "bulk": 0, "compare": 0, "x402": 0}
    src_rows = db.query(Audit.source, func.count(Audit.id)).group_by(Audit.source).all()
    for src, cnt in src_rows:
        key = src or "web"
        if key in feature_usage:
            feature_usage[key] = cnt
        elif key not in ("x402",):
            feature_usage["web"] = feature_usage.get("web", 0) + cnt

    # Promo code stats
    promo_rows = db.query(PromoCode).order_by(PromoCode.created_at).all()
    promo_codes = [
        PromoStats(code=p.code, description=p.description, use_count=p.use_count, max_uses=p.max_uses)
        for p in promo_rows
    ]

    return StatsOut(
        total_users=total_users,
        active_users=active_users,
        total_audits=total_audits,
        audits_today=audits_today,
        audits_this_week=audits_week,
        avg_level=avg_level,
        level_distribution=level_dist,
        daily=daily,
        pro_users=pro_users,
        pro_paid_users=pro_paid_users,
        pro_promo_users=pro_promo_users,
        mrr_usd=mrr_usd,
        x402_payments=x402_count,
        x402_revenue_usd=x402_revenue_usd,
        feature_usage=feature_usage,
        promo_codes=promo_codes,
    )


@router.get("/users", response_model=List[AdminUserOut])
def get_users(
    search: str = "",
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    q = db.query(User).filter(User.deleted_at == None)
    if search:
        q = q.filter(User.email.ilike(f"%{search}%"))
    users = q.order_by(desc(User.created_at)).offset(offset).limit(limit).all()

    result = []
    for u in users:
        audit_count   = db.query(func.count(Audit.id)).filter(Audit.user_id == u.id).scalar() or 0
        last_audit    = db.query(func.max(Audit.created_at)).filter(Audit.user_id == u.id).scalar()
        avg_lvl_row   = db.query(func.avg(Audit.level)).filter(Audit.user_id == u.id, Audit.level != None).scalar()
        result.append(AdminUserOut(
            id=u.id,
            email=u.email,
            name=u.name,
            job_title=u.job_title,
            company=u.company,
            social_url=u.social_url,
            is_active=u.is_active,
            is_admin=u.is_admin,
            is_pro=u.is_pro or False,
            created_at=u.created_at,
            audit_count=audit_count,
            last_audit_at=last_audit,
            avg_level=round(float(avg_lvl_row), 1) if avg_lvl_row else None,
        ))
    return result


@router.get("/users/{user_id}/audits", response_model=List[AdminAuditOut])
def get_user_audits(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    audits = db.query(Audit).filter(Audit.user_id == user_id).order_by(desc(Audit.created_at)).limit(50).all()
    return audits


@router.post("/users/{user_id}/toggle-admin")
def toggle_admin(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own admin status")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = not user.is_admin
    db.commit()
    return {"id": user.id, "is_admin": user.is_admin}


@router.post("/users/{user_id}/toggle-pro")
def toggle_pro(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_pro = not user.is_pro
    db.commit()
    return {"id": user.id, "is_pro": user.is_pro}


@router.post("/users/{user_id}/toggle-active")
def toggle_active(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}
