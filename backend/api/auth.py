"""
LAURA — Auth API
POST /auth/login  → returns JWT token + user info
GET  /auth/me     → returns current user from token
POST /auth/logout → client-side only (just clears token)

Seed users for POC (run seed_users() once). All passwords: laura2026
  Local Markets:
    france-marketer@laura-demo.local      → editor (FRANCE)
    france-finance@laura-demo.local       → finance (FRANCE)
  Regional / EMEA:
    emea-editor@laura-demo.local          → editor (all)
    regional-cmo@laura-demo.local         → approver (all, PPT)
    regional-cfo@laura-demo.local         → approver (all, Excel)
  Global & Corporate:
    global-brand-rayban@laura-demo.local  → approver (Ray-Ban brand)
    global-function-events@laura-demo.local → approver (Events function)
    corporate@laura-demo.local            → approver (final green light)
  Admin:
    admin@aitomarket.com                  → admin
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import jwt
import bcrypt

from backend.models.database import get_db
from backend.models.user import User
from backend.config import settings

router = APIRouter()

JWT_SECRET    = getattr(settings, 'JWT_SECRET', 'laura-dev-secret-change-in-prod')
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_H  = 24


# ── Pydantic schemas ────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    cluster: str | None

    class Config:
        from_attributes = True


# ── Helpers ─────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user: User) -> str:
    payload = {
        "sub":      str(user.id),
        "email":    user.email,
        "role":     user.role,
        "cluster":  user.cluster,
        "exp":      datetime.utcnow() + timedelta(hours=JWT_EXPIRY_H),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(
    authorization: str = Header(default="", alias="Authorization"),
    db: Session = Depends(get_db)
) -> User:
    """Dependency — extract user from Bearer token in Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    payload = decode_token(token)
    user = db.query(User).filter(User.email == payload["email"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Endpoints ───────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated")

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    token = create_token(user)
    return {
        "token": token,
        "user": {
            "id":        str(user.id),
            "email":     user.email,
            "full_name": user.full_name,
            "role":      user.role,
            "cluster":   user.cluster,
        }
    }


@router.get("/me")
async def get_me(authorization: str = "", db: Session = Depends(get_db)):
    """Returns current user from JWT — frontend calls this on app load."""
    from fastapi import Header
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    payload = decode_token(token)
    user = db.query(User).filter(User.email == payload["email"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {
        "id":        str(user.id),
        "email":     user.email,
        "full_name": user.full_name,
        "role":      user.role,
        "cluster":   user.cluster,
    }


# ── Seed users (run once for POC) ───────────────────────────────────────

def seed_users(db: Session):
    """
    Creates POC users if they don't exist.
    Call from a script or on startup in development.
    All POC passwords: laura2026

    Accounts are grouped by approval-relay stage so that the demo tells
    a story: a Local Market creates the LOA, EMEA edits, Regional approves,
    Global & Corporate green-light, then it's done.
    """
    poc_users = [
        # ─── Legacy POC accounts (kept for backward compatibility) ───────
        {"email": "vanessa@essilor.com",         "full_name": "Vanessa Stöecklein",    "role": "approver", "cluster": None},
        {"email": "thibault@essilor.com",        "full_name": "Thibault de Bodman",    "role": "finance",  "cluster": None},
        {"email": "sandrine@essilor.com",        "full_name": "Sandrine (EL)",         "role": "approver", "cluster": None},
        {"email": "marketer@essilor.com",        "full_name": "Test Marketer",         "role": "editor",   "cluster": "FRANCE"},
        {"email": "admin@aitomarket.com",        "full_name": "AI to Market Admin",    "role": "admin",    "cluster": None},
        {"email": "sahar@aitomarketgroup.com",   "full_name": "Sahar (AI to Market)",  "role": "admin",    "cluster": None},

        # ─── Stage 1 — LOCAL MARKETS ─────────────────────────────────────
        # Country-level editor + finance commenter. Editors create LOAs;
        # finance reviews budgets at country level before EMEA handover.
        {"email": "france-marketer@laura-demo.local",       "full_name": "Camille (FR Marketer)",          "role": "editor",   "cluster": "FRANCE"},
        {"email": "france-finance@laura-demo.local",        "full_name": "Julien (FR Finance)",            "role": "finance",  "cluster": "FRANCE"},

        # ─── Stage 2 — REGIONAL / EMEA ───────────────────────────────────
        # EMEA PS picks up the baton from local. Regional CMO validates the
        # PPT side, Regional CFO validates the Excel side. Both approve.
        {"email": "emea-editor@laura-demo.local",           "full_name": "Vanessa (EMEA PS)",              "role": "editor",   "cluster": None},
        {"email": "regional-cmo@laura-demo.local",          "full_name": "Alexandra (Regional CMO)",       "role": "approver", "cluster": None},
        {"email": "regional-cfo@laura-demo.local",          "full_name": "Giulia (Regional CFO)",          "role": "approver", "cluster": None},

        # ─── Stage 3 — GLOBAL & CORPORATE ────────────────────────────────
        # Global brand and function teams comment only (no edit rights).
        # Corporate gives the final green light before the package goes
        # to the Group CEO (Milleri) — LAURA stops at corporate sign-off.
        {"email": "global-brand-rayban@laura-demo.local",   "full_name": "Marco (Global Brand · Ray-Ban)", "role": "approver", "cluster": None},
        {"email": "global-function-events@laura-demo.local","full_name": "Sofia (Global Events)",          "role": "approver", "cluster": None},
        {"email": "corporate@laura-demo.local",             "full_name": "CEO Office (Corporate)",         "role": "approver", "cluster": None},
    ]
    hashed = hash_password("laura2026")
    created = 0
    for u in poc_users:
        exists = db.query(User).filter(User.email == u["email"]).first()
        if not exists:
            db.add(User(
                email=u["email"],
                full_name=u["full_name"],
                hashed_password=hashed,
                role=u["role"],
                cluster=u["cluster"],
                is_active=True,
            ))
            created += 1
    db.commit()
    print(f"✓ POC users seeded — {created} new account(s) created, {len(poc_users) - created} already existed")