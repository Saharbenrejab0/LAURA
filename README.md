# LAURA — LOA Automation & Review Agent
**AI to Market × EssilorLuxottica**

LAURA automates the creation, validation, and approval of Letter of Approval (LOA) documents — replacing a fully manual Excel + PowerPoint process across 8 EMEA clusters.

## Architecture
- **Frontend**: Next.js (React) — deployed on Vercel
- **Backend**: Python FastAPI — AI to Market hosted
- **Orchestration**: n8n — approval workflow, notifications
- **AI**: Claude API (Anthropic) — pre-fill suggestions, anomaly detection
- **Database**: PostgreSQL
- **File storage**: Azure Blob / AWS S3 (EssilorLuxottica hosted)

## Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Python 3.11, FastAPI |
| Orchestration | n8n (cloud → self-hosted on prod) |
| AI | Claude API (claude-sonnet-4-20250514) |
| Database | PostgreSQL 15 |
| Cache | Redis |
| File generation | python-pptx, openpyxl |
| Deployment | Vercel (frontend), AI2M infra (backend) |

## Project structure
```
laura/
├── frontend/          # Next.js app
├── backend/           # FastAPI server
│   ├── api/           # route handlers
│   ├── engines/       # excel.py · ppt.py · ai.py
│   ├── models/        # database schemas
│   ├── tests/         # unit + integration tests
│   └── logs/          # AI inference audit log (required by EL security)
├── n8n/               # exported workflow JSONs
├── etl/               # data migration scripts (laptop → PostgreSQL)
├── security/          # threat model · questionnaire answers
└── docs/              # field map · template specs · API docs
```

## Getting started (development — no Docker required)
See `docs/dev-setup.md`

## Security
This repository is **private**. Contains EssilorLuxottica business logic.
Never commit `.env` files. See `.env.example` for required variables.

## Status
🟡 In development — Wave 1 (LOA automation)
