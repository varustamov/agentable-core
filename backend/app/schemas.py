"""Pydantic request/response schemas."""

from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, field_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    job_title: Optional[str] = None
    company: Optional[str] = None
    social_url: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: int
    email: str
    name: Optional[str]
    job_title: Optional[str] = None
    company: Optional[str] = None
    social_url: Optional[str] = None
    is_admin: bool = False
    is_pro: bool = False
    has_telegram: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, **kw):
        data = super().model_validate(obj, **kw)
        data.has_telegram = bool(getattr(obj, "telegram_chat_id", None))
        return data


TokenResponse.model_rebuild()


# ── Audit ─────────────────────────────────────────────────────────────────────

class AuditRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def normalize_url(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith(("http://", "https://")):
            v = "https://" + v
        return v


class CheckOut(BaseModel):
    check_id: str
    level: int
    name: str
    passed: bool
    message: str
    recommendation: Optional[str] = None


class AuditOut(BaseModel):
    id: int
    url: str
    level: Optional[int]
    score: Optional[int]
    max_score: Optional[int]
    results: Optional[List[Any]]
    created_at: datetime

    model_config = {"from_attributes": True}
