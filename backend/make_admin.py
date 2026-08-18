#!/usr/bin/env python3
"""
Make a user admin by email.

Usage:
    .venv/bin/python make_admin.py your@email.com
"""
import sys
from app.db import SessionLocal, User, init_db

init_db()
db = SessionLocal()

email = sys.argv[1].lower().strip() if len(sys.argv) > 1 else input("Email: ").lower().strip()
user = db.query(User).filter(User.email == email).first()

if not user:
    print(f"❌ User not found: {email}")
    sys.exit(1)

user.is_admin = True
db.commit()
print(f"✅ {email} is now admin")
db.close()
