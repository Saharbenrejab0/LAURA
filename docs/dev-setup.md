# LAURA — Development Setup (Windows, no Docker)

## Prerequisites
- Python 3.11+ — https://python.org
- Node.js 20+ — https://nodejs.org
- PostgreSQL 15 — https://postgresql.org/download/windows
- Redis for Windows — https://github.com/tporadowski/redis/releases
- Git — https://git-scm.com

## Step 1 — Clone the repo
```bash
git clone https://github.com/sahar-collab/LAURA.git
cd LAURA
```

## Step 2 — Backend setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` (your local PostgreSQL)
- `ANTHROPIC_API_KEY` (get from manager)
- `JWT_SECRET` (generate any long random string)

## Step 3 — Create the database
```bash
# In PostgreSQL (psql or pgAdmin)
CREATE DATABASE laura_db;
CREATE USER laura_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE laura_db TO laura_user;
```

Run migrations:
```bash
alembic upgrade head
```

## Step 4 — Start backend
```bash
uvicorn backend.main:app --reload --port 8000
```
API docs at: http://localhost:8000/docs

## Step 5 — Frontend setup
```bash
cd frontend
npm install
npm run dev
```
App at: http://localhost:3000

## Step 6 — n8n
Your n8n is on the cloud: https://aitomarket.app.n8n.cloud
Workflows are exported as JSON in the `n8n/` folder.
Import them directly in your n8n instance.

## Running tests
```bash
cd backend
pytest tests/ -v
```

## Folder quick reference
```
C:\Users\sahar\Desktop\Laura\
├── .env                  ← your secrets (never push this)
├── .env.example          ← template (safe to push)
├── frontend/             ← Next.js app
├── backend/              ← FastAPI
└── n8n/                  ← workflow JSONs
```
