"""
LAURA — configuration
All settings read from environment variables (.env file in dev)
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    # Database (optional in dev — uses in-memory store)
    DATABASE_URL: str = "sqlite:///./laura_dev.db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Auth
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_EXPIRY_HOURS: int = 8

    # Claude API (get from manager — optional during dev)
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"
    CLAUDE_MAX_TOKENS: int = 500
    ANONYMISE_BEFORE_LLM: bool = True  # EL security requirement

    # File storage (optional in dev)
    AZURE_STORAGE_CONNECTION_STRING: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_REGION: str = "eu-west-1"

    # n8n
    N8N_WEBHOOK_URL: str = ""
    N8N_API_KEY: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
