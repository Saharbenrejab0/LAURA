"""LAURA — auth routes"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def login(body: LoginRequest):
    # TODO: replace with real DB lookup
    # For now — hardcoded dev credentials
    if body.email == "dev@laura.ai" and body.password == "laura2026":
        return {
            "token": "dev-token-replace-with-jwt",
            "email": body.email,
            "role": "editor",
        }
    raise HTTPException(status_code=401, detail="Invalid credentials")
