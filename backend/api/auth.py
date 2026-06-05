"""
LAURA — Auth API
POST /auth/login  → returns JWT token + user info
GET  /auth/me     → returns current user from token
POST /auth/logout → client-side only (just clears token)

Seed users for POC (run seed_users() once):
  vanessa@essilor.com     / laura2026  → approver
  thibault@essilor.com    / laura2026  → finance
  sandrine@essilor.com    / laura2026  → approver
  marketer@essilor.com    / laura2026  → editor (FRANCE)
  admin@aitomarket.com    / laura2026  → admin
"""

from fastapi import APIRouter, HTTPException, Depends
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


# ── Pydantic schemas ──────────────────────────────────────────────────────────

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


# ── Helpers ───────────────────────────────────────────────────────────────────

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
    authorization: str = "",
    db: Session = Depends(get_db)
) -> User:
    """Dependency — extract user from Bearer token."""
    from fastapi import Header
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    payload = decode_token(token)
    user = db.query(User).filter(User.email == payload["email"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Endpoints ─────────────────────────────────────────────────────────────────

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


# ── Seed users (run once for POC) ─────────────────────────────────────────────

def seed_users(db: Session):
    """
    Creates POC users if they don't exist.
    Call from a script or on startup in development.
    All POC passwords: laura2026
    """
    poc_users = [
        {"email": "vanessa@essilor.com",   "full_name": "Vanessa Stöecklein", "role": "approver", "cluster": None},
        {"email": "thibault@essilor.com",  "full_name": "Thibault de Bodman", "role": "finance",  "cluster": None},
        {"email": "sandrine@essilor.com",  "full_name": "Sandrine (EL)",      "role": "approver", "cluster": None},
        {"email": "marketer@essilor.com",  "full_name": "Test Marketer",      "role": "editor",   "cluster": "FRANCE"},
        {"email": "admin@aitomarket.com",  "full_name": "AI to Market Admin", "role": "admin",    "cluster": None},
        {"email": "sahar@aitomarketgroup.com", "full_name": "Sahar (AI to Market)", "role": "admin", "cluster": None},
    ]
    hashed = hash_password("laura2026")
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
    db.commit()
    print("✓ POC users seeded")