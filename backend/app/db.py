"""Database models and session management."""

import os
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import (
    create_engine, Column, Integer, String, Boolean,
    DateTime, Text, ForeignKey, JSON,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aiseo.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name          = Column(String(100), nullable=True)
    job_title     = Column(String(150), nullable=True)
    company       = Column(String(150), nullable=True)
    social_url    = Column(String(500), nullable=True)
    is_active     = Column(Boolean, default=True)
    is_admin      = Column(Boolean, default=False)
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    deleted_at    = Column(DateTime(timezone=True), nullable=True)
    telegram_chat_id   = Column(String(64), nullable=True)
    telegram_link_token = Column(String(64), nullable=True)
    is_pro             = Column(Boolean, default=False)
    promo_code_used    = Column(String(64), nullable=True)

    audits = relationship("Audit", back_populates="user", cascade="all, delete-orphan")
    watched_domains = relationship("WatchedDomain", back_populates="user", cascade="all, delete-orphan")


class Audit(Base):
    __tablename__ = "audits"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=True)  # nullable for x402 anonymous audits
    url        = Column(String(2048), nullable=False)
    level      = Column(Integer, nullable=True)   # final L0–L5
    score      = Column(Integer, nullable=True)   # checks passed
    max_score  = Column(Integer, nullable=True)   # total checks
    results    = Column(JSON, nullable=True)       # list of check dicts
    source     = Column(String(16), default="manual")  # "manual" | "monitor"
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="audits")


class WatchedDomain(Base):
    __tablename__ = "watched_domains"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    url        = Column(String(2048), nullable=False)
    last_level = Column(Integer, nullable=True)
    last_score = Column(Integer, nullable=True)
    last_max   = Column(Integer, nullable=True)
    last_audit_at   = Column(DateTime(timezone=True), nullable=True)
    check_frequency = Column(String(16), default="weekly")  # daily | weekly | monthly
    created_at      = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="watched_domains")


class X402Payment(Base):
    __tablename__ = "x402_payments"

    id           = Column(Integer, primary_key=True, index=True)
    from_address = Column(String(42), nullable=False)
    nonce        = Column(String(66), nullable=False)
    amount_usdc  = Column(Integer, nullable=False)  # in micro-USDC (100000 = $0.10)
    path         = Column(String(256), nullable=True)
    audit_id     = Column(Integer, ForeignKey("audits.id"), nullable=True)
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id          = Column(Integer, primary_key=True, index=True)
    code        = Column(String(64), unique=True, index=True, nullable=False)
    description = Column(String(256), nullable=True)
    grants_pro  = Column(Boolean, default=True)
    max_uses    = Column(Integer, nullable=True)   # None = unlimited
    use_count   = Column(Integer, default=0)
    expires_at  = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


def init_db():
    Base.metadata.create_all(bind=engine)
    # Add is_admin column if missing (safe for existing DBs)
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    cols = [c["name"] for c in insp.get_columns("users")]
    if "is_admin" not in cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
            conn.commit()
    # Create watched_domains table if missing
    if "watched_domains" not in insp.get_table_names():
        Base.metadata.tables["watched_domains"].create(bind=engine)

    for col, definition in [
        ("job_title",         "VARCHAR(150)"),
        ("company",           "VARCHAR(150)"),
        ("social_url",        "VARCHAR(500)"),
        ("telegram_chat_id",  "VARCHAR(64)"),
        ("telegram_link_token", "VARCHAR(64)"),
        ("is_pro", "BOOLEAN DEFAULT 0"),
    ]:
        if col not in cols:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {definition}"))
                conn.commit()

    if "watched_domains" in insp.get_table_names():
        wd_cols = [c["name"] for c in insp.get_columns("watched_domains")]
        if "check_frequency" not in wd_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE watched_domains ADD COLUMN check_frequency VARCHAR(16) DEFAULT 'weekly'"))
                conn.commit()

    if "audits" in insp.get_table_names():
        audit_cols = [c["name"] for c in insp.get_columns("audits")]
        for col, definition in [
            ("source", "VARCHAR(16) DEFAULT 'manual'"),
        ]:
            if col not in audit_cols:
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE audits ADD COLUMN {col} {definition}"))
                    conn.commit()

    if "x402_payments" not in insp.get_table_names():
        Base.metadata.tables["x402_payments"].create(bind=engine)

    # promo_code_used column on users
    cols = [c["name"] for c in insp.get_columns("users")]
    if "promo_code_used" not in cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN promo_code_used VARCHAR(64)"))
            conn.commit()

    if "promo_codes" not in insp.get_table_names():
        Base.metadata.tables["promo_codes"].create(bind=engine)

    # Seed PRODUCTHUNT promo code
    with SessionLocal() as sess:
        if not sess.query(PromoCode).filter_by(code="PRODUCTHUNT").first():
            sess.add(PromoCode(
                code="PRODUCTHUNT",
                description="1 month Pro free for Product Hunt launch",
                grants_pro=True,
                max_uses=None,
            ))
            sess.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
